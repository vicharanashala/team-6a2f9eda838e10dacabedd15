# PrashnaSārathi (प्रश्नसारथि) — Community Q&A and FAQ Platform

A community-driven Q&A and FAQ platform designed to help students ask doubts without fear, get answers fast, and feel their problems are genuinely solved.

## Tech Stack

| Layer     | Technology                                      |
| --------- | ----------------------------------------------- |
| Frontend  | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend   | Node.js, Express 4, MongoDB (Mongoose), Redis   |
| Search    | Elasticsearch                                   | | Realtime  | Socket.IO                                       |
| Events    | Kafka (optional)                                |
| Infra     | Podman / Docker, Nginx                          |

## Quick Start (local development)

### Prerequisites

- Node.js 20 (use [nvm](https://github.com/nvm-sh/nvm): `nvm use`)
- MongoDB running on `localhost:27017`
- Redis running on `localhost:6379`

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
# Backend env is pre-configured for local dev — review and adjust as needed
cat backend/.env

# Frontend uses NEXT_PUBLIC_* env vars (defaults work for local dev)
```

### 3. Seed the database

```bash
cd backend && npm run seed
```

This reads `faqs-complete.json` and `metadata.json` to populate MongoDB with 13 FAQ categories and 126 FAQ items, plus test users:
- **Admin:** `aduorafamin@qq.com` / `admin123`
- **Moderator:** `mod@quorafaq.com` / `mod123`
- **Students:** `alice@test.com`, `bob@test.com`, `charlie@test.com` (password: `test123`)

### 4. Start the dev servers

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

### Running with Docker Compose (Recommended for Windows/Mac)

This is the easiest way to run the platform on any OS without installing Node.js, MongoDB, Redis, or Elasticsearch locally.

```bash
# Option 1: Use the setup script (recommended for Windows/Mac)
./setup-docker.sh

# Option 2: Direct docker-compose
docker-compose up --build -d
```

This spins up the complete development environment (MongoDB, Redis, Elasticsearch, Backend, Frontend). Access the application directly at http://localhost:3000.

**For Windows (Docker Desktop WSL2):**
- Ensure WSL2 is installed and Docker Desktop is configured to use it
- Allocate at least 4GB RAM in Docker Desktop settings
- Run from WSL2 terminal or Git Bash

**For macOS (Docker Desktop):**
- Allocate at least 4GB RAM in Docker Desktop settings
- Apple Silicon (M1/M2/M3): Docker Desktop handles ARM64 natively
- Intel: Standard amd64 builds work automatically

## Project Structure

```
faq-site/
├── backend/              # Express API server (port 5000)
│   ├── config/           # DB, Redis, ES, Kafka connections
│   ├── controllers/      # Route handlers (auth, questions, answers, votes, etc.)
│   ├── middleware/        # JWT auth, error handling, rate limiting, uploads
│   ├── models/           # Mongoose schemas (User, Question, Answer, FAQ, Vote, etc.)
│   ├── routes/           # Express route definitions (11 route files)
│   ├── seeds/            # Database seed script + test users
│   ├── services/         # ES search, recommendations, analytics, moderation
│   ├── socket/           # Socket.IO real-time setup
│   └── utils/            # Helpers, validators, permissions
│   ├── socket/           # Socket.IO real-time setup
│   └── utils/            # Helpers, validators, permissions
├── frontend/             # Next.js 14 app (port 3000)
│   ├── app/              # App Router pages (faqs, questions, admin, auth, etc.)
│   ├── components/       # Shared React components
│   ├── context/          # Auth, Socket, Theme, Keyboard providers
│   ├── hooks/            # Custom hooks (list keyboard navigation)
│   ├── lib/              # API client & utilities
│   ├── services/         # Frontend services (admin analytics, etc.)
│   └── styles/           # Global CSS with Tailwind
├── nginx/                # Nginx reverse proxy config
├── podman/               # Podman/Docker deployment files
├── kafka/                # Optional Kafka docker-compose
├── docker-compose.yml    # Multi-service container orchestration
├── .dockerignore         # Docker build context exclusions
├── setup-docker.sh       # Cross-platform Docker setup script
├── faqs-complete.json    # 126 FAQ items (seed data)
└── metadata.json         # Category metadata
```

## Key Features

### Q&A
- **Ask questions** with title, body, tags, and anonymous option
- **Answer with confidence** — students pick 🤔 "I think so" / 👍 "Pretty sure" / 💯 "I know this"
- **Voting** — upvote/downvote with optional reason feedback
- **Accept answer** — question author or moderator marks the best answer
- **"Me Too" button** — students signal the same doubt; bumps question priority
- **"Solved My Doubt" button** — distinct from upvote, tracks genuine resolution
- **Duplicate detection** — find similar questions before posting
- **Question escalation** — unanswered questions auto-escalate after 24h
- **Mark as FAQ / Master FAQ** — moderators can promote questions to official FAQs

### FAQ System
- **Categorized FAQ pages** with "On this page" sidebar navigation
- **Item-level Yes/No feedback** (helpful / not helpful)
- **Official badges** and tags
- **Save/unsave FAQ pages** with notes and custom tags

### Search & Discovery
- **Full-text search** across questions, FAQs, and users (Elasticsearch)
- **SearchModal** — open with `Ctrl+K` or `/`
- **Trending searches** (Redis-cached)
- **Search suggestions** — top 10 trending queries
- **Tag browsing** and filtering with sort options
- **Recommendations** — personalized tag-based question suggestions
- **Similar & related questions** sidebar

### User System
- **Registration / Login / Logout** with JWT
- **User profiles** — avatar, bio, reputation, badges, stats
- **Saved questions & FAQs** with notes and custom tags
- **Notification system** — new answers, accepted answers, upvotes, me-too, etc.
- **Role system** — user, moderator, admin
- **Ban/unban users** with reason
- **Dark mode** — respects system preference, persists to localStorage
- **Student onboarding** — 4-step guided walkthrough on first visit

### Admin / Moderation
- **Admin dashboard** with stats (users, questions, answers, DAU)
- **User management** — role changes, ban/unban
- **Flagged content** view and moderation
- **Delete/edit** questions and answers
- **Verify / Mark outdated** FAQ questions
- **Cache clearing** — flush Redis cache
- **User analytics** — registration over 30 days
- **FAQ analytics** — top 10 most helpful items

### UI/UX
- **Responsive mobile layout** with Tailwind CSS
- **Dark mode toggle** — automatic system preference + manual override
- **Keyboard shortcuts** — `j`/`k` navigation, `/` search, `Esc` close
- **Rich text editor** (TipTap)
- **Markdown rendering** (GFM with syntax highlighting)
- **Confetti celebration** on answer accepted
- **View count tracking**
- **SEO structured data** (JSON-LD)
- **"On this page"** anchor navigation for FAQ pages

### Real-time
- **Socket.IO** — new answers, me-too counts, solved counts update instantly
- **Live notifications** — pushed without page refresh

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` or `/` | Open search modal |
| `j` or `↓` | Navigate down in lists |
| `k` or `↑` | Navigate up in lists |
| `Enter` | View/open selected item |
| `Esc` | Close modal or clear selection |

Works on Questions/FAQs list pages and the search modal.

## API Overview

| Endpoint | Description |
|----------|-------------|
| `GET  /api/health` | Health check |
| `POST /api/auth/register` | Register new user |
| `POST /api/auth/login` | Login |
| `GET  /api/auth/me` | Get current user (auth) |
| `PUT  /api/auth/profile` | Update profile (auth) |
| `GET  /api/questions` | List questions (paginated, filterable) |
| `POST /api/questions` | Create a question (auth) |
| `GET  /api/questions/similar` | Find similar questions |
| `GET  /api/questions/escalated` | Get escalated questions (mod+) |
| `GET  /api/questions/master-faqs` | Get master FAQs |
| `GET  /api/questions/:id` | Get single question |
| `PUT  /api/questions/:id` | Update question (auth, owner/mod+) |
| `DELETE /api/questions/:id` | Soft-delete (auth, owner/mod+) |
| `PATCH /api/questions/:id/duplicate` | Mark as duplicate (mod+) |
| `PATCH /api/questions/:id/me-too` | Toggle "me too" (auth) |
| `PATCH /api/questions/:id/verify` | Verify as FAQ (mod+) |
| `PATCH /api/questions/:id/outdated` | Mark as outdated (mod+) |
| `PATCH /api/questions/:id/escalate` | Escalate question (auth) |
| `PATCH /api/questions/:id/merge` | Merge into master FAQ (mod+) |
| `GET  /api/answers/question/:questionId` | List answers |
| `POST /api/answers/question/:questionId` | Create answer (auth) |
| `PUT  /api/answers/:id` | Update answer (auth, owner) |
| `DELETE /api/answers/:id` | Soft-delete (auth, owner/mod+) |
| `POST /api/answers/:id/accept` | Accept answer (auth, author/mod) |
| `PATCH /api/answers/:id/solved-my-doubt` | Toggle "solved my doubt" (auth) |
| `GET  /api/faqs` | List FAQ pages (paginated) |
| `GET  /api/faqs/:slug` | Get FAQ page by slug |
| `POST /api/faqs` | Create FAQ page (mod+) |
| `PUT  /api/faqs/:id` | Update FAQ page (mod+) |
| `DELETE /api/faqs/:id` | Delete FAQ page (mod+) |
| `POST /api/faqs/:id/items` | Add FAQ item (mod+) |
| `POST /api/faqs/:id/items/:itemId/feedback` | Mark helpful/unhelpful |
| `POST /api/votes` | Cast/change vote (auth) |
| `GET  /api/votes/:targetType/:targetId` | Get user's vote (auth) |
| `GET  /api/votes/feedback/:targetType/:targetId` | Get downvote feedback (auth) |
| `GET  /api/search` | Search across all content |
| `GET  /api/search/suggestions` | Top 10 search suggestions |
| `GET  /api/tags` | List tags |
| `GET  /api/tags/:name` | Get tag by name |
| `GET  /api/users/:username` | Get public profile |
| `GET  /api/users/:username/questions` | User's questions |
| `GET  /api/users/:username/answers` | User's answers |
| `GET  /api/users/me/saved` | Saved questions (auth) |
| `POST /api/users/me/saved` | Save question (auth) |
| `PATCH /api/users/me/saved/:questionId` | Update saved question (auth) |
| `DELETE /api/users/me/saved/:questionId` | Unsave question (auth) |
| `GET  /api/users/me/saved/faqs` | Saved FAQs (auth) |
| `POST /api/users/me/saved/faqs` | Save FAQ (auth) |
| `PATCH /api/users/me/saved/faqs/:faqId` | Update saved FAQ (auth) |
| `DELETE /api/users/me/saved/faqs/:faqId` | Unsave FAQ (auth) |
| `GET  /api/notifications` | List notifications (auth) |
| `GET  /api/notifications/unread-count` | Unread count (auth) |
| `PUT  /api/notifications/read` | Mark as read (auth) |
| `GET  /api/recommendations/recommended` | Personalized recommendations |
| `GET  /api/recommendations/trending` | Trending questions |
| `GET  /api/admin/dashboard` | Dashboard stats (admin) |
| `GET  /api/admin/users` | List users (admin) |
| `PUT  /api/admin/users/:id/role` | Update user role (admin) |
| `POST /api/admin/users/:id/ban` | Ban user (admin) |
| `POST /api/admin/users/:id/unban` | Unban user (admin) |
| `GET  /api/admin/flagged` | Flagged content (admin) |
| `POST /api/admin/cache/clear` | Flush Redis cache (admin) |

## Seeding Data

The seed data comes from two files at the project root:

- **`faqs-complete.json`** — 126 FAQ items with `faqId`, `question`, `answer`, `categoryId`
- **`metadata.json`** — category metadata (13 categories, version info)

Run `cd backend && npm run seed` to populate the database.
