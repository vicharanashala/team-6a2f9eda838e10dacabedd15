# PrashnaSārathi — Feature Roadmap

**Objective:** Every student should feel safe asking doubts, get answers fast, and feel their problem was genuinely solved.

---

## Implemented Features

### Core Q&A
- ✅ Ask questions (title, body, tags, anonymous option)
- ✅ Answer questions (markdown, confidence levels)
- ✅ Voting (upvote/downvote on questions and answers)
- ✅ Accept answer (moderators/admins only, +1 Sp)
- ✅ Me Too button (bump question priority, real-time updates)
- ✅ Solved My Doubt button (distinct from upvote, real-time updates)
- ✅ Confidence levels on answers (🤔 I think so / 👍 Pretty sure / 💯 I know this)
- ✅ Duplicate detection on question creation
- ✅ Question escalation (no-response after 24 h)
- ✅ Anonymous question asking
- ✅ Real‑time updates via Socket.IO (new answers, me‑too, solved counts)
- ✅ Spurti Points (Sp) rewards (+10 Sp) on accepted answers, deductions (‑10 Sp) on unaccepted answers
- ✅ **Voice‑to‑Text for Asking** (microphone button on Ask Question page)
- ✅ **File attachments & Image uploading** in rich-text answers
- ✅ **Hyperlink sharing** when asking and answering questions
- ✅ **AI Auto-Answer service** (Gemini bot) for public and pending questions with automatic approval sync and duplicate prevention

### FAQ System
- ✅ Browse FAQ pages by category
- ✅ FAQ detail with sidebar navigation
- ✅ Item‑level Yes/No feedback
- ✅ Save/unsave FAQ pages
- ✅ Official badges, categories, tags

### Search & Discovery
- ✅ Full‑text search across questions, FAQs, users
- ✅ SearchModal (Ctrl+K or /) with voice‑to‑text support
- ✅ **Voice search activated on button press** to open search and start listening on demand
- ✅ **Voice Search Activation** via custom wake-up command ("Hey PrashnaSarathi")
- ✅ Trending searches (Redis)
- ✅ Search result caching (Redis 60 s)
- ✅ Tag browsing and filtering
- ✅ Sort options (newest, active, votes, views, etc.)
- ✅ Hybrid Search Engine (Elasticsearch + Mongoose fallback)

### User System
- ✅ Registration / Login / Logout (JWT)
- ✅ User profiles (avatar, bio, Spurti Points, badges)
- ✅ Profile editing (display name, bio, avatar upload)
- ✅ Saved questions & FAQs with notes & custom tags
- ✅ Notification system (new answer, answer accepted, upvotes, etc.)
- ✅ Role system (user, moderator, admin)
- ✅ Ban/unban users (admin)
- ✅ Spurti Points balance card & transaction history

### Gamification & Mascot (Pyro)
- ✅ Draggable glassmorphic floating Mascot companion
- ✅ Persistent viewport coordinate storage across sessions
- ✅ Daily login streak tracking (+15 EXP, evolves Junior → Evolved → Ultimate)
- ✅ **Hardcore streak reset penalty** (missed logins reset level to 0, EXP to 0)
- ✅ Automatic evolutionary stages (Junior, Evolved, Ultimate) based on levels
- ✅ Accessory shop customization (Shark Hat, Balloons) powered by Spurti Points (SP)

### Admin / Moderation
- ✅ Admin dashboard with stats
- ✅ User management (role, ban)
- ✅ Flagged content view
- ✅ Delete questions/answers
- ✅ Verify / mark outdated FAQ questions
- ✅ Accept answer on any question
- ✅ Bulk email broadcasting to all active users
- ✅ Unified PWA distribution & socket‑driven real‑time updates
- ✅ Escalated student query queue, resolution workflow, audit logging
- ✅ Spurti Points tracking dashboard & transaction logs
- ✅ Rolling hourly limit (max 5) on student escalations & duplicate checks

### UI/UX
- ✅ Dark mode toggle (localStorage, system preference)
- ✅ Student onboarding walkthrough (4‑step modal) with animations
- ✅ Keyboard shortcuts (j/k navigation, / search, Esc close)
- ✅ Responsive mobile layout
- ✅ Rich text editor (TipTap) & Markdown rendering (GFM)
- ✅ Confetti celebration on answer accepted
- ✅ View count tracking
- ✅ SEO structured data (JSON‑LD)

### Infrastructure
- ✅ Docker/Podman deployment (`docker‑compose up --build -d`)
- ✅ Nginx reverse proxy
- ✅ Elasticsearch full‑text search
- ✅ Redis caching (search results, trending)
- ✅ Kafka events (optional)
- ✅ Seed data integrity check

---

## Pending / Future Enhancements

* [ ] **Doubt Resolution Dashboard (`/my-doubts`):** A centralized workspace for students to track open questions, resolution states (AI, review, resolved), and monitor learning stats/help points.
* [ ] **"Similar Solved Doubts" Sidebar Recommendations:** An intelligent side panel using context comparison to suggest related resolved questions and learning materials to users as they read a post.
* [ ] **Weekly Academic Doubt Digest (Automated Summaries):** Scheduled email digests highlighting top questions for students and summarising common trouble-spots for instructors.
* [ ] **Threaded Follow-Up Discussions (Nested Replies):** A nested comment system underneath answers allowing quick follow-up questions without cluttering the main timeline.

---

*All items above reflect the current state of the repository.*

## Folder Structure
- `backend/` – Express API server (port 5000) with controllers, models, routes, services (auto-answer, etc.), socket configuration.
- `frontend/` – Next.js 14 App Router (port 3000) with app pages, components (MascotCompanion, OnboardingModal, SearchModal, Tiptap editor, etc.), context, hooks, lib, public, pwa, services, styles.
- `FastAPI_python_model/` – Python FastAPI spam and noise classification microservice.
- `docker-compose.yml` – Docker/Podman orchestration configuration.
- `nginx/` – Nginx reverse proxy configurations.
- `setup-docker.sh` & `setup.sh` – Deployment scripts.
- `faqs-complete.json` & `metadata.json` – Seed data for FAQs.
- `vercel.json` – Vercel deployment configuration.
- `todo.md` – Roadmap tracking and checklist document.
- `README.md` – Project documentation.
