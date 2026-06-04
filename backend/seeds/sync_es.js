require('dotenv').config({ path: require('path').join(__dirname, '../../secrets.env') });
const mongoose = require('mongoose');
const config = require('../config');
const { syncToElasticsearch } = require('../services/searchService');

const run = async () => {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('Connected to MongoDB');

    await syncToElasticsearch();
    console.log('Elasticsearch successfully reindexed and synced!');
    process.exit(0);
  } catch (error) {
    console.error('ES sync script error:', error);
    process.exit(1);
  }
};

run();
