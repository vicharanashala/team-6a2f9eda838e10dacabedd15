# PrashnaSārathi — Express API Server

This folder contains the backend REST API server and database integrations for **PrashnaSārathi**.

---

## 🛠️ Tech Stack & Integrations

*   **Runtime:** Node.js
*   **Web Framework:** Express 4
*   **Database:** MongoDB via Mongoose (ODM)
*   **Caching & Rates:** Redis (Search caching, suggestions, and trending statistics)
*   **Search Engine:** Elasticsearch (Full-text search indexed across questions, FAQs, and users)
*   **Realtime Engine:** Socket.IO (Event broadcasting, real-time vote/post updates)
*   **Auth & Sync:** Firebase Admin SDK (Google Authentication validation and orphaned user pruning)
*   **Notifications:** Nodemailer (SMTP/Gmail mail transport) + Web Push (PWA Push Subscriptions)

---

## 📁 Directory Structure

```
backend/
├── config/           # Database, Redis, ES, Firebase Admin, and Kafka connections
├── controllers/      # API Request route handlers
│   ├── adminController.js     # User bans, flags, caching, audit logs, and reports
│   ├── answerController.js    # Answer operations, accepts, downvote reason feedbacks
│   ├── authController.js      # Register, login, Firebase token validations
│   ├── questionController.js  # Questions, duplicates, escalations, views, tags
│   ├── searchController.js    # Query processing, analytics, suggestions
│   └── voteController.js      # Upvotes, downvotes, batch fetching
├── middleware/       # JWT checks, file upload configurations, error handling
├── models/           # Mongoose schemas (User, Question, Answer, FAQ, Tag, AuditLog, etc.)
├── routes/           # Router configuration files mapping routes to controllers
├── seeds/            # Initial database seed data (FAQs, categories, system settings)
├── services/         # Integrations (ES syncing, push delivery, analytics, audit log records)
├── socket/           # Real-time WebSocket connection handling and subscription events
└── utils/            # Validation helpers, custom application errors, and email templates
```

---

## 🚀 Commands & Development Workflow

To initialize and run the API server locally:

1.  Create and configure `secrets.env` at the root of the workspace.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Seed the database with initial categories and FAQ documents:
    ```bash
    npm run seed
    ```
4.  Start the development server with hot-reloading:
    ```bash
    npm run dev
    ```
    The server starts on port `5000` (http://localhost:5000).

---

## 🔍 Search & Data Synchronization Scripts

The backend includes a couple of helper scripts for development and maintenance:

*   **`sync_es.js`**: Rebuilds the search index in Elasticsearch by pulling all questions, FAQs, and users from MongoDB and re-syncing them.
*   **`test_search_api.js`**: Runs a test search query suite locally against the search service to verify results.

### 🛡️ Hybrid Search Fallback
If Elasticsearch is down or connection times out, the backend gracefully catches the `No Living connections` error and falls back to performing regex-based search queries directly on the MongoDB collections, ensuring uninterrupted service. This fallback returns clean tag name arrays matching the Elasticsearch output schema.
