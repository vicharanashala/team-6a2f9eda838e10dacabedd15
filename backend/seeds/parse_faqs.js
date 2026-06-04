const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync(path.join(__dirname, 'raw_faqs.txt'), 'utf8');

const categories = {
  '1': 'About the internship',
  '2': 'Timing and dates',
  '3': 'NOC (No Objection Certificate)',
  '4': 'Selection, Offer Letter, and Certificate',
  '5': 'Work, Mentorship, and Projects',
  '6': 'Code of Conduct — Communication Channels',
  '7': 'Interviews Related',
  '8': 'Certificate',
  '9': 'Rosetta — Your Internship Journal',
  '10': 'Phase 1 — Coursework, ViBe LMS, and Live Sessions',
  '11': 'Spurti Points',
  '12': 'Yaksha Chat Related',
  '13': 'ViBe Platform',
  '14': 'Team Formation'
};

const lines = raw.split(/\r?\n/);
const faqs = [];
let currentCategoryName = '';
let currentCategoryId = null;

let tempItem = null;
let answerStarted = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  if (line.startsWith('____')) {
    continue;
  }

  // Check if line represents a category title
  const catMatch = line.match(/^(\d+)\.\s+(.+)$/);
  if (catMatch && categories[catMatch[1]]) {
    const matchedTitle = catMatch[2].trim().toLowerCase();
    const expectedTitle = categories[catMatch[1]].toLowerCase();
    if (matchedTitle === expectedTitle) {
      currentCategoryId = parseInt(catMatch[1]);
      currentCategoryName = categories[catMatch[1]];
      if (tempItem) {
        faqs.push(tempItem);
        tempItem = null;
        answerStarted = false;
      }
      continue;
    }
  }

  // Check if line starts a QA pair
  const qaMatch = line.match(/^(\d+\.\d+)\s+(.+)$/);
  if (qaMatch) {
    if (tempItem) {
      faqs.push(tempItem);
    }
    const faqId = qaMatch[1];
    const catNum = faqId.split('.')[0];
    currentCategoryId = parseInt(catNum);
    currentCategoryName = categories[catNum] || 'General';

    const textAfterId = qaMatch[2].trim();
    let question = '';
    let answer = '';
    const qMarkIdx = textAfterId.indexOf('?');
    if (qMarkIdx !== -1) {
      question = textAfterId.substring(0, qMarkIdx + 1).trim();
      answer = textAfterId.substring(qMarkIdx + 1).trim();
      answerStarted = true;
    } else {
      question = textAfterId;
      answer = '';
      answerStarted = false;
    }

    tempItem = {
      faqId,
      categoryId: currentCategoryId,
      categoryName: currentCategoryName,
      question,
      answer,
      version: "v21.0.0",
      lastUpdated: "2026-06-02T22:00:00+05:30"
    };
  } else {
    // This line belongs to the current QA answer body or question continuation
    if (tempItem) {
      if (answerStarted) {
        if (tempItem.answer) {
          tempItem.answer += '\n' + line;
        } else {
          tempItem.answer = line;
        }
      } else {
        const qMarkIdx = line.indexOf('?');
        if (qMarkIdx !== -1) {
          tempItem.question += ' ' + line.substring(0, qMarkIdx + 1).trim();
          tempItem.answer = line.substring(qMarkIdx + 1).trim();
          answerStarted = true;
        } else {
          tempItem.question += ' ' + line;
        }
      }
    }
  }
}

if (tempItem) {
  faqs.push(tempItem);
}

// Clean up questions & answers
for (const faq of faqs) {
  faq.question = faq.question.replace(/\s+/g, ' ').trim();
  faq.answer = faq.answer.trim();
}

console.log(`Successfully parsed ${faqs.length} FAQs!`);
const outputPath = path.join(__dirname, '..', '..', 'faqs-complete.json');
fs.writeFileSync(outputPath, JSON.stringify(faqs, null, 2), 'utf8');
console.log(`Written to ${outputPath}`);
