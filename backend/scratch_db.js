const mongoose = require('mongoose');
const config = require('./config/index');
const User = require('./models/User');
const FAQ = require('./models/FAQ');
const Question = require('./models/Question');
const Answer = require('./models/Answer');
const Category = require('./models/Category');

async function run() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("Connected to MongoDB.");

    const word = "idiot";
    console.log(`Searching for "${word}"...`);

    const users = await User.find({ $or: [
      { username: { $regex: word, $options: 'i' } },
      { displayName: { $regex: word, $options: 'i' } },
      { bio: { $regex: word, $options: 'i' } }
    ]});
    console.log(`Users matching "${word}":`, users);

    const questions = await Question.find({ $or: [
      { title: { $regex: word, $options: 'i' } },
      { body: { $regex: word, $options: 'i' } }
    ]});
    console.log(`Questions matching "${word}":`, questions);

    const answers = await Answer.find({ body: { $regex: word, $options: 'i' } });
    console.log(`Answers matching "${word}":`, answers);

    const faqs = await FAQ.find({ $or: [
      { title: { $regex: word, $options: 'i' } },
      { description: { $regex: word, $options: 'i' } },
      { "items.question": { $regex: word, $options: 'i' } },
      { "items.answer": { $regex: word, $options: 'i' } }
    ]});
    console.log(`FAQs matching "${word}":`, faqs);

    const vinsWord = "vins";
    console.log(`Searching for "${vinsWord}"...`);
    const qVins = await Question.find({ $or: [
      { title: { $regex: vinsWord, $options: 'i' } },
      { body: { $regex: vinsWord, $options: 'i' } }
    ]});
    console.log(`Questions matching "${vinsWord}":`, qVins.map(q => q.title));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
