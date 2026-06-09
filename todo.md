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

### FAQ System
- ✅ Browse FAQ pages by category
- ✅ FAQ detail with sidebar navigation
- ✅ Item‑level Yes/No feedback
- ✅ Save/unsave FAQ pages
- ✅ Official badges, categories, tags

### Search & Discovery
- ✅ Full‑text search across questions, FAQs, users
- ✅ SearchModal (Ctrl+K or /) with voice‑to‑text support
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

### Phase 2
- [ ] Doubt Resolution Dashboard (`/my-doubts`)
- [ ] "Similar Solved Doubts" sidebar
- [ ] Related Learning Resources linking

### Phase 3
- [ ] Weekly Doubt Digest (email summary)
- [ ] Request Answer from Contributor button

### Phase 4
- [ ] Threaded follow‑up discussions under answers

### Phase 5 (Optional)
- [ ] Voice‑to‑Text for answers (future expansion)

---

*All items above reflect the current state of the repository.*

## Folder Structure
- `backend/` – Express API server (port 5000) with controllers, models, services, etc.
- `frontend/` – Next.js 14 App Router (port 3000) with app pages, components, context, hooks, lib, public, pwa, services, styles.
- `docker-compose.yml` – Docker/Podman orchestration configuration.
- `nginx/` – Nginx reverse proxy configurations.
- `setup-docker.sh` & `setup.sh` – Deployment scripts.
- `faqs-complete.json` & `metadata.json` – Seed data for FAQs.
- `vercel.json` – Vercel deployment configuration.
