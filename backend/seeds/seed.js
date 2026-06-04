require('dotenv').config({ path: require('path').join(__dirname, '../../secrets.env') });
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const User = require('../models/User');
const FAQ = require('../models/FAQ');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const Tag = require('../models/Tag');
const Category = require('../models/Category');

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

const seed = async () => {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    // Read metadata and FAQs from project root
    const metadataPath = path.join(__dirname, '..', '..', 'metadata.json');
    const faqsPath = path.join(__dirname, '..', '..', 'faqs-complete.json');
    const integrityPaths = [
      path.join(__dirname, '..', '..', '.integrity'),
      path.join(__dirname, '..', '..', '..', '.integrity'),
    ];
    const integrityPath = integrityPaths.find(p => fs.existsSync(p) && fs.statSync(p).isFile());

    // Verify integrity of seed data if checksum file exists
    if (fs.existsSync(integrityPath)) {
      const integrityData = fs.readFileSync(integrityPath, 'utf-8');
      const seedFiles = [
        { path: metadataPath, name: 'metadata.json' },
        { path: faqsPath, name: 'faqs-complete.json' },
      ];
      let allValid = true;
      for (const file of seedFiles) {
        const content = fs.readFileSync(file.path);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const expectedLine = integrityData.split('\n').find(l => l.includes(file.name));
        if (expectedLine) {
          const expectedHash = expectedLine.split(' ')[0];
          if (hash !== expectedHash) {
            console.error(`Integrity check FAILED for ${file.name}`);
            console.error(`  Expected: ${expectedHash}`);
            console.error(`  Got:      ${hash}`);
            allValid = false;
          } else {
            console.log(`Integrity check PASSED for ${file.name}`);
          }
        }
      }
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const faqItems = JSON.parse(fs.readFileSync(faqsPath, 'utf-8'));

    // Clean all mock questions, answers, tags, and FAQs
    console.log('Cleaning mock database entries...');
    await Promise.all([
      FAQ.deleteMany({}),
      Question.deleteMany({}),
      Answer.deleteMany({}),
      Tag.deleteMany({}),
      Category.deleteMany({}),
    ]);

    console.log('Seeding categories...');
    const categoriesToSeed = [];
    let orderIndex = 0;
    for (const [catId, catName] of Object.entries(metadata.categories)) {
      categoriesToSeed.push({
        name: catName,
        icon: '📌',
        order: orderIndex++,
      });
    }
    await Category.insertMany(categoriesToSeed);
    console.log('Categories seeded successfully');

    // Keep real users (who registered via normal signup or Google sign-in)
    // We only delete users who are part of our previous mock users list or duplicate admins.
    const mockUsernames = ['alex_rivera', 'priya_patel', 'kabir_singh', 'ananya_coder', 'shannu_dev', 'rohan_mehta'];
    const adminUsername = process.env.ADMIN_USERNAME || 'prashnasarathi';

    await User.deleteMany({
      $or: [
        { username: { $in: mockUsernames } },
        { username: adminUsername }
      ]
    });

    // Check if admin user already exists, if not, create it
    let admin = await User.findOne({ username: adminUsername });
    if (!admin) {
      admin = await User.create({
        username: adminUsername,
        email: process.env.ADMIN_EMAIL || 'faqportal.in@gmail.com',
        password: process.env.ADMIN_PASSWORD || 'prashnasarathi123',
        displayName: process.env.ADMIN_DISPLAY_NAME || 'Prashnasarathi',
        role: 'admin',
        reputation: 100,
      });
      console.log('Created clean Admin user:', adminUsername);
    } else {
      console.log('Admin user already exists, preserved.');
    }

    console.log('Seeding standard FAQ categories and items...');

    // Group FAQ items by categoryId
    const grouped = {};
    for (const item of faqItems) {
      const catId = item.categoryId;
      if (!grouped[catId]) {
        grouped[catId] = { items: [] };
      }
      grouped[catId].items.push({
        question: item.question,
        answer: item.answer,
        order: grouped[catId].items.length,
        isPublished: true,
      });
    }

    // Create FAQ pages from metadata, in specified category order
    const faqPages = [];
    for (const [catId, catName] of Object.entries(metadata.categories)) {
      const group = grouped[catId];
      if (!group) continue;

      faqPages.push({
        title: catName,
        slug: slugify(catName),
        description: `Frequently asked questions about ${catName.toLowerCase()}`,
        category: catName,
        icon: 'help-circle',
        tags: catName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
        isOfficial: true,
        items: group.items,
      });
    }

    await FAQ.insertMany(faqPages);

    console.log('Database cleaned and standard FAQs seeded successfully!');
    console.log(`Remaining Users: ${await User.countDocuments()}`);
    console.log(`FAQs: ${await FAQ.countDocuments()}`);
    console.log(`Questions: ${await Question.countDocuments()}`);
    console.log(`Answers: ${await Answer.countDocuments()}`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
