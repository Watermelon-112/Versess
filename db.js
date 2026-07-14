async function dbDeleteAccount(id) {
  try {
    // Delete media files
    const files = [];
    for (let i = 0; i < 8; i++) {
      files.push(`${id}/media_${i}.jpg`);
      files.push(`${id}/media_${i}.mp4`);
    }
    files.push(`${id}/photo.jpg`);
    files.push(`${id}/voice.webm`);

    await sb().storage.from('media').remove(files);

    // Delete related data
    await sb().from('likes').delete().or(`from_id.eq.${id},to_id.eq.${id}`);
    await sb().from('messages').delete().or(`from_id.eq.${id},to_id.eq.${id}`);
    await sb().from('blocks').delete().or(`blocker_id.eq.${id},blocked_id.eq.${id}`);
    await sb().from('reports').delete().or(`reporter_id.eq.${id},reported_id.eq.${id}`);

    // Delete profile
    const { error } = await sb()
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Clear local data
    localStorage.removeItem(`verses_pw_${id}`);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('verses_user');

    return { success: true };

  } catch (err) {
    console.error("Delete account failed:", err);
    return {
      success: false,
      error: err.message
    };
  }
}
