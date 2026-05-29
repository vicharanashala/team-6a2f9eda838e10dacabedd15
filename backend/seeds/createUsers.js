const mongoose = require('mongoose');
const User = require('../models/User');

const users = [
  {
    username: 'admin',
    email: 'admin@faqsite.local',
    password: 'admin123',
    displayName: 'Administrator',
    bio: 'Site administrator with full access',
    role: 'admin',
    reputation: 10000,
    badges: ['Founder', 'Administrator'],
    isBanned: false
  },
  {
    username: 'moderator',
    email: 'moderator@faqsite.local',
    password: 'mod12345',
    displayName: 'Senior Moderator',
    bio: 'Community moderator',
    role: 'moderator',
    reputation: 5000,
    badges: ['Moderator', 'Helper'],
    isBanned: false
  },
  {
    username: 'user',
    email: 'user@faqsite.local',
    password: 'user12345',
    displayName: 'Regular Member',
    bio: 'Active community member',
    role: 'user',
    reputation: 250,
    badges: ['Contributor'],
    isBanned: false
  }
];

async function seed() {
  try {
    await mongoose.connect('mongodb://localhost:27017/quorafaq');
    console.log('Connected to MongoDB');

    for (const u of users) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log('User already exists:', u.username);
      } else {
        await User.create(u);
        console.log('Created user:', u.username);
      }
    }

    console.log('\n--- Credentials ---');
    console.log('Admin:     admin@faqsite.local / admin123');
    console.log('Moderator: moderator@faqsite.local / mod12345');
    console.log('User:      user@faqsite.local / user12345');

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

seed();