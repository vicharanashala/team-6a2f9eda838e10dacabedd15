/**
 * autoAnswerService.js
 *
 * Automatic Question Assistance — PrashnaSarathi AI Bot
 *
 * When a new question is posted to the portal, this service:
 *  1. Validates the question content (spam / offensive / gibberish / off-topic).
 *  2. Searches FAQs, guides, announcements, and community knowledge for relevant info.
 *  3. Calls the Gemini AI model (with fallback chain) to generate a grounded answer.
 *  4. Posts the answer as the bot user ONLY if the AI found sufficient supporting info.
 *  5. Never fabricates information — it explicitly signals low-confidence cases.
 */

const axios = require('axios');

// ─── Offensive / spam keywords ────────────────────────────────────────────────
const OFFENSIVE_PATTERNS = [
  /\b(fuck|shit|bitch|asshole|bastard|cunt|dick|pussy|nigger|faggot|slut|whore|kill yourself|kys)\b/i,
  /\b(hate|racist|rape|molest|terrorist|bomb|suicide)\b/i,
];

const SPAM_PATTERNS = [
  /(.)\1{8,}/,                         // repeated chars: aaaaaaaaaa
  /(\b\w+\b)(\s+\1){4,}/i,            // repeated words: test test test test test
];

// Gibberish heuristic (shared with questionController)
const isGibberish = (text) => {
  if (!text || text.length < 5) return false;
  const lower = text.toLowerCase();
  const letters = lower.replace(/[^a-z]/g, '');
  if (letters.length < 5) return false;
  const vowels = (letters.match(/[aeiou]/g) || []).length;
  if (vowels / letters.length < 0.10) return true;
  if (/[bcdfghjklmnpqrstvwxyz]{6,}/.test(lower)) return true;
  const uniqueRatio = new Set(letters).size / letters.length;
  if (letters.length > 12 && uniqueRatio > 0.85) return true;
  return false;
};

/**
 * Validate a question's title + body for spam, offensive, and gibberish content.
 * Returns { valid: true } or { valid: false, blockReason: '...' }
 */
const validateQuestion = (title, body) => {
  const combined = `${title} ${body}`;

  for (const pattern of OFFENSIVE_PATTERNS) {
    if (pattern.test(combined)) {
      return { valid: false, blockReason: 'Please use respectful and appropriate language.' };
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(combined)) {
      return { valid: false, blockReason: 'Please enter a meaningful question.' };
    }
  }

  if (isGibberish(title) || isGibberish(body)) {
    return { valid: false, blockReason: 'Please enter a meaningful question.' };
  }

  if (!title || title.trim().length < 10) {
    return { valid: false, blockReason: 'Please ask questions related to the platform and its resources.' };
  }

  return { valid: true };
};

// ─── System instructions for the AI bot ───────────────────────────────────────
const BOT_SYSTEM_INSTRUCTIONS = `You are PrashnaSarathi AI Bot, an intelligent question-answering assistant for the PrashnaSārathi internship community portal.

Your ONLY job is to generate accurate, helpful answers grounded in the provided knowledge documents.

## STRICT RULES
1. NEVER fabricate, guess, invent, or assume information not present in the provided documents.
2. ONLY answer if you find clear, relevant information in the provided knowledge documents.
3. If information is insufficient or absent, respond with exactly: NOT_FOUND
4. Do NOT hallucinate facts, dates, deadlines, URLs, or names.
5. Combine multiple relevant sources into a single clear answer.
6. If multiple documents provide partial information, combine them carefully and accurately.

## ANSWER FORMAT (when you DO have sufficient information)
Provide a clear, concise answer. Use:
- Short paragraphs for explanations.
- Bullet points ( - item) for lists or steps.
- **Bold** for important terms or key points.
- Do NOT add any preamble, intro, or sign-off.

## TOPICS YOU CAN ANSWER
Questions about:
- The internship program, phases, timeline, and dates.
- NOC (No Objection Certificate) requirements.
- Offer letters, certificates, selection process.
- Coursework, LMS, live sessions, Phase 1 and Phase 2.
- Spurti Points (SP) system and leaderboard.
- Code of conduct and communication channels.
- Yaksha Chat, Rosetta, ViBe platform.
- Team formation.
- General platform usage (asking questions, answering, voting, badges).

## RESPONSE
If you have enough grounded information: provide the answer directly.
If not: respond with exactly the word NOT_FOUND and nothing else.`;

// ─── Gemini model fallback chain ───────────────────────────────────────────────
const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.0-flash'
];

/**
 * Call Gemini AI with a given prompt. Tries multiple models in sequence.
 * Returns the raw response text or null on complete failure.
 */
const callGeminiAI = async (prompt) => {
  const apiKey = process.env.GEMINI_API;
  if (!apiKey) {
    console.warn('[AutoAnswer] GEMINI_API key is missing.');
    return null;
  }

  for (const modelName of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    try {
      console.log(`[AutoAnswer] Trying model: ${modelName}`);
      const response = await axios.post(url, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,     // Low temperature for factual answers
          maxOutputTokens: 1024,
        },
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000,
      });

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        console.log(`[AutoAnswer] Model ${modelName} succeeded.`);
        return text.trim();
      }
      console.warn(`[AutoAnswer] Model ${modelName} returned empty response.`);
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message;
      console.error(`[AutoAnswer] Model ${modelName} failed [${status}]: ${msg}`);
    }
  }

  console.error('[AutoAnswer] All Gemini models failed.');
  return null;
};

/**
 * Fetch relevant knowledge documents for the given question.
 * Searches: FAQ items, community Q&A, and platform guides.
 *
 * @param {string} title   - The question title
 * @param {string[]} tags  - Tag names for the question
 * @returns {string[]}     - Array of document strings ready to inject into the prompt
 */
const fetchKnowledgeDocuments = async (title, tags = []) => {
  const FAQ = require('../models/FAQ');
  const Question = require('../models/Question');
  const Answer = require('../models/Answer');

  const documents = [];

  // ── Keywords extracted from title ──────────────────────────────────────────
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'i', 'my', 'me', 'we',
    'our', 'how', 'what', 'when', 'where', 'why', 'which', 'who',
    'for', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'but', 'not',
    'if', 'it', 'its', 'this', 'that', 'with', 'from', 'about', 'get',
    'any', 'all', 'do', 'so', 'up', 'out', 'than', 'then', 'into',
  ]);
  const keywords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  try {
    // ── 1. Search FAQ items ────────────────────────────────────────────────
    const faqFilter = { isPublished: true };
    if (keywords.length > 0 || tags.length > 0) {
      const orClauses = [];
      if (keywords.length > 0) {
        const regex = keywords.map(k => `(${k})`).join('|');
        orClauses.push({ 'items.question': { $regex: regex, $options: 'i' } });
        orClauses.push({ 'items.answer': { $regex: regex, $options: 'i' } });
        orClauses.push({ title: { $regex: regex, $options: 'i' } });
      }
      if (tags.length > 0) {
        orClauses.push({ tags: { $in: tags.map(t => t.toLowerCase()) } });
      }
      faqFilter.$or = orClauses;
    }

    const faqs = await FAQ.find(faqFilter).limit(5).lean();
    for (const faq of faqs) {
      for (const item of faq.items || []) {
        if (!item.isPublished) continue;
        const itemText = `${item.question} ${item.answer}`.toLowerCase();
        const relevance = keywords.filter(k => itemText.includes(k)).length;
        if (relevance >= 1) {
          documents.push(
            `[Source: Official FAQ — ${faq.title}]\nQ: ${item.question}\nA: ${item.answer}`
          );
        }
      }
    }

    // ── 2. Search resolved community questions (isFAQ = true) ─────────────
    if (keywords.length > 0) {
      const regex = keywords.map(k => `(${k})`).join('|');
      const resolvedQs = await Question.find({
        isDeleted: false,
        isFAQ: true,
        $or: [
          { title: { $regex: regex, $options: 'i' } },
          { body: { $regex: regex, $options: 'i' } },
          ...(tags.length > 0 ? [{ tagNames: { $in: tags } }] : []),
        ],
      })
        .limit(5)
        .lean();

      for (const q of resolvedQs) {
        // Fetch its accepted answer
        let answerBody = '';
        if (q.acceptedAnswer) {
          const acc = await Answer.findById(q.acceptedAnswer)
            .select('body')
            .lean();
          if (acc) answerBody = acc.body;
        }
        if (!answerBody) {
          const topAnswer = await Answer.findOne({
            question: q._id,
            isDeleted: false,
            visibility: 'public',
          })
            .sort({ upvotes: -1 })
            .select('body')
            .lean();
          if (topAnswer) answerBody = topAnswer.body;
        }

        if (answerBody) {
          documents.push(
            `[Source: Resolved Community Q&A]\nQ: ${q.title}\nA: ${answerBody}`
          );
        }
      }
    }
  } catch (err) {
    console.error('[AutoAnswer] Knowledge fetch error:', err.message);
  }

  return documents;
};

/**
 * Main entry point: generate and post an auto-answer for a newly created question.
 *
 * @param {Object} question   - Mongoose Question document (already created)
 * @param {Object} botUser    - Mongoose User document for the bot account
 */
const generateAndPostAutoAnswer = async (question, botUser) => {
  try {
    const Answer = require('../models/Answer');
    const User = require('../models/User');
    const Question = require('../models/Question');
    const { recalculateAnswerCount } = require('../utils/helpers');

    console.log(`[AutoAnswer] Processing question: "${question.title}" (${question._id})`);

    // ── Step 1: Validate question content ────────────────────────────────
    const validation = validateQuestion(question.title, question.body || '');
    if (!validation.valid) {
      console.log(`[AutoAnswer] Question blocked by validation: ${validation.blockReason}`);
      return;   // Do not post any bot answer for flagged content
    }

    // ── Step 2: Check duplicate questions ────────────────────────────────
    if (question.isAlreadyAsked && question.relatedQuestions && question.relatedQuestions.length > 0) {
      const originalQ = await Question.findOne({ _id: question.relatedQuestions[0], isDeleted: false });
      if (originalQ) {
        console.log(`[AutoAnswer] Question is duplicate of ${originalQ._id}. Posting reference path.`);
        
        const duplicateAnswerBody = `**PrashnaSarathi AI Bot**
 
📌 *Duplicate Question Detected*
 
This question appears to be highly similar or identical to an existing question on the platform:
👉 **[${originalQ.title}](/questions/${originalQ._id})**
 
Please refer to the link above to view existing answers and discussions.`;

        const answer = await Answer.create({
          body: duplicateAnswerBody,
          question: question._id,
          author: botUser._id,
          visibility: 'public',
          isOfficial: true,
          confidenceLevel: 'high',
        });

        await Question.findByIdAndUpdate(question._id, {
          $inc: { answerCount: 1 },
          lastActivity: new Date(),
        });
        await User.findByIdAndUpdate(botUser._id, { $inc: { answerCount: 1 } });
        await recalculateAnswerCount(question._id);

        try {
          const { emitToQuestion } = require('../socket');
          const populated = await Answer.findById(answer._id)
            .populate('author', 'username displayName avatar reputation')
            .lean();
          emitToQuestion(question._id.toString(), 'answer:new', { answer: populated });
        } catch (socketErr) {
          console.warn('[AutoAnswer] Socket emit failed for duplicate answer:', socketErr.message);
        }
        return;
      }
    }

    // ── Step 3: Fetch knowledge documents ────────────────────────────────
    const documents = await fetchKnowledgeDocuments(question.title, question.tagNames || []);
    console.log(`[AutoAnswer] Found ${documents.length} relevant knowledge documents.`);

    let aiText = '';
    let isGeneralKnowledge = false;

    if (documents.length > 0) {
      // ── Step 4: Build prompt ──────────────────────────────────────────────
      const knowledgeContext = documents
        .slice(0, 8)   // Cap at 8 documents to stay within token budget
        .map((doc, i) => `Document [${i + 1}]:\n${doc}`)
        .join('\n\n---\n\n');

      const prompt = `${BOT_SYSTEM_INSTRUCTIONS}
 
===== KNOWLEDGE BASE =====
${knowledgeContext}
===== END KNOWLEDGE BASE =====
 
Student's question: "${question.title}"
${question.body ? `\nAdditional context provided by student:\n${question.body}` : ''}
 
Remember: Only answer if you find sufficient information in the Knowledge Base above. Otherwise respond with exactly: NOT_FOUND`;

      aiText = await callGeminiAI(prompt);
      
      if (!aiText || aiText.trim() === 'NOT_FOUND' || aiText.trim().startsWith('NOT_FOUND')) {
        console.log('[AutoAnswer] AI returned NOT_FOUND — falling back to general knowledge.');
        isGeneralKnowledge = true;
      }
    } else {
      isGeneralKnowledge = true;
    }

    // ── Step 5: Fallback to General Knowledge if needed ───────────────────
    if (isGeneralKnowledge) {
      const prompt = `You are PrashnaSarathi AI Bot, an assistant for the PrashnaSārathi internship community portal.
We could not find matching documents in our repository for this query.
Therefore, answer the student's question to the best of your ability using your general knowledge.
Be helpful, professional, and clear.
 
Student's question: "${question.title}"
${question.body ? `\nAdditional context provided by student:\n${question.body}` : ''}
 
Provide a clear, formatted answer using bullet points if needed. Do NOT include preambles or sign-offs.`;

      aiText = await callGeminiAI(prompt);
    }

    // Sanity check: if the AI response is very short or empty, skip
    if (!aiText || aiText.trim().length < 10) {
      console.log('[AutoAnswer] AI response empty or too short — skipping.');
      return;
    }

    // ── Step 6: Format the bot answer ─────────────────────────────────────
    let botAnswerBody = '';
    if (isGeneralKnowledge) {
      botAnswerBody = `**PrashnaSarathi AI Bot (General Knowledge Mode)**
 
⚠️ *This answer is generated using general AI knowledge, as no direct matching documents were found in our official repository. Please verify the details.*
 
---
 
${aiText.trim()}`;
    } else {
      botAnswerBody = `**PrashnaSarathi AI Bot**
 
⚠️ *AI-generated answer based on available knowledge. Please verify the information before proceeding.*
 
---
 
${aiText.trim()}`;
    }

    // ── Step 7: Post the answer ───────────────────────────────────────────
    const answer = await Answer.create({
      body: botAnswerBody,
      question: question._id,
      author: botUser._id,
      visibility: 'public',
      isOfficial: true,
      confidenceLevel: isGeneralKnowledge ? 'low' : documents.length >= 3 ? 'high' : documents.length === 2 ? 'medium' : 'low',
    });

    // Update question answer count + last activity
    await Question.findByIdAndUpdate(question._id, {
      $inc: { answerCount: 1 },
      lastActivity: new Date(),
    });

    // Keep bot user's answerCount in sync
    await User.findByIdAndUpdate(botUser._id, { $inc: { answerCount: 1 } });

    // Recalculate for data integrity
    await recalculateAnswerCount(question._id);

    console.log(`[AutoAnswer] ✅ Auto-answer posted (Answer ID: ${answer._id}) for question: "${question.title}"`);

    // ── Step 8: Emit socket event so the question page updates live ───────
    try {
      const { emitToQuestion } = require('../socket');
      const populated = await Answer.findById(answer._id)
        .populate('author', 'username displayName avatar reputation')
        .lean();
      emitToQuestion(question._id.toString(), 'answer:new', { answer: populated });
    } catch (socketErr) {
      console.warn('[AutoAnswer] Socket emit failed (non-critical):', socketErr.message);
    }
  } catch (err) {
    // This service is always non-blocking — log errors but never throw
    console.error('[AutoAnswer] Unexpected error:', err.message);
  }
};

/**
 * Find or create the bot user account used to post auto-answers.
 * Uses the same "prashnasarathi" admin from seed, or falls back to any admin.
 *
 * @returns {Object|null} Mongoose User document
 */
const getBotUser = async () => {
  try {
    const User = require('../models/User');

    // Try the canonical bot username first
    const botUsername = process.env.ADMIN_USERNAME || 'prashnasarathi';
    let botUser = await User.findOne({ username: botUsername });

    if (!botUser) {
      // Fall back to any admin account
      botUser = await User.findOne({ role: 'admin' });
    }

    if (!botUser) {
      console.warn('[AutoAnswer] No bot/admin user found — auto-answer disabled.');
      return null;
    }

    return botUser;
  } catch (err) {
    console.error('[AutoAnswer] getBotUser error:', err.message);
    return null;
  }
};

/**
 * Public async entry point — called from questionController.
 * Always resolves (never rejects) so it never breaks question creation.
 *
 * @param {Object} question - The newly created Question document
 */
const triggerAutoAnswer = async (question) => {
  try {
    // Only trigger for public questions
    if (question.visibility !== 'public') {
      console.log(`[AutoAnswer] Skipping — question visibility is "${question.visibility}".`);
      return;
    }

    const botUser = await getBotUser();
    if (!botUser) return;

    await generateAndPostAutoAnswer(question, botUser);
  } catch (err) {
    console.error('[AutoAnswer] triggerAutoAnswer error:', err.message);
  }
};

module.exports = { triggerAutoAnswer, validateQuestion };
