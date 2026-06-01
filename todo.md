# PrashnaSārathi — Feature Roadmap

**Objective:** Every student should feel safe asking doubts, get answers fast, and feel their problem was genuinely solved.

---

## Currently Implemented

### Core Q&A
- [x] Ask questions (title, body, tags, anonymous option)
- [x] Answer questions (markdown, confidence levels)
- [x] Voting (upvote/downvote on questions and answers)
- [x] Accept answer (moderators/admins only, +15 rep)
- [x] Me Too button (bump question priority, real-time updates)
- [x] Solved My Doubt button (on answers, real-time updates)
- [x] Confidence levels on answers (🤔 "I think so" / 👍 "Pretty sure" / 💯 "I know this")
- [x] Duplicate detection on question creation
- [x] Question escalation (no-response after 24h)
- [x] Anonymous question asking
- [x] Real-time updates via Socket.IO (new answers, me-too, solved counts)

### FAQ System
- [x] Browse FAQ pages by category
- [x] FAQ detail with sidebar navigation
- [x] Item-level Yes/No feedback
- [x] Save/unsave FAQ pages
- [x] Official badges, categories, tags

### Search & Discovery
- [x] Full-text search across questions, FAQs, users
- [x] SearchModal (Ctrl+K or /)
- [x] Trending searches (Redis)
- [x] Search result caching (Redis 60s)
- [x] Tag browsing and filtering
- [x] Sort options (newest, active, votes, views, etc.)
- [x] Hybrid Search Engine (combines Elasticsearch standard text queries with Mongoose database regex search fallback and JS stop-word cleaning to deliver high relevance and reliability)

### User System
- [x] Registration / Login / Logout
- [x] JWT-based authentication
- [x] User profiles (avatar, bio, reputation, badges)
- [x] User profile editing (modify display name, bio, and upload custom avatars with FormData support)
- [x] Saved questions with notes and custom tags
- [x] Saved FAQs with notes and custom tags
- [x] Notification system (new answer, answer accepted, upvotes, etc.)
- [x] Role system (user, moderator, admin)
- [x] Ban/unban users (admin)

### Admin / Moderation
- [x] Admin dashboard with stats
- [x] User management (role, ban)
- [x] Flagged content view
- [x] Delete questions/answers
- [x] Verify / Mark outdated FAQ questions
- [x] Accept answer on any question

### UI/UX
- [x] Dark mode toggle (localStorage, system preference)
- [x] Student onboarding walkthrough (4-step modal)
- [x] Keyboard shortcuts (j/k navigation, / search, Esc close)
- [x] Responsive mobile layout
- [x] Rich text editor (TipTap)
- [x] Markdown rendering (GFM)
- [x] Confetti celebration on answer accepted
- [x] View count tracking
- [x] SEO structured data (JSON-LD)

### Infrastructure
- [x] Docker/Podman deployment
  - **Note:** Run `docker-compose up --build -d` to build and start services without local version conflicts.
- [x] Nginx reverse proxy
- [x] Elasticsearch full-text search
- [x] Redis caching (search results, trending)
- [x] Kafka events (optional)
- [x] Seed data integrity check

---

## Planned Features

### Phase 1: Eliminate the Fear of Asking (Foundation)

- [x] ### 1. Anonymous Question Asking
  - Toggle "Ask anonymously" when posting a question
  - Question author shows as "Anonymous Student" instead of username
  - The author can still see & interact with their own question (they're authenticated)
  - Author's identity is visible to moderators/admins only
  - *Why:* Many students hesitate to ask "dumb" questions publicly. This removes that barrier completely.

- [x] ### 2. "I Have the Same Doubt" (+1 / Me Too) Button — **IMPLEMENTED**
  - A button on every question: "Me Too (X students)"
  - Instead of asking the same question again, students just click this
  - Question gets bumped in priority when it has many "Me Too"s
  - When an answer is accepted, all "Me Too" students get a notification
  - *Why:* Eliminates duplicate questions and shows students they're not alone in their doubt

- [x] ### 3. "Solved My Doubt" Button (Distinct from Upvote) — **IMPLEMENTED**
  - Each answer gets a "Solved My Doubt" button
  - Track `solvedMyDoubtCount` separately from upvotes
  - Answers with many "solved" markers get a special badge
  - The question author gets a celebration when they mark an answer as solving their doubt
  - *Why:* Upvotes are generic ("good answer"). "Solved My Doubt" is specific — it means the student's problem is genuinely resolved.

---

## Phase 2: Give Students Clarity & Confidence

- [ ] ### 4. Doubt Resolution Dashboard (`/my-doubts`)
  - A personal dashboard showing all of a student's questions grouped:
    -  **Unanswered** — No answers yet, show escalation button
    -  **Has Answers (Unresolved)** — Answers exist but none marked as solving the doubt
    -  **Resolved** — Doubt is solved, show the accepted/solved answer
    -  **Upvoted Doubts** — Questions they clicked "Me Too" on
  - Quick stats: "You've asked X doubts, Y solved, Z unanswered"
  - *Why:* Students currently have no way to see the status of their doubts at a glance

- [x] ### 5. Answer Confidence Badge — **IMPLEMENTED**
  - When answering, the student picks a confidence level:
    - `🤔 I think so` (low confidence)
    - `👍 Pretty sure` (medium)
    - `💯 I know this` (high/verified)
  - Displayed prominently on the answer card
  - Helps questioners gauge how much to trust an answer
  - *Why:* An answer from a fellow student might be wrong — confidence signaling helps

- [ ] ### 6. "Similar Solved Doubts" Sidebar
  - When viewing a question, show a sidebar with 3-5 similar questions that have been marked as "Solved"
  - Uses the existing similar-question logic but filters to resolved ones only
  - *Why:* The student might get their answer instantly without waiting for a new response

---

## Phase 3: Engagement & Motivation

- [x] ### 7. Live Community Leaderboard — **IMPLEMENTED**
  - Live ranking of top contributors based on their resolved query counts (accepted answers and doubt solved signals).
  - Dynamically broadcasts ranking updates to all connected clients using Socket.IO events.
  - Interactive podium for the top 3 spots and tabular stats for remaining users.
  - *Why:* Motivates community participation, peer-to-peer assistance, and rewards contributors.

- [x] ### 8. Doubt Resolved Celebration — **IMPLEMENTED**
  - When a student marks an answer as "Solved My Doubt" or accepts an answer:
    - A small confetti animation (CSS only, no library needed)
    - A toast: "Your doubt has been solved by [username]!"
    - A gentle "ping" notification sound
  - *Why:* Creates a positive emotional moment — the student feels relief and accomplishment

- [ ] ### 9. "This Helped Me" Warm Feedback (separate from "Solved My Doubt")
  - A simple heart / "Thank you" button on answers
  - Sends a nice notification to the answerer: "[Student] said your answer helped them"
  - No reputation impact — purely a gratitude signal
  - *Why:* Builds community warmth and motivates students to keep answering

---

## Phase 4: Advanced Experience

- [x] ### 10. Student Onboarding Walkthrough — **IMPLEMENTED**
  - On first visit (detected by `localStorage` flag or `firstLogin`):
    - Step 1: "Welcome to PrashnaSārathi! Your doubts are welcome here."
    - Step 2: "Browse FAQs for common questions" → point to /faqs
    - Step 3: "Search before asking — your doubt might already be solved"
    - Step 4: "Ask your first question — anonymously if you prefer"
  - *Why:* New students don't know where to start — this guides them

- [x] ### 11. Dark Mode — **IMPLEMENTED**
  - Toggle in navbar or user preferences
  - CSS variables for light/dark themes
  - Persists choice in `localStorage` and user profile
  - *Why:* Students study late at night, especially during exams

- [ ] ### 12. Related Learning Resources
  - When creating/answering a question, optionally link a resource (YouTube, article, docs)
  - Displayed in a "Resources" section per question
  - Auto-suggest popular resources based on tags (via a curated mapping)
  - *Why:* Students don't just need the answer — they need to *understand* it

---

## Phase 5: Power User Features (Optional)

- [ ] ### 13. Threaded Follow-up Discussions
  - Comment threads under answers (not just flat answers)
  - Allows: "I didn't understand this part — can you elaborate?"
  - *Why:* Deeper understanding comes from conversation, not one-shot answers

- [ ] ### 14. Weekly Doubt Digest
  - Email summary: "This week in [tags you follow]: X new questions, Y answers"
  - Includes: top unanswered questions, trending topics
  - *Why:* Keeps students engaged and brings them back to help others

- [ ] ### 15. Request Answer from Contributor
  - Button on a question: "Request an answer"
  - Picks a top contributor in that tag and sends them a notification
  - The contributor must opt-in to receive requests (toggle in profile)
  - *Why:* Hard questions need experts — this connects them directly

- [ ] ### 16. PWA / Install Prompt
  - `manifest.json`, service worker for offline caching
  - Install banner on mobile
  - *Why:* Students primarily access from phones, and a native-feeling app increases engagement

---

## Implementation Status Summary

| Done? | # | Feature | Phase | Effort | Impact |
|-------|---|---------|-------|--------|--------|
| DONE | 1 | Anonymous Asking | 1 | done | High |
| DONE | 2 | "Me Too" Button | 1 | done | High |
| DONE | 3 | "Solved My Doubt" Button | 1 | done | Very High |
| | 4 | Doubt Resolution Dashboard | 2 | 3 days | Very High |
| DONE | 5 | Answer Confidence Badge | 2 | done | Medium |
| | 6 | Similar Solved Doubts Sidebar | 2 | 1 day | Medium |
| DONE | 7 | Community Leaderboard | 3 | done | High |
| DONE | 8 | Doubt Resolved Celebration | 3 | done | High |
| | 9 | "This Helped Me" Button | 3 | 1 day | Medium |
| DONE | 10 | Onboarding Walkthrough | 4 | done | High |
| DONE | 11 | Dark Mode | 4 | done | Medium |
| | 12 | Related Learning Resources | 4 | 2 days | Low-Medium |
| | 13 | Threaded Follow-up Discussions | 5 | 3-5 days | Medium |
| | 14 | Weekly Doubt Digest | 5 | 3-5 days | Medium |
| | 15 | Request Answer from Contributor | 5 | 3-5 days | Medium |
| | 16 | PWA / Install Prompt | 5 | 3-5 days | Medium |

**Completed: 9/16 features**

1. Question Draft Auto-Save
- Auto-save draft as student types (every 30s to localStorage)
- Restore draft if they accidentally close tab or navigate away
- Show "Draft saved" indicator while composing
2. Following Questions (beyond accepted answer)
- Follow a question → get notified of ALL new answers, not just accepted
- "Following" toggle on question detail page
- Email digest option for followed questions
3. Anonymous Encouragement / Thank You
- Send a private "this helped me" to an answerer without displaying publicly on the answer
- Creates positive reinforcement without cluttering the UI
- Distinct from public "This Helped Me" button
4. Question Bounty System
- Student can attach "bounty" points (from their reputation) to attract answers
- Featured at top of question list
- Expires after X days, auto-awarded to best answer
5. Professor/Instructor Verification Badge
- Moderators can mark users as "verified instructor"
- Special badge displayed next to name on answers
- Helps students trust the answer source
- [x] 6. Downvote Feedback (required)
  - When a question/answer gets a downvote, prompt the downvoter to optionally leave a reason
  - 6 predefined reasons (incorrect, incomplete, unclear, harmful, spam, other)
  - Free-text field for elaboration
  - Reason shown anonymously to the post author to help them improve
7. Quick Reaction Emojis on Answers
- Beyond upvote/downvote: 😂 funny, 🙏 helpful, ❓ unclear
- Aggregated as small icon counts below the answer
- Low-friction feedback signal
8. Search Filter Chips
- Filter questions by: unanswered, has code, recent, unanswered + no response in 24h
- "Help my question" filter = no answers + older than 24h
- One-click filter buttons above question list
Medium-Impact Quality of Life
9. Edit History on Questions/Answers
- See who edited when and what changed
- Helps transparency, reduces "my answer was changed" confusion
10. Mobile Bottom Navigation Bar
- Bottom tabs: Home, Questions, Ask, Notifications, Profile
- Standard mobile app pattern — avoids reaching for top navbar
- Better thumb-zone navigation
11. Code Syntax Highlighting
- Dedicated code block rendering with language detection
- Line numbers, copy button, dark/light theme toggle within code blocks
- Most student questions involve code
12. Question Difficulty Tags
- Easy / Medium / Hard tags on questions
- Helps other students gauge complexity, helps answerers know audience level
13. Streak / Daily Login Gamification
- Track consecutive days of visiting/asking/answering
- Weekly streak badge on profile
- Motivates habitual engagement without reputation pressure
14. Voice-to-Text for Asking
- Microphone button in question form
- Useful for students who type slowly or prefer speaking
- Especially helpful on mobile
15. Share to Groups / Friends
- Share a specific question/answer via link
- Copy link with anchor to specific answer
- Share to WhatsApp/Telegram directly from UI
16. Personal Stats Dashboard
- "This week: you asked 2 questions, got 5 answers, helped 3 students"
- "Your top answered tags: Python (7), React (4)"
- Motivates continued participation
17. Related Documentation Links
- When posting a question, auto-suggest relevant MDN/w3schools/official docs links based on tags
- Helps students self-resolve before asking
18. "No Answer Yet" Escalation Auto-Prompt
- Questions with no answers for 48h get a gentle prompt to the author
- "Still looking for an answer? Consider adding more details or simplifying your question"
- Optional re-tag or bounty suggestion

---

## Completed Search & Scoring Enhancements
- [x] **Strict 100% Relevance Scoring**: Relevance score is exactly `100%` only when the user's query matches the exact text of a question or post title. All non-exact matches are dynamically scaled relative to the highest Elasticsearch hit score and capped at a maximum of `95%` (`0.95`).
- [x] **Automatic Clean Elasticsearch Synchronization**: Full indexes are wiped, rebuilt, and populated cleanly from MongoDB data on backend server startup to prevent stale database ID links and "FAQ not found" errors.
- [x] **Search De-duplication and Multi-Match Fix**: Resolved composite ID collision bugs so search results are cleanly merged and de-duplicated.
- [x] **Direct FAQ Item Navigation & Highlighting**: Integrated hash-based URL fragments (`#itemId`) in search result routing to scroll directly to the correct FAQ card with a theme-aware ring highlight, setting a `100px` scroll margin top to prevent overlap with the sticky header.

## Completed Authentication & Onboarding Enhancements
- [x] **Resilient Google Sign-In with Offline Fallback**: Implemented an automated simulated login fallback if Firebase services are unconfigured or fail (e.g. `network-request-failed`), prompting the user to enter their email and complete sign-in seamlessly.
- [x] **MongoDB Persistence**: Stored all sign-in data (including Google OAuth and simulated flows) in MongoDB, updating or creating user profiles dynamically.
- [x] **Authentication Guards**: Protected interactive operations (voting, saving questions, answering, and visiting the community leaderboard) by redirecting unauthenticated users to `/auth?mode=login`.
- [x] **Personalized Onboarding & Quick Phase Selection**:
  - Every new user is guided through the step-by-step onboarding walkthrough to select their current internship phase (`pre`, `phase1_coursework`, etc.).
  - Existing users without a set phase are presented with a focused, non-obtrusive "Quick Phase Update" popup to select their phase without the full tutorial walkthrough.
  - Onboarding states are saved to MongoDB and synced locally in a user-specific session storage key (`phase_prompt_dismissed_${user.id}`) to avoid cross-user session leaks in multi-user test environments.
- [x] **Tag Cleanup**: Removed placeholder/dummy tags (`#vibe lms`, `#getting started`) and added a backend-level filter to retrieve only official tags or tags with associated questions (`questionCount > 0`).


### Recent Fixes

1. **"User not found" and Question Marks on Profile Page Questions**
   *Root Cause*: When loading questions posted by a user on their profile page (`GET /api/users/:username/questions`), the backend was not populating the `author` field and used a restrictive `.select()`. This caused the frontend to lack the user's name/avatar, showing a fallback `?` and linking to `/users/undefined` → “User not found”.
   *Resolution*: Updated `getUserQuestions` in `backend/controllers/userController.js` to populate `author` (username, displayName, avatar, reputation) and removed the limiting `.select()` so all needed fields are available to `QuestionCard`.

2. **Questions Not Showing in the Main Questions Tab**
   *Root Cause*: Nodemon inside the Docker container on Windows/WSL2 didn’t reload filesystem changes automatically. The previous fix was correct but the container hadn’t been restarted.
   *Resolution*: Manually restarted both the backend and frontend containers (`docker restart quorafaq-backend` and `docker restart quorafaq-frontend`). All questions are now fetched and displayed correctly.

3. **Unused Tags Page Clutter (Tags Showing 0 Questions)**
   *Root Cause*: `getTags` only filtered `questionCount > 0` when there was no search query, leaving dummy tags with zero questions visible.
   *Resolution*: Updated `backend/controllers/tagController.js` to always apply `questionCount: { $gt: 0 }`, hiding unused tags.

4. **Google Sign-In User Storage & Avatar Syncing**
   *Root Cause*: Google profile pictures were stored only in `avatarUrl`. Components like `QuestionCard` referenced `avatar`, resulting in missing avatars.
   *Resolution*: Modified `googleLogin` in `backend/controllers/authController.js` to store the picture in both `avatar` and `avatarUrl` fields.

5. **"Question Exists" Warning when Posting Different Questions**
   *Root Cause*: `findExistingQuestion` returned a match on mere tag overlap (`scopeMatch: 'tag'`), triggering duplicate warnings for unrelated questions.
   *Resolution*: Refined `backend/controllers/questionController.js` to only return matches on exact titles or high‑similarity matches (both a matching title word *and* a matching tag). Tag‑only matches no longer trigger the warning.

All code changes have been committed and pushed to `main` on GitHub. Reload the page (Ctrl+F5) to see the updates.
