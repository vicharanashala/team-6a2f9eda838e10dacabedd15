const mongoose = require('mongoose');
const User = require('../models/User');

const users = [
  {
    username: 'admin',
    email: 'admin@quorafaq.com',
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
    email: 'moderator@quorafaq.com',
    password: 'mod12345',
    displayName: 'Senior Moderator',
    bio: 'Community moderator',
    role: 'moderator',
    reputation: 5000,
    badges: ['Moderator', 'Helper'],
    isBanned: false
  },
  {
    username: 'student',
    email: 'student@quorafaq.com',
    password: 'student123',
    displayName: 'Regular Member',
    bio: 'Active community member',
    role: 'user',
    reputation: 250,
    badges: ['Contributor'],
    isBanned: false
  },
  {
    username: 'alice',
    email: 'alice@quorafaq.com',
    password: 'alice123',
    displayName: 'Alice Johnson',
    bio: 'Computer Science student',
    role: 'user',
    reputation: 100,
    badges: ['Newcomer'],
    isBanned: false
  },
  {
    username: 'bob',
    email: 'bob@quorafaq.com',
    password: 'bob123',
    displayName: 'Bob Smith',
    bio: 'Engineering student',
    role: 'user',
    reputation: 150,
    badges: ['Curious Learner'],
    isBanned: false
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quorafaq');
    console.log('Connected to MongoDB');

    const Question = require('../models/Question');
    const oldToNewIdMap = new Map();

    // First pass: find existing users and build a map of old->new IDs for questions
    for (const u of users) {
      const existingByEmail = await User.findOne({ email: u.email });
      const existingByUsername = await User.findOne({ username: u.username });

      if (existingByEmail || existingByUsername) {
        // Use the email match as primary
        const existing = existingByEmail || existingByUsername;
        console.log('User already exists:', u.username, '- using existing user ID:', existing._id);

        // If there's a username match that's different from email match, update question authors
        if (existingByUsername && existingByUsername._id.toString() !== existing._id.toString()) {
          oldToNewIdMap.set(existingByUsername._id.toString(), existing._id.toString());
        }
      } else {
        await User.create(u);
        console.log('Created user:', u.username);
      }
    }

    // Second pass: update question author IDs
    for (const [oldId, newId] of oldToNewIdMap) {
      const result = await Question.updateMany(
        { author: oldId },
        { $set: { author: newId } }
      );
      if (result.modifiedCount > 0) {
        console.log('  Migrated', result.modifiedCount, 'questions from', oldId, 'to', newId);
      }
    }

    console.log('\n--- Credentials ---');
    console.log('Admin:     admin@quorafaq.com / admin123');
    console.log('Moderator: moderator@quorafaq.com / mod12345');
    console.log('Student:   student@quorafaq.com / student123');
    console.log('Alice:     alice@quorafaq.com / alice123');
    console.log('Bob:       bob@quorafaq.com / bob123');

    await mongoose.disconnect();
    console.log('\nDone!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

seed();