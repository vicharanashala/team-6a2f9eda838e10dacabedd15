# QuoraFAQ — Community Q&A and FAQ Platform

A community-driven Q&A and FAQ platform built for the Vicharanashala Internship at IIT Ropar.

## Tech Stack

| Layer   | Technology                                      |
| ------- | ----------------------------------------------- |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend  | Node.js, Express 4, MongoDB (Mongoose), Redis   |
| Search   | Elasticsearch                                   |
| Realtime | Socket.IO                                       |
| Events   | Kafka (optional)                                |
| Infra    | Podman / Docker, Nginx                          |

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

This reads `faqs-complete.json` and `metadata.json` to populate MongoDB with 13 FAQ categories and 126 FAQ items, plus an admin user:
- **Email:** `admin@quorafaq.com`
- **Password:** `admin123`

### 4. Start the dev servers

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api

### Running with Docker Compose

```bash
bash podman/deploy.sh
```

This starts all services (MongoDB, Redis, Elasticsearch, backend, frontend, Nginx). Access the app at http://localhost:8080.

## Project Structure

```
faq-site/
├── backend/              # Express API server (port 5000)
│   ├── config/           # DB, Redis, ES, Kafka connections
│   ├── controllers/      # Route handlers
│   ├── middleware/        # Auth, error handling, rate limiting
│   ├── models/           # Mongoose schemas (FAQ, User, Question, etc.)
│   ├── routes/           # Express route definitions
│   ├── seeds/            # Database seed script
│   ├── services/         # Elasticsearch indexing/search
│   └── socket/           # Socket.IO setup
├── frontend/             # Next.js 14 app (port 3000)
│   ├── app/              # App Router pages
│   ├── components/       # Shared React components
│   ├── context/          # Auth & Socket providers
│   └── lib/             # API client & utilities
├── nginx/                # Nginx reverse proxy config
├── podman/               # Podman/Docker deployment files
├── faqs-complete.json    # 126 FAQ items (seed data)
└── metadata.json         # Category metadata
```

## Key Features

- **FAQ browsing** — categorized FAQ pages with "On this page" navigation
- **Q&A** — ask questions, post answers, vote, accept answers
- **Search** — full-text search across questions, FAQs, and users (Elasticsearch)
- **User system** — registration, login, profiles, reputation
- **Admin panel** — manage users, view flagged content, clear cache
- **Real-time updates** — new answers appear instantly via Socket.IO
- **Responsive** — mobile-friendly with Tailwind CSS
- **Keyboard shortcuts** — efficient navigation without mouse
- **Bookmarks / Collections** — save questions and organize them with custom tags

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` or `/` | Open search modal |
| `j` or `↓` | Navigate down in lists |
| `k` or `↑` | Navigate up in lists |
| `Enter` | View/open selected item |
| `Esc` | Close modal or clear selection |

These shortcuts work on the Questions and FAQs list pages, as well as in the search modal.

## API Overview

| Endpoint            | Description               |
| ------------------- | ------------------------- |
| `GET /api/faqs`     | List FAQ pages            |
| `GET /api/faqs/:slug` | Get FAQ page by slug    |
| `POST /api/auth/*`  | Login / Register          |
| `GET /api/questions` | List questions           |
| `POST /api/questions` | Create a question       |
| `GET /api/search`   | Search across all content |
| `GET /api/users/me/saved` | Get user's saved questions (auth) |
| `POST /api/users/me/saved` | Save a question (auth) |
| `PATCH /api/users/me/saved/:questionId` | Update saved question notes/tags (auth) |
| `DELETE /api/users/me/saved/:questionId` | Remove saved question (auth) |
| `GET /api/users/me/saved/faqs` | Get user's saved FAQs (auth) |
| `POST /api/users/me/saved/faqs` | Save an FAQ (auth) |
| `PATCH /api/users/me/saved/faqs/:faqId` | Update saved FAQ notes/tags (auth) |
| `DELETE /api/users/me/saved/faqs/:faqId` | Remove saved FAQ (auth) |

## Seeding Data

The seed data comes from two files at the project root:

- **`faqs-complete.json`** — 126 FAQ items with `faqId`, `question`, `answer`, `categoryId`
- **`metadata.json`** — category metadata (13 categories, version info)

Run `cd backend && npm run seed` to populate the database.
