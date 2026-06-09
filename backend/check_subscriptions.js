const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../secrets.env') });

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quorafaq';
console.log('Connecting to database...');

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected successfully.');
    const users = await mongoose.connection.db.collection('users').find({}).toArray();

    console.log(`Found ${users.length} total users in DB:\n`);
    users.forEach(u => {
      console.log(`User: ${u.username || u.email || u._id}`);
      console.log(`- pushSubscription:`, u.pushSubscription);
      console.log(`- fcmTokens:`, u.fcmTokens);
      console.log(`- preferences:`, u.preferences);
      console.log('--------------------------------------------');
    });

    process.exit(0);
  })
  .catch(err => {
    console.error('Database connection or query error:', err);
    process.exit(1);
  });
