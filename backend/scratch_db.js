const mongoose = require('mongoose');
const config = require('./config/index');
const Category = require('./models/Category');

async function run() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("Connected to MongoDB.");
    const cats = await Category.find();
    console.log("Categories found:", cats);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
