// ── VERSES · Supabase Database Layer ──
// Uses the Supabase JS v2 CDN build (loaded via <script> in HTML)

const SUPABASE_URL      = 'https://kexygvyawcwzajhwzxhd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RphIaNAb3WFIJ1grYPxnDA_G4hSDY2d';

let _sb = null;
function sb() {
  if (!_sb) {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _sb;
}

// ── PROFILES ──

async function dbGetAllProfiles(excludeId) {
  let q = sb().from('profiles').select('*').order('created_at', { ascending: false });
  if (excludeId) q = q.neq('id', excludeId);
  const { data, error } = await q;
  if (error) { console.error('dbGetAllProfiles', error); return []; }
  return data || [];
}

async function dbGetProfile(id) {
  const { data, error } = await sb().from('profiles').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

async function dbGetProfileByEmail(email) {
  const { data, error } = await sb().from('profiles').select('*').eq('email', email).single();
  if (error) return null;
  return data;
}

async function dbCreateProfile({ email, name, password_hash }) {
  const { data, error } = await sb()
    .from('profiles')
    .insert({ email, name })
    .select()
    .single();
  if (error) { console.error('dbCreateProfile', error); return null; }
  return data;
}

async function dbUpdateProfile(id, updates) {
  const { data, error } = await sb()
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) { console.error('dbUpdateProfile', error); return null; }
  return data;
}

// ── LIKES ──

async function dbGetMyLikes(fromId) {
  const { data, error } = await sb()
    .from('likes')
    .select('*')
    .eq('from_id', fromId);
  if (error) return [];
  return data || [];
}

async function dbToggleLike(fromId, toId, promptIdx) {
  // Check if already liked
  const { data: existing } = await sb()
    .from('likes')
    .select('id')
    .eq('from_id', fromId)
    .eq('to_id', toId)
    .eq('prompt_idx', promptIdx)
    .single();

  if (existing) {
    await sb().from('likes').delete().eq('id', existing.id);
    return false; // unliked
  } else {
    await sb().from('likes').insert({ from_id: fromId, to_id: toId, prompt_idx: promptIdx });
    return true; // liked
  }
}

async function dbGetMatches(myId) {
  // People I have liked at least once
  const { data, error } = await sb()
    .from('likes')
    .select('to_id')
    .eq('from_id', myId);
  if (error || !data) return [];
  const ids = [...new Set(data.map(r => r.to_id))];
  if (ids.length === 0) return [];
  const { data: profiles } = await sb()
    .from('profiles')
    .select('*')
    .in('id', ids);
  return profiles || [];
}

// ── MESSAGES ──

async function dbGetThread(myId, theirId) {
  const { data, error } = await sb()
    .from('messages')
    .select('*')
    .or(`and(from_id.eq.${myId},to_id.eq.${theirId}),and(from_id.eq.${theirId},to_id.eq.${myId})`)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

async function dbSendMessage(fromId, toId, text) {
  const { data, error } = await sb()
    .from('messages')
    .insert({ from_id: fromId, to_id: toId, text })
    .select()
    .single();
  if (error) { console.error('dbSendMessage', error); return null; }
  return data;
}

async function dbGetAllThreads(myId) {
  // Get latest message per conversation partner
  const { data, error } = await sb()
    .from('messages')
    .select('*')
    .or(`from_id.eq.${myId},to_id.eq.${myId}`)
    .order('created_at', { ascending: false });
  if (error) return [];

  const seen  = new Set();
  const convos = [];
  for (const msg of (data || [])) {
    const otherId = msg.from_id === myId ? msg.to_id : msg.from_id;
    if (!seen.has(otherId)) {
      seen.add(otherId);
      convos.push({ otherId, lastMsg: msg.text, lastTime: msg.created_at, fromMe: msg.from_id === myId });
    }
  }
  return convos;
}

// ── REALTIME subscription for messages ──
function dbSubscribeMessages(myId, theirId, callback) {
  return sb()
    .channel(`chat_${myId}_${theirId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `to_id=eq.${myId}`,
    }, payload => {
      if (payload.new.from_id === theirId) callback(payload.new);
    })
    .subscribe();
}

function dbUnsubscribe(channel) {
  if (channel) sb().removeChannel(channel);
}

// ── AUTH (simple email/password stored in profiles, not Supabase Auth) ──
// We store a hashed password locally since we're not using Supabase Auth
async function dbLogin(email, password) {
  const profile = await dbGetProfileByEmail(email.toLowerCase());
  if (!profile) return { error: 'No account found with that email.' };

  // Check password hash stored in localStorage (profile id → password)
  const stored = localStorage.getItem(`verses_pw_${profile.id}`);
  if (!stored || stored !== btoa(password)) {
    return { error: 'Incorrect password.' };
  }
  return { profile };
}

async function dbSignup(email, name, password) {
  const existing = await dbGetProfileByEmail(email.toLowerCase());
  if (existing) return { error: 'An account with this email already exists.' };

  const profile = await dbCreateProfile({ email: email.toLowerCase(), name });
  if (!profile) return { error: 'Could not create account. Please try again.' };

  // Store password hash locally
  localStorage.setItem(`verses_pw_${profile.id}`, btoa(password));
  return { profile };
}

// ── STORAGE (photos + voice notes) ──
async function dbUploadMedia(userId, type, blob, mimeType) {
  const ext  = mimeType.includes('audio') ? 'webm' : 'jpg';
  const path = `${userId}/${type}.${ext}`;
  const { error } = await sb().storage.from('media').upload(path, blob, {
    upsert: true,
    contentType: mimeType,
  });
  if (error) { console.error('dbUploadMedia', error); return null; }
  const { data } = sb().storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

async function dbDeleteMedia(userId, type) {
  const paths = [`${userId}/${type}.jpg`, `${userId}/${type}.webm`];
  await sb().storage.from('media').remove(paths);
}

// Export
window.VersesDB = {
  dbGetAllProfiles,
  dbGetProfile,
  dbGetProfileByEmail,
  dbCreateProfile,
  dbUpdateProfile,
  dbGetMyLikes,
  dbToggleLike,
  dbGetMatches,
  dbGetThread,
  dbSendMessage,
  dbGetAllThreads,
  dbSubscribeMessages,
  dbUnsubscribe,
  dbLogin,
  dbSignup,
  dbUploadMedia,
  dbDeleteMedia,
};
