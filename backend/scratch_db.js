const mongoose = require('mongoose');
const config = require('./config/index');
const { cleanupOrphanedData } = require('./utils/cleanup');

async function run() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("Connected to MongoDB.");

    await cleanupOrphanedData();

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
