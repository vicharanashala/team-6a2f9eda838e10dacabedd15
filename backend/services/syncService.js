const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');

let lastSyncTime = 0;
const SYNC_INTERVAL = 30000; // 30 seconds cooldown

const syncGoogleUsers = async () => {
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL) return;
  lastSyncTime = now;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return;

  try {
    const googleUsers = await User.find({ googleId: { $exists: true, $ne: null } });
    if (googleUsers.length === 0) return;

    // Filter out mock Google users
    const realGoogleUsers = googleUsers.filter(u => u.googleId && !u.googleId.startsWith('mock_google_id_'));
    if (realGoogleUsers.length === 0) return;

    const uids = realGoogleUsers.map(u => u.googleId);

    // Query in chunks of 100
    const chunkSize = 100;
    for (let i = 0; i < uids.length; i += chunkSize) {
      const chunk = uids.slice(i, i + chunkSize);

      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: chunk })
      });

      if (!response.ok) {
        console.error('Firebase accounts lookup failed during sync:', response.statusText);
        continue;
      }

      const data = await response.json();
      const existingUids = new Set((data.users || []).map(u => u.localId));

      const deletedUids = chunk.filter(uid => !existingUids.has(uid));

      for (const deletedUid of deletedUids) {
        const targetUser = realGoogleUsers.find(u => u.googleId === deletedUid);
        if (targetUser) {
          console.log(`[Sync] Deleting user ${targetUser.username} (${targetUser.email}) because they were removed from Google Auth.`);
          
          // Delete their questions, answers, and user record
          await Promise.all([
            Question.deleteMany({ author: targetUser._id }),
            Answer.deleteMany({ author: targetUser._id }),
            User.deleteOne({ _id: targetUser._id })
          ]);
        }
      }
    }
  } catch (err) {
    console.error('Error during Google users sync:', err.message);
  }
};

module.exports = {
  syncGoogleUsers
};
