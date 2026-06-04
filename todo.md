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
  - Onboarding states are saved to MongoDB and synced locally in a user-specific local storage key (`phase_prompt_dismissed_${user.id}`) to avoid cross-user session leaks in multi-user test environments and prevent the onboarding modal from repeating on new logins.
- [x] **Tag Cleanup**: Removed placeholder/dummy tags (`#vibe lms`, `#getting started`) and added a backend-level filter to retrieve only official tags or tags with associated questions (`questionCount > 0`).


### Recent Fixes

#### Latest Fixes (June 4, 2026)

1. **Admin Panel - Unban, Unsuspend, Unblock, and Un-Shadowban Controls**
   * *Bug*: When an admin suspended, blocked, or shadow banned a user, their posts remained visible or stayed hidden with no option/buttons on the admin page to lift restrictions and restore user status or content visibility.
   * *Resolution*:
     1. Updated `moderationService.js` so that banning a user updates their status to `blocked` and automatically hides all their questions and answers (`visibility: 'hidden'`).
     2. Updated `unbanUser` in `moderationService.js` and `moderateUser` in `adminController.js` to support `activate`, `unsuspend`, `unblock`, and `unshadow_ban` actions. This resets the user status to `active`, clears ban/suspension state, and restores all hidden posts back to `public` visibility.
     3. Refactored the main Users list table in the admin panel (`frontend/app/admin/page.js`) to display the user's detailed status (Banned, Shadow Banned, Suspended, Warned, Active) and added buttons to Suspend, Shadow Ban, and "Activate / Unblock" directly.

2. **Policies and Community Guidelines Addition**
   * *Request*: The user wanted to add community guidelines and platform policies to the main page and the footer.
   * *Resolution*: Created a beautiful, dedicated `/guidelines` page detailing community respect rules, honest confidence levels, and anti-spam policies. Placed a prominent, styled guidelines banner at the bottom of the home page, and added a navigation link inside the website's bottom footer.

1. **Instant Notification Read Sync & Global Badge Updates**
   * *Bug*: When users clicked on notification cards on the `/notifications` page, the notification was updated in the database but the local page state and global navbar badge did not update until a page refresh.
   * *Resolution*: Integrated the `useNotifications` global context into the notifications page. Configured a click handler on cards that updates the local state and unread count instantly, and redirects correctly without blocking. Prevented propagation on the archive button.

2. **Mobile/Device Compatibility — Answer Actions Layout Overflow**
   * *Bug*: In question detail pages, the footer elements on answers (author badge + action buttons like Solved My Doubt, Unaccept, Add to FAQ, Delete, Report) were squeezed on a single line, causing severe clipping, overlapping, and text truncation on small/medium mobile screen sizes.
   * *Resolution*: Updated the css structure to wrap flex elements and stack vertically on small screens (`flex-col md:flex-row md:items-center gap-4`), and enabled flex-wrapping (`flex-wrap items-center gap-2`) on the button groups to make them device and mobile compatible.

1. **Vercel Build Error — Context Prerender / Null Destructure Fix**
   * *Bug*: The build failed on Vercel during static page prerendering with the error: `TypeError: Cannot destructure property 'unreadCount' of 'x(...)' as it is null.` This occurred because `layout.js` did not wrap the subtree with the `NotificationProvider` (so `useNotifications()` returned `null`), and `Navbar.js` did not check if the hook returned a null value.
   * *Resolution*:
     1. Updated `layout.js` to wrap the app tree with `<NotificationProvider>` nested inside `<SocketProvider>` (so socket instance is available to notifications context).
     2. Updated `Navbar.js` with a defensive fallback for `useNotifications()` to safely default to `unreadCount = 0` if context is `null` during static pre-rendering compilation.

2. **Moderation Warning Banner — Shown to All Users Instead of Author Only**
   * *Bug*: The "pending moderation" and "hidden" banners on question detail pages were shown to every visitor, not just the question author. Regular students could see "This question is pending moderation" even on questions that had already been answered.
   * *Resolution*: Added guard condition so banners only render for the question author OR admin/moderator. Updated text to *"Your question is pending moderation. It will be visible to everyone once approved by a moderator."* — clearer and author-scoped.

2. **Ask Question — "Failed to fetch" / "Request failed" Error with No Reason**
   * *Bug*: When the spamGuard middleware blocked a post (missing category, cooldown, duplicate, rate limit), it returned `{ reason: "..." }`. But `frontend/lib/api.js` only read `data.error || data.message`, so the real reason was swallowed and the user just saw "Request failed".
   * *Resolution*: Updated `api.js` error extraction to check `data.reason` first: `data.reason || data.error || data.message || 'Request failed'`. All spamGuard rejection reasons now display clearly in the UI toast.

3. **Spam / Noise Questions — Silently Going to Pending Instead of Blocking**
   * *Bug*: When the FastAPI AI microservice flagged a question title as spam/noise, the backend quietly set `visibility = 'pending'` and saved the question anyway. The user had no idea why their question vanished.
   * *Resolution*: Changed to return HTTP 400 immediately with a clear message: *"Your question was flagged as spam or noise and is not allowed. Reason: ..."* — the post is never created, and the user sees the exact reason at the form level.

4. **Notification Bell Missing from Navbar**
   * *Bug*: The notification bell only existed in the profile dropdown menu, not in the top navbar. Users had no visible indicator of unread notifications without opening the menu.
   * *Resolution*: Added a 🔔 bell icon with a live red badge (showing unread count, capped at 99+) to the Navbar between the "Ask Question" button and the avatar. Integrated `useNotifications()` hook. Badge auto-updates via Socket.IO `notification:new` events.

5. **Socket.IO Connection Failing Through Next.js Proxy**
   * *Bug*: Socket transport order was `['websocket', 'polling']` — WebSocket upgrades don't work through Next.js HTTP proxy rewrites, causing the socket to fail to connect and breaking all real-time notifications, leaderboard updates, and admin panel live sync.
   * *Resolution*: Changed to `['polling', 'websocket']` (start with polling, upgrade when supported). Added explicit `path: '/socket.io'`, `reconnection: true`, `reconnectionAttempts: 5`, `reconnectionDelay: 2000ms`.

6. **Gmail SMTP Authentication Failure — Space in App Password**
   * *Bug*: `GMAIL_APP_PASSWORD=ncvg wyfztoseunmy` had a space in the middle. Google displays app passwords with spaces for readability, but SMTP authentication requires them without spaces. Every email send attempt was failing silently.
   * *Resolution*: Fixed in `secrets.env`: `GMAIL_APP_PASSWORD=ncvgwyfztoseunmy`. EmailWorker will now successfully authenticate and send queued emails.

7. **Avatar URL in Navbar Using Hardcoded Localhost**
   * *Bug*: Avatar `<img>` src was constructed using `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'` — on any host other than localhost, this produced a broken image URL.
   * *Resolution*: Changed to use relative path `/api/uploads${user.avatar}` which works regardless of host.

#### Latest Fixes (June 3, 2026)


1. **Email Queue Worker — Module Resolution & Docker Volume Fix**
   * *Resolution*: `node-cron` module was missing from the backend Docker container's anonymous `node_modules` volume (old volume predated the new dependency). Installed `node-cron` directly into the live container via `docker exec -u root` and rebuilt the backend image so future containers have it baked in. The `[EmailWorker]` now initialises cleanly at startup.

2. **Firebase Admin SDK — Robust JSON Parsing in .env**
   * *Resolution*: `FIREBASE_SERVICE_ACCOUNT` stored as a single-line JSON string in `secrets.env` had double-escaped quotes (`\"`) and newlines (`\\n`) that broke `JSON.parse`. Updated `backend/services/syncService.js` to unwrap outer quotes, unescape `\"`, and convert `\\n` to real newlines before parsing. Firebase Admin SDK now initialises successfully on every startup.

3. **Network-Agnostic API & Socket Routing (Critical Fix)**
   * *Resolution*: `frontend/lib/api.js` was hardcoded to `http://localhost:5000/api`, meaning API calls from any external device or mobile phone would fail (browser's `localhost` ≠ server). Changed to use a relative `/api` path in the browser so all requests route through the Next.js server proxy (`next.config.js` rewrites), which then forwards to the backend container. Same fix applied to Socket.IO in `frontend/context/SocketContext.js` (passes `''` as the URL, connecting to the current origin). Added a `/socket.io/:path*` proxy rewrite to `next.config.js` to transparently proxy WebSocket handshakes.

4. **Leaderboard Load-Time Eliminated (Critical Performance)**
   * *Resolution*: `getLeaderboardData()` in `backend/services/leaderboardService.js` was calling `await syncGoogleUsers()` blocking the read path on every leaderboard fetch. This caused multi-second delays for every leaderboard load and live broadcast. Removed the blocking call — Firebase user sync continues to run on its own 10-minute background interval via `server.js` and is unrelated to reading leaderboard data.

5. **Admin Email Queue Tab — Full Integration**
   * *Resolution*: Implemented the "Emails" monitoring tab in the Admin Panel with live stats (pending, sent today, bounced), a paginated queue log, bounce list management, and four action buttons (Force Process, Retry Failed, Clear Queue, Remove Bounce) all wired to the corresponding `/api/admin/emails/*` endpoints. Fixed a `params` wrapper bug in `fetchEmails()` that was preventing the queue list from loading.



2. **Added Firebase Service Account Credentials**
   * *Resolution*: Populated the `FIREBASE_SERVICE_ACCOUNT` environment variable in `secrets.env` with the full service account JSON in a single line as requested, enabling the Firebase Admin SDK synchronization module.

3. **Admin Panel Lazy-Loading Optimization**
   * *Resolution*: Refactored the Admin Panel (`frontend/app/admin/page.js`) to lazy-load tab data only when the tab becomes active. Socket.IO `moderation:updated` events now only trigger a re-fetch of the currently active tab, dramatically improving page responsiveness and reducing network traffic.

2. **Resolved Missing Site Reports Resolution Handler**
   * *Resolution*: Added the missing `handleResolveSiteReport` function in the frontend admin view to interact with the backend `/admin/reports/:id/resolve` endpoint. Admins can now successfully click the "Resolve" button for site reports to update their status.

3. **Fixed Missing Answers Display Bug**
   * *Resolution*: Applied the `optionalAuth` middleware to the `getAnswers` route in `backend/routes/answers.js` to correctly populate `req.user`. This allows authenticated admins/moderators to view pending/flagged answers directly on the question page instead of showing an empty list when the answers count is positive.

4. **Fixed EISDIR Database Seeding Crash**
   * *Resolution*: Corrected the path checks during the integrity checks of the seed script to explicitly verify if the matched path is a file (`fs.statSync(p).isFile()`) before reading, resolving the EISDIR crash when encountering the `.integrity` directory.

5. **Role Promotion Email Notifications**
   * *Resolution*: Implemented `sendRolePromotionEmail` in `emailService.js` and hooked it into `updateUserRole` in `adminController.js` to automatically notify users when promoted to moderator or admin.

2. **Moderators Directory Tab**
   * *Resolution*: Added a new "Moderation Team" tab to the Community page (`frontend/app/users/page.js`) that lists all active moderators and admins. Implemented a corresponding `/api/users/moderators` endpoint on the backend.

3. **Low Network Connectivity Alerts**
   * *Resolution*: Built a global `NetworkStatus` banner component (`frontend/components/NetworkStatus.js`) that monitors the Network Information API and response latencies to notify users when network connectivity is slow ("The network in your area is low. Please be patient or move to an area with good network.") or offline.

4. **FAQ Recommendation Engine Overhaul**
   * *Resolution*: Refined the recommendation service to use flexible keyword-based matching for user phases, redesigned the `RecommendedFAQs` modal to show contextual labels, and updated `faqController.js` with dynamic Redis caching TTLs (guest bypass, 10m for no-phase users, 30m for phased users).

5. **Rule-Based Spam Prevention & Trust Score Recalculation**
   * *Resolution*: Implemented automatic trustScore changes (+5 for accepted answers, +2 for helpful upvotes, +1 for daily login, -10 for spam report confirmed, -20 for abuse confirmed) and hooked them into post accepted/unaccepted, upvote, daily login benefit on authController, and admin moderation action flows.

6. **Moderation Action Email Notifications**
   * *Resolution*: Created `sendUserSanctionEmail` and `sendPostRejectionEmail` in `emailService.js` and integrated them into user moderation and post rejection endpoints in `adminController.js` to automatically alert users.

7. **Syntax Errors, Formatting & Tab Key Mapping Fixes**
   * *Resolution*: Fixed double return closures in `Navbar.js` layouts, resolved syntax errors in detail page components, mapped internal keys like `moderationQueue` to human-readable labels, and enabled horizontal scroll.

8. **Docker Platform-Agnostic Stability**
   * *Resolution*: Configured volume compatibility, disabled Elasticsearch memory lock for Windows/macOS, enabled polling for Next.js hot-reloads, and fixed `docker-entrypoint.sh` crash loops on Atlas MongoDB connectivity.

9. **Real-Time Admin Sync & Moderation Live-Updates**
   * *Resolution*: Modified socket connection logic to room-join privileged admin/moderators, created the helper `emitToAdmin()`, and configured frontend admin dashboards to listen and auto-refresh reports/moderation queues in real-time.

10. **Question Answer Count Synchronization**
    * *Resolution*: Introduced the helper `recalculateAnswerCount()` and integrated it into all moderation pipelines (such as blocking users, shadow banning users, deleting users, or rejecting/deleting answers) to prevent the "answers count mismatch" bug where question statistics display more answers than actually exist.

#### Latest Fixes (June 2, 2026)

1. **Firebase Admin User Synchronization & Real-time Pruning**
   * *Root Cause*: Public client-side Google Auth APIs could not securely verify if a user's account was deleted in Firebase console due to Firebase's default Email Enumeration Protection policies.
   * *Resolution*: Integrated the **Firebase Admin SDK** on the backend (`syncService.js`). It retrieves the active list of project UIDs (including Google provider UIDs) and cascades deletion (removing user, questions, and answers) for any account removed from the Firebase Console.

2. **Onboarding Welcome Email Simulation & Screen Preview**
   * *Root Cause*: The user completed onboarding but could not verify welcome emails because SMTP credentials weren't set up yet in `secrets.env`.
   * *Resolution*: Added an **Interactive Welcome Email Preview Modal** on the user's screen when onboarding is completed in mock/simulated SMTP mode. This renders the full HTML email newsletter with the user's selected phase, display name, and category.

3. **Cascading User Deletion from Admin Panel**
   * *Root Cause*: Admins needed a direct, manual way to permanently delete a user and purge their questions, answers, and statistics immediately.
   * *Resolution*: Created the `DELETE /api/admin/users/:id` route/controller and integrated a **Delete** button directly in the Admin Panel's Users table in the frontend UI.

4. **Persistent Onboarding Modal Popup**
   * *Root Cause*: Dismissing the onboarding phase prompt saved state only to `sessionStorage` (cleared on logout/tab close) and left `currentPhase` empty. If a user didn't choose a phase, they were prompted in every new session because `needsPhaseSelection` remained true.
   * *Resolution*: Converted onboarding dismissed/skipped state storage from `sessionStorage` to `localStorage` under `phase_prompt_dismissed_${user.id}`. Once dismissed or skipped, the user will never see the modal again across different logins.

2. **Real-time Leaderboard Broadcasts on Acceptance**
   * *Root Cause*: The real-time Socket.IO update (`broadcastLeaderboard()`) was not being triggered upon answer acceptance (`acceptAnswer`), meaning users had to reload the page to see changes in the leaderboard standing.
   * *Resolution*: Injected `broadcastLeaderboard()` directly into the `acceptAnswer` controller (in `backend/controllers/answerController.js`) right after the reputation increase, aligning it with unaccept and vote handlers.

3. **Admin Panel Discovery & Navigation**
   * *Root Cause*: The Admin Dashboard link was buried inside the profile photo dropdown, making it hard for admins/moderators to locate.
   * *Resolution*: Added a highly visible, rose-accented **Admin Panel** link directly in the primary horizontal Navbar header next to "Community" for authenticated admins and moderators.

4. **SMTP Nodemailer Automated Real-Time Notifications**
   * *Root Cause*: The user required real-time email alerts to engage registered members on onboarding, leaderboard achievements, new posts, and resolution events.
   * *Resolution*: Implemented a robust Nodemailer service (`backend/services/emailService.js`) with Gmail SMTP integration and fallback support, triggering real-time broadcasts for onboarding, Top 10 standing, new question alerts to all users, and "Me Too" doubt solved events.

5. **Google Sign-In Account Syncing**
   * *Root Cause*: Google profile picture, display name, and email alterations were not consistently updating or sync-saving into MongoDB upon logging in.
   * *Resolution*: Upgraded `googleLogin` in `backend/controllers/authController.js` to comprehensively sync and scrape Google Profile updates (email, displayName, and avatar) on every sign-in.

6. **Clean Database Seeding in Production**
   * *Root Cause*: The database seeded fake profiles and questions on every dev restart, which cluttered production environments when run on public servers.
   * *Resolution*: Added environment checks to `seedDatabase`. It now only seeds mock accounts in development and actively deletes mock users and their associated questions in production mode.


#### Older Fixes

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
