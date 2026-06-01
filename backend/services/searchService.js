const { getES } = require('../config/elasticsearch');

const INDEX_QUESTIONS = 'questions';
const INDEX_FAQS = 'faqs';
const INDEX_FAQ_ITEMS = 'faq_items';
const INDEX_USERS = 'users';

const ensureIndex = async (index, body) => {
  const es = getES();
  const exists = await es.indices.exists({ index });
  if (!exists) {
    await es.indices.create({ index, body });
  }
};

const initIndices = async () => {
  await ensureIndex(INDEX_QUESTIONS, {
    settings: { analysis: { analyzer: { default: { type: 'standard' } } } },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        title: { type: 'text', analyzer: 'standard' },
        body: { type: 'text', analyzer: 'standard' },
        tags: { type: 'keyword' },
        author: { type: 'keyword' },
        authorName: { type: 'text' },
        upvotes: { type: 'integer' },
        answerCount: { type: 'integer' },
        viewCount: { type: 'integer' },
        createdAt: { type: 'date' },
        status: { type: 'keyword' },
        isFAQ: { type: 'boolean' },
        resolvedAt: { type: 'date' },
      },
    },
  });

  await ensureIndex(INDEX_FAQS, {
    mappings: {
      properties: {
        id: { type: 'keyword' },
        title: { type: 'text', analyzer: 'standard' },
        description: { type: 'text' },
        category: { type: 'keyword' },
        tags: { type: 'keyword' },
        isOfficial: { type: 'boolean' },
        createdAt: { type: 'date' },
      },
    },
  });

  await ensureIndex(INDEX_FAQ_ITEMS, {
    settings: {
      analysis: {
        analyzer: {
          default: { type: 'standard' },
        },
      },
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        faqId: { type: 'keyword' },
        faqTitle: { type: 'text' },
        question: { type: 'text', analyzer: 'standard' },
        answer: { type: 'text', analyzer: 'standard' },
        tags: { type: 'keyword' },
        isPublished: { type: 'boolean' },
        createdAt: { type: 'date' },
      },
    },
  });

  await ensureIndex(INDEX_USERS, {
    mappings: {
      properties: {
        id: { type: 'keyword' },
        username: { type: 'text', analyzer: 'standard' },
        displayName: { type: 'text' },
        bio: { type: 'text' },
        reputation: { type: 'integer' },
        role: { type: 'keyword' },
      },
    },
  });
};

const indexQuestion = async (question) => {
  try {
    const es = getES();
    await es.index({
      index: INDEX_QUESTIONS,
      id: question._id.toString(),
      body: {
        id: question._id,
        title: question.title,
        body: question.body,
        tags: question.tagNames,
        author: question.author?._id || question.author,
        authorName: question.author?.displayName || question.author?.username || '',
        upvotes: question.upvotes,
        answerCount: question.answerCount,
        viewCount: question.viewCount,
        createdAt: question.createdAt,
        status: question.status,
        isFAQ: question.isFAQ || false,
        resolvedAt: question.resolvedAt || null,
      },
    });
  } catch (err) {
    console.error('Index question error:', err.message);
  }
};

const indexFAQ = async (faq) => {
  try {
    const es = getES();
    await es.index({
      index: INDEX_FAQS,
      id: faq._id.toString(),
      body: {
        id: faq._id,
        title: faq.title,
        description: faq.description,
        category: faq.category,
        tags: faq.tags,
        isOfficial: faq.isOfficial,
        createdAt: faq.createdAt,
      },
    });

    if (faq.items && faq.items.length > 0) {
      for (const item of faq.items) {
        await es.index({
          index: INDEX_FAQ_ITEMS,
          id: `${faq._id.toString()}_${item._id.toString()}`,
          body: {
            id: item._id,
            faqId: faq._id,
            faqTitle: faq.title,
            question: item.question,
            answer: item.answer,
            tags: item.tags || [],
            isPublished: item.isPublished,
            createdAt: item.createdAt,
          },
        });
      }
    }
  } catch (err) {
    console.error('Index FAQ error:', err.message);
  }
};

const indexFAQItem = async (faq, item) => {
  try {
    const es = getES();
    await es.index({
      index: INDEX_FAQ_ITEMS,
      id: `${faq._id.toString()}_${item._id.toString()}`,
      body: {
        id: item._id,
        faqId: faq._id,
        faqTitle: faq.title,
        question: item.question,
        answer: item.answer,
        tags: item.tags || [],
        isPublished: item.isPublished,
        createdAt: item.createdAt,
      },
    });
  } catch (err) {
    console.error('Index FAQ item error:', err.message);
  }
};

const deleteFAQItemIndex = async (faqId, itemId) => {
  try {
    const es = getES();
    await es.delete({ index: INDEX_FAQ_ITEMS, id: `${faqId.toString()}_${itemId.toString()}` });
  } catch (_) {}
};

const deleteFAQItemsByFAQId = async (faqId) => {
  try {
    const es = getES();
    await es.deleteByQuery({
      index: INDEX_FAQ_ITEMS,
      body: { query: { term: { faqId: faqId.toString() } } },
    });
  } catch (_) {}
};

const indexUser = async (user) => {
  try {
    const es = getES();
    await es.index({
      index: INDEX_USERS,
      id: user._id.toString(),
      body: {
        id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        bio: user.bio || '',
        reputation: user.reputation || 0,
        role: user.role || 'user',
      },
    });
  } catch (err) {
    console.error('Index user error:', err.message);
  }
};

const searchAll = async ({ query, tags, type, page = 1, limit = 20 }) => {
  try {
    const es = getES();
    const must = [];
    const filter = [];

    // Strict tab routing: each tab targets only its own index/indices
    let indices;
    if (type === 'questions') {
      indices = INDEX_QUESTIONS;
    } else if (type === 'faqs') {
      indices = [INDEX_FAQS, INDEX_FAQ_ITEMS];
    } else if (type === 'users') {
      indices = INDEX_USERS;
    } else {
      // "All" tab: search across all indices
      indices = [INDEX_QUESTIONS, INDEX_FAQS, INDEX_FAQ_ITEMS, INDEX_USERS];
    }

    if (query) {
      if (type === 'users') {
        must.push({
          multi_match: {
            query,
            fields: ['username^3', 'displayName^2', 'bio'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            minimum_should_match: '2<70%',
          },
        });
      } else if (type === 'questions') {
        must.push({
          multi_match: {
            query,
            fields: ['title^3', 'body^2', 'tags', 'authorName'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            minimum_should_match: '2<70%',
          },
        });
      } else if (type === 'faqs') {
        must.push({
          multi_match: {
            query,
            fields: ['title^3', 'description^2', 'question^4', 'answer', 'tags'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            minimum_should_match: '2<70%',
          },
        });
      } else {
        // "All" tab: fuzzy search across all field names from every index
        must.push({
          multi_match: {
            query,
            fields: ['title^3', 'body^2', 'question^4', 'answer', 'description', 'tags', 'username^2', 'displayName', 'bio', 'authorName'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            minimum_should_match: '2<70%',
          },
        });
      }
    }

    if (tags && tags.length > 0) {
      filter.push({ terms: { tags } });
    }

    // Per-tab visibility filters (only restrict what must be restricted)
    if (type === 'faqs') {
      // FAQ tab: only show published FAQ items
      filter.push({
        bool: {
          should: [
            { term: { _index: INDEX_FAQS } },
            { bool: { must: [{ term: { isPublished: true } }, { term: { _index: INDEX_FAQ_ITEMS } }] } },
          ],
          minimum_should_match: 1,
        },
      });
    } else if (!type || type === '') {
      // "All" tab: show all questions (regardless of isFAQ), all FAQs, all users,
      // but only show published FAQ items
      filter.push({
        bool: {
          should: [
            { term: { _index: INDEX_QUESTIONS } },
            { term: { _index: INDEX_FAQS } },
            { term: { _index: INDEX_USERS } },
            { bool: { must: [{ term: { isPublished: true } }, { term: { _index: INDEX_FAQ_ITEMS } }] } },
          ],
          minimum_should_match: 1,
        },
      });
    }
    // "questions" and "users" tabs don't need extra filters —
    // they already target a single index

    const body = {
      from: (page - 1) * limit,
      size: limit,
      sort: type === 'users'
        ? [{ _score: 'desc' }]
        : [{ _score: 'desc' }, { createdAt: { order: 'desc' } }],
    };

    if (must.length > 0 || filter.length > 0) {
      body.query = { bool: {} };
      if (must.length > 0) body.query.bool.must = must;
      if (filter.length > 0) body.query.bool.filter = filter;
    } else {
      body.query = { match_all: {} };
    }

    const result = await es.search({ index: indices, body });

    // Map ES index names to frontend type labels
    const indexToType = {
      [INDEX_QUESTIONS]: 'question',
      [INDEX_FAQS]: 'faq',
      [INDEX_FAQ_ITEMS]: 'faq',
      [INDEX_USERS]: 'user',
    };

    let results = result.hits.hits.map(h => ({
        id: h._id,
        ...h._source,
        _type: indexToType[h._index] || 'unknown',
        score: h._score,
      }));

    if (type === 'users') {
      results.sort((a, b) => (a.displayName || a.username || '').localeCompare(b.displayName || b.username || ''));
    }

    return {
      results,
      total: result.hits.total.value,
      page,
      limit,
    };
  } catch (err) {
    console.error('Search error:', err.message);
    return { results: [], total: 0, page, limit };
  }
};

const deleteQuestionIndex = async (id) => {
  try {
    const es = getES();
    await es.delete({ index: INDEX_QUESTIONS, id: id.toString() });
  } catch (_) {}
};

const deleteFAQIndex = async (id) => {
  try {
    const es = getES();
    await es.delete({ index: INDEX_FAQS, id: id.toString() });
    await deleteFAQItemsByFAQId(id);
  } catch (_) {}
};

const reindexAllFAQs = async (faqs) => {
  const es = getES();
  for (const faq of faqs) {
    await indexFAQ(faq);
  }
  console.log(`Reindexed ${faqs.length} FAQs with items`);
};

const syncToElasticsearch = async () => {
  try {
    const es = getES();
    const Question = require('../models/Question');
    const FAQ = require('../models/FAQ');
    const User = require('../models/User');

    // Check if ES indices are empty while MongoDB has data
    const [qCount, fCount, uCount] = await Promise.all([
      es.count({ index: INDEX_QUESTIONS }).then(r => r.count).catch(() => 0),
      es.count({ index: INDEX_FAQS }).then(r => r.count).catch(() => 0),
      es.count({ index: INDEX_USERS }).then(r => r.count).catch(() => 0),
    ]);

    const [mongoQuestions, mongoFaqs, mongoUsers] = await Promise.all([
      Question.countDocuments({ isDeleted: false }),
      FAQ.countDocuments(),
      User.countDocuments(),
    ]);

    if (qCount === 0 && mongoQuestions > 0) {
      console.log(`Syncing ${mongoQuestions} questions to Elasticsearch...`);
      const questions = await Question.find({ isDeleted: false })
        .populate('author', 'username displayName avatar reputation')
        .populate('tags', 'name color');
      for (const q of questions) {
        await indexQuestion(q);
      }
      console.log(`Synced ${questions.length} questions`);
    }

    if (fCount === 0 && mongoFaqs > 0) {
      console.log(`Syncing ${mongoFaqs} FAQs to Elasticsearch...`);
      const faqs = await FAQ.find();
      for (const faq of faqs) {
        await indexFAQ(faq);
      }
      console.log(`Synced ${faqs.length} FAQs with items`);
    }

    if (uCount !== mongoUsers) {
      console.log(`Syncing ${mongoUsers} users to Elasticsearch...`);
      const users = await User.find();
      for (const u of users) {
        await indexUser(u);
      }
      console.log(`Synced ${users.length} users`);
    }

    if (qCount > 0 && fCount > 0 && uCount > 0) {
      console.log('Elasticsearch already in sync');
    }
  } catch (err) {
    console.error('ES sync error:', err.message);
  }
};

const seedDatabase = async () => {
  try {
    const User = require('../models/User');
    const FAQ = require('../models/FAQ');
    const Question = require('../models/Question');
    const path = require('path');
    const fs = require('fs');
    const crypto = require('crypto');

    const metadataPath = path.join(__dirname, '..', '..', 'metadata.json');
    const faqsPath = path.join(__dirname, '..', '..', 'faqs-complete.json');
    const integrityPath = [path.join(__dirname, '..', '..', '.integrity'), path.join(__dirname, '..', '..', '..', '.integrity')].find(p => fs.existsSync(p));

    if (fs.existsSync(integrityPath)) {
      const integrityData = fs.readFileSync(integrityPath, 'utf-8');
      const seedFiles = [
        { path: metadataPath, name: 'metadata.json' },
        { path: faqsPath, name: 'faqs-complete.json' },
      ];
      for (const file of seedFiles) {
        const content = fs.readFileSync(file.path);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        const expectedLine = integrityData.split('\n').find(l => l.includes(file.name));
        if (expectedLine) {
          const expectedHash = expectedLine.split(' ')[0];
          if (hash !== expectedHash) {
            console.error(`Integrity check FAILED for ${file.name}`);
          }
        }
      }
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const faqItems = JSON.parse(fs.readFileSync(faqsPath, 'utf-8'));

    const existingFaqs = await FAQ.countDocuments();
    if (existingFaqs === 0) {
      console.log('Seeding database...');
      await Promise.all([User.deleteMany({}), FAQ.deleteMany({})]);

      await User.create({
        username: 'admin',
        email: 'admin@quorafaq.com',
        password: 'admin123',
        displayName: 'Admin',
        role: 'admin',
      });

      const slugify = (text) => text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
      const grouped = {};
      for (const item of faqItems) {
        const catId = item.categoryId;
        if (!grouped[catId]) grouped[catId] = { items: [] };
        grouped[catId].items.push({ question: item.question, answer: item.answer, order: grouped[catId].items.length, isPublished: true });
      }

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
      console.log('Database seeded successfully');
    }

    console.log('Seeding additional users...');
    const seedUsers = [
      { username: 'admin', email: 'admin@quorafaq.com', password: 'admin123', displayName: 'Administrator', bio: 'Site administrator with full access', role: 'admin', reputation: 10000, badges: ['Founder', 'Administrator'], isBanned: false },
      { username: 'moderator', email: 'moderator@quorafaq.com', password: 'mod12345', displayName: 'Senior Moderator', bio: 'Community moderator', role: 'moderator', reputation: 5000, badges: ['Moderator', 'Helper'], isBanned: false },
      { username: 'student', email: 'student@quorafaq.com', password: 'student123', displayName: 'Regular Member', bio: 'Active community member', role: 'user', reputation: 250, badges: ['Contributor'], isBanned: false },
      { username: 'alice', email: 'alice@quorafaq.com', password: 'alice123', displayName: 'Alice Johnson', bio: 'Computer Science student', role: 'user', reputation: 100, badges: ['Newcomer'], isBanned: false },
      { username: 'bob', email: 'bob@quorafaq.com', password: 'bob123', displayName: 'Bob Smith', bio: 'Engineering student', role: 'user', reputation: 150, badges: ['Curious Learner'], isBanned: false },
    ];

    for (const u of seedUsers) {
      const existingByEmail = await User.findOne({ email: u.email });
      const existingByUsername = await User.findOne({ username: u.username });
      if (existingByEmail || existingByUsername) {
        const existing = existingByEmail || existingByUsername;
        if (existingByUsername && existingByUsername._id.toString() !== existing._id.toString()) {
          await Question.updateMany({ author: existingByUsername._id }, { $set: { author: existing._id } });
        }
      } else {
        await User.create(u);
      }
    }
    console.log('Users seeded successfully');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

module.exports = {
  initIndices,
  indexQuestion,
  indexFAQ,
  indexFAQItem,
  indexUser,
  searchAll,
  deleteQuestionIndex,
  deleteFAQIndex,
  deleteFAQItemIndex,
  deleteFAQItemsByFAQId,
  reindexAllFAQs,
  syncToElasticsearch,
  seedDatabase,
};
