// ── VERSES · Supabase Database Layer ──
const SUPABASE_URL      = 'https://kexygvyawcwzajhwzxhd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RphIaNAb3WFIJ1grYPxnDA_G4hSDY2d';

let _sb = null;
function sb() {
  if (!_sb) _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

// ── PROFILES ──
async function dbGetAllProfiles(excludeId) {
  let q = sb().from('profiles').select('*')
    .neq('email', 'demo@verses.app')
    .order('created_at', { ascending: false });
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;
  if (error) { console.error('dbGetAllProfiles', error); return []; }
  return data || [];
}

async function dbGetProfile(id) {
  const { data } = await sb().from('profiles').select('*').eq('id', id).single();
  return data || null;
}

async function dbGetProfileByEmail(email) {
  const { data } = await sb().from('profiles').select('*').eq('email', email).single();
  return data || null;
}

async function dbUpdateProfile(id, updates) {
  const { data, error } = await sb()
    .from('profiles').update(updates).eq('id', id).select().single();
  if (error) { console.error('dbUpdateProfile', error); return null; }
  return data;
}

async function dbDeleteAccount(id) {
  try {
    const slots = Array.from({length:8}, (_,i) => [`${id}/media_${i}.jpg`, `${id}/media_${i}.mp4`]).flat();
    slots.push(`${id}/photo.jpg`, `${id}/voice.webm`);
    await sb().storage.from('media').remove(slots);
  } catch(e) {}
  await sb().from('likes').delete().or(`from_id.eq.${id},to_id.eq.${id}`);
  await sb().from('messages').delete().or(`from_id.eq.${id},to_id.eq.${id}`);
  await sb().from('blocks').delete().or(`blocker_id.eq.${id},blocked_id.eq.${id}`);
  await sb().from('reports').delete().or(`reporter_id.eq.${id},reported_id.eq.${id}`);
  // Try RPC-based delete first; fall back to direct delete if RPC not installed
  try { await sb().rpc('set_app_user_id', { user_id: id }); } catch(e) {}
  const { error } = await sb().from('profiles').delete().eq('id', id);
  if (error) { console.error('dbDeleteAccount failed:', error); return { success: false, error: error.message }; }
  localStorage.removeItem(`verses_pw_${id}`);
  return { success: true };
}

// ── LIKES ──
async function dbGetMyLikes(fromId) {
  const { data } = await sb().from('likes').select('*').eq('from_id', fromId);
  return data || [];
}

async function dbToggleLike(fromId, toId, promptIdx) {
  const { data: ex } = await sb().from('likes').select('id')
    .eq('from_id', fromId).eq('to_id', toId).eq('prompt_idx', promptIdx).single();
  if (ex) { await sb().from('likes').delete().eq('id', ex.id); return false; }
  await sb().from('likes').insert({ from_id: fromId, to_id: toId, prompt_idx: promptIdx });
  return true;
}

async function dbGetMatches(myId) {
  const { data } = await sb().from('likes').select('to_id').eq('from_id', myId);
  if (!data || !data.length) return [];
  const ids = [...new Set(data.map(r => r.to_id))];
  const { data: profiles } = await sb().from('profiles').select('*').in('id', ids);
  return profiles || [];
}

// ── MESSAGES ──
async function dbGetThread(myId, theirId) {
  const { data } = await sb().from('messages').select('*')
    .or(`and(from_id.eq.${myId},to_id.eq.${theirId}),and(from_id.eq.${theirId},to_id.eq.${myId})`)
    .order('created_at', { ascending: true });
  return data || [];
}

async function dbSendMessage(fromId, toId, text) {
  const { data } = await sb().from('messages')
    .insert({ from_id: fromId, to_id: toId, text }).select().single();
  return data || null;
}

async function dbGetAllThreads(myId) {
  const { data } = await sb().from('messages').select('*')
    .or(`from_id.eq.${myId},to_id.eq.${myId}`)
    .order('created_at', { ascending: false });
  const seen = new Set(), convos = [];
  for (const msg of (data || [])) {
    const otherId = msg.from_id === myId ? msg.to_id : msg.from_id;
    if (!seen.has(otherId)) {
      seen.add(otherId);
      convos.push({ otherId, lastMsg: msg.text, lastTime: msg.created_at, fromMe: msg.from_id === myId });
    }
  }
  return convos;
}

function dbSubscribeMessages(myId, theirId, callback) {
  return sb().channel(`chat_${myId}_${theirId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${myId}` },
      payload => { if (payload.new.from_id === theirId) callback(payload.new); })
    .subscribe();
}

function dbUnsubscribe(channel) {
  if (channel) sb().removeChannel(channel);
}

// ── BLOCKS ──
async function dbGetMyBlocks(myId) {
  const { data } = await sb().from('blocks').select('blocked_id').eq('blocker_id', myId);
  return (data || []).map(r => r.blocked_id);
}

async function dbBlockUser(blockerId, blockedId) {
  const { data: ex } = await sb().from('blocks').select('id')
    .eq('blocker_id', blockerId).eq('blocked_id', blockedId).single();
  if (ex) return;
  await sb().from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
}

// ── REPORTS ──
async function dbReport(reporterId, reportedId, reason, details, evidenceUrl) {
  const { error } = await sb().from('reports').insert({
    reporter_id: reporterId, reported_id: reportedId,
    reason, details, evidence_url: evidenceUrl || null,
  });
  return !error;
}

async function dbGetAllReports() {
  const { data } = await sb().from('reports')
    .select('*, reporter:profiles!reporter_id(name,email), reported:profiles!reported_id(name,email)')
    .order('created_at', { ascending: false });
  return data || [];
}

async function dbDeleteReport(reportId) {
  await sb().from('reports').delete().eq('id', reportId);
}

// ── AUTH ──
async function dbLogin(email, password) {
  const profile = await dbGetProfileByEmail(email.toLowerCase());
  if (!profile) return { error: 'No account found with that email.' };

  const hash = btoa(unescape(encodeURIComponent(password)));

  if (profile.password_hash) {
    if (profile.password_hash !== hash) return { error: 'Incorrect password.' };
  } else {
    // No password in DB — check localStorage migration
    const stored = localStorage.getItem(`verses_pw_${profile.id}`);
    if (!stored) {
      // Account exists with no password anywhere — let them set one now
      await dbUpdateProfile(profile.id, { password_hash: hash });
    } else if (stored !== hash) {
      return { error: 'Incorrect password.' };
    } else {
      await dbUpdateProfile(profile.id, { password_hash: hash });
    }
  }
  localStorage.setItem(`verses_pw_${profile.id}`, hash);
  return { profile };
}

async function dbSignup(email, name, password) {
  const existing = await dbGetProfileByEmail(email.toLowerCase());
  if (existing) return { error: 'An account with this email already exists.' };
  const hash = btoa(unescape(encodeURIComponent(password)));
  const { data, error } = await sb().from('profiles')
    .insert({ email: email.toLowerCase(), name, password_hash: hash, media: [] })
    .select().single();
  if (error) return { error: 'Could not create account. Please try again.' };
  localStorage.setItem(`verses_pw_${data.id}`, hash);
  return { profile: data };
}

async function dbResetPassword(email, newPassword) {
  const profile = await dbGetProfileByEmail(email.toLowerCase());
  if (!profile) return { error: 'No account found with that email.' };
  const hash = btoa(unescape(encodeURIComponent(newPassword)));
  await dbUpdateProfile(profile.id, { password_hash: hash });
  localStorage.setItem(`verses_pw_${profile.id}`, hash);
  return { profile };
}

// ── STORAGE ──
async function dbUploadMediaSlot(userId, slot, blob, mimeType) {
  const isVideo = mimeType.includes('video');
  const ext     = isVideo ? 'mp4' : 'jpg';
  const path    = `${userId}/media_${slot}.${ext}`;
  const { error } = await sb().storage.from('media')
    .upload(path, blob, { upsert: true, contentType: mimeType });
  if (error) { console.error('dbUploadMediaSlot', error); return null; }
  const { data } = sb().storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, type: isVideo ? 'video' : 'photo' };
}

async function dbDeleteMediaSlot(userId, slot) {
  await sb().storage.from('media')
    .remove([`${userId}/media_${slot}.jpg`, `${userId}/media_${slot}.mp4`]);
}

async function dbUploadMedia(userId, blob, mimeType) {
  const ext  = mimeType.includes('video') ? 'webm' : 'jpg';
  const path = `${userId}/photo.${ext}`;
  const { error } = await sb().storage.from('media')
    .upload(path, blob, { upsert: true, contentType: mimeType });
  if (error) { console.error('dbUploadMedia', error); return null; }
  const { data } = sb().storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

async function dbDeleteMedia(userId) {
  await sb().storage.from('media').remove([`${userId}/photo.jpg`, `${userId}/photo.webm`]);
}

async function dbUploadEvidence(reporterId, blob, mimeType) {
  const ext  = mimeType.includes('video') ? 'mp4' : 'jpg';
  const path = `reports/${reporterId}_${Date.now()}.${ext}`;
  const { error } = await sb().storage.from('media')
    .upload(path, blob, { upsert: true, contentType: mimeType });
  if (error) { console.error('dbUploadEvidence', error); return null; }
  const { data } = sb().storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

// ── EXPORTS ──
window.VersesDB = {
  getSupabase: sb,
  dbGetAllProfiles, dbGetProfile, dbGetProfileByEmail, dbUpdateProfile, dbDeleteAccount,
  dbGetMyLikes, dbToggleLike, dbGetMatches,
  dbGetMyBlocks, dbBlockUser,
  dbReport, dbGetAllReports, dbDeleteReport,
  dbLogin, dbSignup, dbResetPassword,
  dbUploadMediaSlot, dbDeleteMediaSlot, dbUploadMedia, dbDeleteMedia, dbUploadEvidence,
  dbGetThread, dbSendMessage, dbGetAllThreads, dbSubscribeMessages, dbUnsubscribe,
};
