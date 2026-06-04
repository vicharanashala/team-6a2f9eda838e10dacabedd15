let admin = null;
try {
  admin = require('firebase-admin');
} catch (_) {
  // firebase-admin is optional — if not installed, Firebase user sync is disabled
}
const User = require('../models/User');
const Question = require('../models/Question');
const Answer = require('../models/Answer');

let lastSyncTime = 0;
const SYNC_INTERVAL = 30000; // 30 seconds cooldown

let firebaseAdminApp = null;

const getFirebaseAdmin = () => {
  if (!admin) return null; // firebase-admin package not installed
  if (firebaseAdminApp) return firebaseAdminApp;

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountEnv) {
    return null;
  }

  try {
    let serviceAccount;
    let trimmed = serviceAccountEnv.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      trimmed = trimmed.slice(1, -1);
    }
    trimmed = trimmed.replace(/\\"/g, '"');

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      serviceAccount = JSON.parse(trimmed);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    } else {
      serviceAccount = require(trimmed);
    }

    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    }, 'sync-app');
    return firebaseAdminApp;
  } catch (err) {
    console.error('⚠️ Failed to initialize Firebase Admin SDK:', err.message);
    return null;
  }
};

const syncGoogleUsers = async () => {
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL) return;
  lastSyncTime = now;

  const app = getFirebaseAdmin();
  if (!app) {
    console.log('⚠️ FIREBASE_SERVICE_ACCOUNT not configured in secrets.env. Automated Firebase user pruning is inactive.');
    return;
  }

  try {
    const googleUsers = await User.find({ googleId: { $exists: true, $ne: null } });
    if (googleUsers.length === 0) return;

    // Filter out mock Google users
    const realGoogleUsers = googleUsers.filter(u => u.googleId && !u.googleId.startsWith('mock_google_id_'));
    if (realGoogleUsers.length === 0) return;

    // Fetch all active Firebase users
    const auth = app.auth();
    const activeFirebaseUids = new Set();
    
    let nextPageToken;
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      listUsersResult.users.forEach((userRecord) => {
        activeFirebaseUids.add(userRecord.uid);
        // Also add provider UIDs if any (e.g. googleId might match userRecord.providerData[0].uid)
        userRecord.providerData.forEach((profile) => {
          if (profile.uid) {
            activeFirebaseUids.add(profile.uid);
          }
        });
      });
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    // Any MongoDB user whose googleId is NOT in activeFirebaseUids has been removed from Firebase Auth!
    for (const targetUser of realGoogleUsers) {
      if (!activeFirebaseUids.has(targetUser.googleId)) {
        console.log(`[Sync] Deleting user ${targetUser.username} (${targetUser.email}) because they were removed from Firebase Auth.`);
        
        // Delete their questions, answers, and user record
        await Promise.all([
          Question.deleteMany({ author: targetUser._id }),
          Answer.deleteMany({ author: targetUser._id }),
          User.deleteOne({ _id: targetUser._id })
        ]);
      }
    }
  } catch (err) {
    console.error('Error during Google users sync:', err.message);
  }
};

module.exports = {
  syncGoogleUsers
};
