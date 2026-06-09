const { searchAll } = require('../services/searchService');
const { recordSearch, recordSearchSuccess } = require('../services/analyticsService');
const { getRedis } = require('../config/redis');

const sanitizeSearchQuery = (queryStr) => {
  if (typeof queryStr !== 'string') return '';
  return queryStr.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "");
};

exports.search = async (req, res, next) => {
  try {
    const { q, tags, type, page = 1, limit = 20 } = req.query;
    const sanitizedQ = sanitizeSearchQuery(q);
    if (!sanitizedQ && !tags) {
      return res.json({ results: [], total: 0, suggestions: [] });
    }

    const cacheKey = `search:${sanitizedQ}:${tags}:${type}:${page}:${limit}`;

    const redis = getRedis();
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    if (sanitizedQ) {
      await recordSearch(sanitizedQ);
    }

    const result = await searchAll({
      query: sanitizedQ,
      tags: tags ? tags.split(',') : [],
      type,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    if (result.total > 0 && sanitizedQ) {
      await recordSearchSuccess(sanitizedQ);
    }

    let suggestions = [];
    try {
      const raw = await redis.lrange('search:suggestions', 0, 9);
      suggestions = raw.map(r => JSON.parse(r));
    } catch (_) {}

    if (sanitizedQ && sanitizedQ.length >= 3) {
      try {
        const suggestionsKey = 'search:suggestions';
        const exists = await redis.lpos(suggestionsKey, JSON.stringify({ query: sanitizedQ }));
        if (exists === null) {
          await redis.lpush(suggestionsKey, JSON.stringify({ query: sanitizedQ, count: 1, timestamp: Date.now() }));
          await redis.ltrim(suggestionsKey, 0, 99);
        }
      } catch (_) {}
    }

    const response = { ...result, suggestions };
    redis.setex(cacheKey, 60, JSON.stringify(response)).catch(() => {});
    res.json(response);
  } catch (err) {
    next(err);
  }
};

exports.getSuggestions = async (req, res) => {
  try {
    const redis = getRedis();
    const raw = await redis.lrange('search:suggestions', 0, 9);
    const suggestions = raw.map(r => JSON.parse(r));
    res.json({ suggestions });
  } catch (_) {
    res.json({ suggestions: [] });
  }
};

const systemInstructions = `You are PrashnaSarathi, an AI-powered search and knowledge discovery assistant for a crowd-sourced FAQ platform.
Your mission is to help users find accurate, relevant, and trustworthy information in the shortest possible time.
You are a search assistant first and a conversational assistant second.
Your purpose is to reduce search effort, reduce duplicate questions, and help users quickly discover answers from the platform's collective knowledge.

## KNOWLEDGE ACCESS
You may search and retrieve information from all approved platform knowledge sources.
Always search across all available knowledge sources before responding.
Do not limit yourself to exact keyword matching.
Use semantic understanding, intent recognition, and contextual matching to identify the most relevant information.

## CORE OBJECTIVES
1. Help users find answers quickly.
2. Minimize the time users spend searching.
3. Surface the most relevant information first.
4. Reduce duplicate questions.
5. Recommend related resources when useful.
6. Present information clearly and concisely.
7. Maintain accuracy and trustworthiness.

## QUERY HANDLING
Treat every message as a search query.
Understand: Natural language, Voice queries, Follow-up questions, Misspellings, Grammar mistakes, Informal language, Abbreviations, Partial queries, Voice transcription errors.
Infer user intent whenever possible.
Voice and text queries must be treated equally. Ignore common filler words.

## SOURCE PRIORITY
When multiple answers exist, prioritize:
1. Verified FAQs
2. Official documentation
3. Official announcements
4. Moderator-approved answers
5. Highly rated community answers
6. Community contributions

## PRIVACY AND DATA PROTECTION
Protect user privacy at all times. Never reveal: Personal information, Private user data, Email addresses, Phone numbers, Passwords, Authentication tokens, Internal identifiers, Private submissions, Draft content, Hidden records, Administrative data, Sensitive metadata.

## NAMES AND ATTRIBUTION
Display names only when publicly visible or user has permission. When uncertain, do not reveal names.

## ACCURACY RULES
Only provide information that exists within available knowledge sources. Never invent/assume/fabricate information. If information cannot be found, clearly state:
"No matching information was found in the available knowledge sources."
Then suggest related topics if available.

## RESPONSE STYLE
Responses must be: Fast, Helpful, Accurate, Concise, Search-focused, Easy to understand. Avoid unnecessary conversation. Avoid lengthy introductions. Present the answer first.

## RESPONSE FORMAT
When information is found:
Status: Success
Answer: <best answer>
Source: <FAQ | Documentation | Announcement | Community Answer | Guide>
Related Topics:
* Topic 1
* Topic 2
* Topic 3

When information is not found:
Status: Not Found
Message: No matching information was found in the available knowledge sources.
Related Topics:
* Topic 1
* Topic 2
* Topic 3

## OFFENSIVE CONTENT
If a query contains abusive, hateful, discriminatory, sexual, violent, or inappropriate content:
Return ONLY the following JSON object:
{
"status": "blocked",
"reason": "offensive",
"message": "Please use respectful and appropriate language."
}

## SPAM
If a query contains gibberish, random characters, meaningless text, repeated words, or obvious spam:
Return ONLY the following JSON object:
{
"status": "blocked",
"reason": "spam",
"message": "Please enter a meaningful search query."
}
`;

exports.searchAI = async (req, res, next) => {
  try {
    const { q, currentUrl, pageTitle } = req.query;
    const sanitizedQ = q ? q.trim().substring(0, 100).replace(/[\u0000-\u001F\u007F-\u009F]/g, "").replace(/[<>]/g, "") : '';
    
    if (!sanitizedQ) {
      return res.json({
        status: "Not Found",
        message: "No matching information was found in the available knowledge sources.",
        relatedTopics: []
      });
    }

    // 1. Fetch relevant documents via searchAll (FAQs, questions, users)
    const searchResult = await searchAll({
      query: sanitizedQ,
      page: 1,
      limit: 10
    });

    const documents = [];
    const Answer = require('../models/Answer');

    for (const result of (searchResult.results || [])) {
      if (result._type === 'faq') {
        documents.push(`[Source: FAQ] Title: ${result.faqTitle} | Item Question: ${result.question} | Item Answer: ${result.answer}`);
      } else if (result._type === 'question') {
        // Fetch answers for this question to provide rich context
        const answers = await Answer.find({ questionId: result.id, isDeleted: false })
          .populate('author', 'username')
          .lean();
        const answersText = answers.map(a => `Answer by ${a.author?.username || 'user'}: ${a.body}`).join('\n');
        documents.push(`[Source: Community Question] Title: ${result.title} | Details: ${result.body} | Answers:\n${answersText || 'No answers yet'}`);
      }
    }

    // 2. Build the context and user prompt
    const knowledgeContext = documents.length > 0 
      ? documents.map((doc, idx) => `Document [${idx + 1}]:\n${doc}`).join('\n\n')
      : "No documents found.";

    let pageContextStr = "";
    if (currentUrl || pageTitle) {
      pageContextStr = `CURRENT SITE VIEWING CONTEXT:\n- Active URL: ${currentUrl || 'Unknown'}\n- Page Title: ${pageTitle || 'Unknown'}\n\n`;
    }

    const userPrompt = `
${systemInstructions}

---
${pageContextStr}APPROVED PLATFORM KNOWLEDGE SOURCES FOR QUERY "${sanitizedQ}":
${knowledgeContext}
---

User Query: "${sanitizedQ}"

Generate the response matching the specified guidelines. Do not output anything outside the requested formats.
`;

    // 3. Call Gemini API
    const axios = require('axios');
    const apiKey = process.env.GEMINI_API;
    
    if (!apiKey) {
      console.warn("GEMINI_API key is missing");
      return res.json({
        status: "Not Found",
        message: "No matching information was found in the available knowledge sources (AI Search Assistant is currently unconfigured).",
        relatedTopics: []
      });
    }

    const modelsToTry = [
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash',
      'gemini-3.5-flash',
      'gemini-2.0-flash'
    ];

    let aiResponse = "";
    let lastErrorMsg = "";
    let lastErrorStatus = null;

    for (const modelName of modelsToTry) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{
          parts: [{ text: userPrompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        }
      };

      try {
        console.log(`Trying Gemini model: ${modelName}`);
        const response = await axios.post(geminiUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });
        
        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          aiResponse = response.data.candidates[0].content.parts[0].text;
          console.log(`Gemini model ${modelName} succeeded!`);
          break; // Exit the loop on success
        } else {
          console.warn(`Gemini model ${modelName} returned empty response`);
        }
      } catch (apiErr) {
        lastErrorStatus = apiErr.response?.status;
        lastErrorMsg = apiErr.response?.data?.error?.message || apiErr.message;
        console.error(`Gemini model ${modelName} failed [${lastErrorStatus}]:`, lastErrorMsg);
      }
    }

    if (!aiResponse) {
      console.error("All Gemini models failed. Last error:", lastErrorMsg);
      return res.json({
        status: "Not Found",
        answer: "The AI assistant is currently unavailable. Please use the search results below.",
        source: "System",
        relatedTopics: []
      });
    }

    // 4. Parse output
    const cleanResponse = aiResponse.trim();
    
    // Check if it returned a blocked/spam JSON
    if (cleanResponse.startsWith('{') && cleanResponse.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanResponse);
        if (parsed.status === 'blocked') {
          return res.json(parsed);
        }
      } catch (_) {}
    }
    
    // Sometimes models wrap JSON in markdown blocks
    if (cleanResponse.includes('```json') || cleanResponse.includes('```')) {
      const jsonMatch = cleanResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.status === 'blocked') {
            return res.json(parsed);
          }
        } catch (_) {}
      }
    }

    // Parse standard Success / Not Found response lines
    const lines = cleanResponse.split('\n');
    let status = "Not Found";
    let source = "";
    let relatedTopics = [];
    
    let captureAnswer = false;
    let answerLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().startsWith('status:')) {
        status = line.substring(7).trim();
        captureAnswer = false;
      } else if (line.toLowerCase().startsWith('answer:')) {
        captureAnswer = true;
        answerLines.push(line.substring(7).trim());
      } else if (line.toLowerCase().startsWith('message:')) {
        captureAnswer = true;
        answerLines.push(line.substring(8).trim());
      } else if (line.toLowerCase().startsWith('source:')) {
        captureAnswer = false;
        source = line.substring(7).trim();
      } else if (line.toLowerCase().startsWith('related topics:')) {
        captureAnswer = false;
      } else if (line.startsWith('*') && !captureAnswer) {
        relatedTopics.push(line.substring(1).trim());
      } else if (captureAnswer) {
        // If we hit another key format line, stop capturing answer
        if (line.toLowerCase().startsWith('source:') || line.toLowerCase().startsWith('related topics:')) {
          captureAnswer = false;
          if (line.toLowerCase().startsWith('source:')) {
            source = line.substring(7).trim();
          }
        } else {
          answerLines.push(line);
        }
      }
    }

    const finalAnswer = answerLines.join('\n').trim();

    return res.json({
      status,
      answer: finalAnswer || cleanResponse,
      source: source || "Documentation",
      relatedTopics: relatedTopics.length > 0 ? relatedTopics : []
    });

  } catch (err) {
    next(err);
  }
};

exports.transcribe = async (req, res, next) => {
  try {
    const apiKey = process.env.GEMINI_API;
    if (!apiKey) {
      console.warn("GEMINI_API key is missing for transcription");
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    // Read the raw binary audio data from stream
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    if (audioBuffer.length === 0) {
      return res.json({ text: "" });
    }

    const base64Data = audioBuffer.toString('base64');
    // Default to audio/webm since we expect webm from MediaRecorder
    const mimeType = req.headers['content-type'] || 'audio/webm';

    const axios = require('axios');
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ];

    let transcription = "";

    for (const modelName of modelsToTry) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: mimeType.split(';')[0], // strip any boundary/params
                data: base64Data
              }
            },
            {
              text: "Please transcribe this audio into plain English text. Correct any spelling or phonetic errors based on the context of the platform PrashnaSarathi. If the user mentions names or abbreviations like 'vins', 'vicharanashala', 'samagama', 'spurti', 'yaksha', transcribe them exactly as written here. Output ONLY the raw transcribed text. Do not add any conversational replies, explanations, or markdown formatting."
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1
        }
      };

      try {
        console.log(`Trying Gemini model: ${modelName} for transcription`);
        const response = await axios.post(geminiUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          transcription = text.trim();
          console.log(`Gemini transcription succeeded with model ${modelName}:`, transcription);
          break;
        }
      } catch (err) {
        console.error(`Gemini transcription failed with model ${modelName}:`, err.response?.data?.error?.message || err.message);
      }
    }

    res.json({ text: transcription });
  } catch (err) {
    next(err);
  }
};

