# PrashnaSārathi (प्रश्नसारथि) — Community Q&A and FAQ Platform

<div align="center">
  <img src="screenshots/logo/logo-banner.png" alt="Platform Banner" width="30%">
</div>

<br>

**PrashnaSārathi** (Sanskrit for *"The Question Guide"* or *"Doubt Charioteer"*) is a unified, community-driven Q&A and FAQ platform designed to streamline academic doubt resolution. The system helps students overcome anxiety, get answers fast, and build a collaborative knowledge repository.

### Key Operational Pillars:
* **Safe & Inclusive Q&A:** Anonymous posting toggles for questions and answers to remove the fear of peer judgment.
* **Instant Search & Automated Answering:** Real-time duplicate checks, global autocomplete search (`Ctrl+K`), and automated AI-driven baseline answers to resolve doubts immediately.
* **Healthy Engagement Mechanics:** Gamified daily streaks (with hardcore reset penalties), mascot companion evolution (Pyro), and shop accessories unlockable via Spurti Points (SP).
* **Automated Quality Assurance:** Integration with an AI spam microservice to filter noise and keyboard smashes.

**Live Demo:** [https://prashnasarathi.vercel.app/](https://prashnasarathi.vercel.app/)

---

## Team Members

| Name | Email |
| :--- | :--- |
| **Niranjan Praveen** | [niranjanbpraveen@gmail.com](mailto:niranjanbpraveen@gmail.com) (Team Lead) |
| **Medisetty Shanmukh** | [medisettyshanmukh@gmail.com](mailto:medisettyshanmukh@gmail.com) |
| **Divyanshi Mishra** | [divyanshimishra480@gmail.com](mailto:divyanshimishra480@gmail.com) |
| **Dhruv Malu** | [dhruvmalu6@gmail.com](mailto:dhruvmalu6@gmail.com) |
| **Mudimadugula Srija** | [msrija2002@gmail.com](mailto:msrija2002@gmail.com) |
| **Rohit Wadettiwar** | [rohitwadettiwar.ds24@sbjit.edu.in](mailto:rohitwadettiwar.ds24@sbjit.edu.in) |
| **Shawshank Redemp** | [shawshank.redemp5@gmail.com](mailto:shawshank.redemp5@gmail.com) |
| **Tsp Amiitesh** | [tspamiitesh@gmail.com](mailto:tspamiitesh@gmail.com) |
| **Kinnera Swetha** | [Kinneraswetha04@gmail.com](mailto:Kinneraswetha04@gmail.com) |
| **Priteenanda Das** | [cse.23bcsh44@silicon.ac.in](mailto:cse.23bcsh44@silicon.ac.in) |

---

## Tech Stack

| Layer     | Technology                                      |
| --------- | ----------------------------------------------- |
| Frontend  | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend   | Node.js, Express 4, MongoDB (Mongoose), Redis   |
| Search    | Elasticsearch                                   |
| Realtime  | Socket.IO                                       |
| Events    | Kafka (optional)                                |
| AI / ML   | FastAPI (Python 3), DistilBART Classifier, SentenceTransformers |
| Infra     | Podman / Docker, Nginx                          |

---

## Project Structure

```
prashnasarathi/
├── backend/              # Express API server (port 5000)
│   ├── assets/           # Static email templates and system templates
│   ├── config/           # Database, Redis, Elasticsearch, Firebase Admin, and Kafka connections
│   ├── controllers/      # Route handlers (auth, questions, answers, search, etc.)
│   ├── data/             # Local database JSON exports
│   ├── middleware/       # JWT auth, error handling, rate limiting, file upload
│   ├── models/           # Mongoose schemas (User, Question, Answer, FAQ, SpurtiPointLog, AuditLog, etc.)
│   ├── routes/           # Express endpoint router definitions
│   ├── seeds/            # Database seed scripts
│   ├── services/         # ES Search, recommendations, notifications, email worker, and auto-answer (Gemini bot)
│   ├── socket/           # Socket.IO real-time event server configuration
│   ├── uploads/          # Local storage path for uploaded user files
│   └── utils/            # Validators, email transposer, permissions
├── frontend/             # Next.js 14 App Router client (port 3000)
│   ├── app/              # App Router pages (faqs, questions, admin, saved, search, notifications, etc.)
│   ├── components/       # Shared UI components (MascotCompanion, ReportIssueButton, OnboardingModal, SearchModal, recommended FAQs, Tiptap editor)
│   ├── context/          # Auth, Socket, Theme, Notifications, and VoiceCommand Contexts
│   ├── data/             # Frontend static local JSON data
│   ├── hooks/            # Custom hooks (keyboard shortcuts, PWA installers)
│   ├── lib/              # API clients & Axios interceptors
│   ├── public/           # Static public files (manifest, Service Worker sw.js, icons, etc.)
│   ├── pwa/              # PWA service worker configurations and wrapper
│   ├── scripts/          # Service Worker build scripts
│   ├── services/         # Frontend API calls wrapper services
│   ├── styles/           # Tailwind configuration and global CSS layout style
│   └── tailwind.config.js# Custom styling utility mappings
├── FastAPI_python_model/ # FastAPI AI microservice (spam & noise classification)
│   ├── main.py           # Python server entry point
│   ├── Dockerfile        # Container build definition
│   └── requirements.txt  # Python packages list
├── faq-service/          # Python FAQ classification microservice helper
│   ├── main.py           # Python script entry point
│   └── requirements.txt  # Python dependencies list
├── nginx/                # Nginx reverse proxy configurations
├── podman/               # Standalone Docker deployment configurations
├── kafka/                # Optional Kafka docker-compose configurations
├── docker-compose.yml    # Multi-service container orchestration mapping
├── .dockerignore         # Docker build context exclusions
├── setup-docker.sh       # Unified Docker container execution setup script
├── faqs-complete.json    # 126 FAQ items (seed data)
├── metadata.json         # Category metadata
├── vercel.json           # Frontend Vercel hosting configuration
└── todo.md               # Roadmap tracking and checklist document
```

---

## Key Features

### Home Dashboard

<div align="center">
  <img src="screenshots/homepage/main-view.png" alt="PrashnaSārathi Home Page" width="100%">
</div>

The main dashboard serves as the central hub with:
- Global search bar for instant knowledge discovery
- Personalized FAQ recommendations
- Category-based content filtering
- Quick access to all platform features

### Q&A Core

#### Ask Questions
![QA Detailed View](screenshots/qa/qa-detailed.png)
- Create questions with title, rich text body, and tags
- Anonymous posting option for sensitive doubts
- Duplicate detection before posting

#### Similar Questions Detection
![QA Similar Questions](screenshots/qa/qa-similar.png)
- Prevents duplicate questions before posting
- Shows similar existing questions
- Reduces clutter and encourages consolidation

#### Content Quality Filtering
![QA Gibberish Detection](screenshots/qa/qa-gibberish.png)
- AI-powered spam and noise classification
- Automatically filters low-quality content
- Maintains high-quality discussions

#### Answer with Confidence
Students can indicate their confidence level when answering:
- 🤔 "I think so" - Partial confidence
- 👍 "Pretty sure" - Moderate confidence  
- 💯 "I know this" - High confidence

#### Voting & Feedback System
- Upvote/downvote with optional reason feedback
- Helps surface quality content
- Provides constructive feedback to answer authors

#### Accept Answer
- Question authors or moderators can mark the best answer
- Visual celebration with confetti effect
- Helps future students find solutions quickly

#### "Me Too" Button
- Students signal they have the same doubt
- Bumps question priority in the algorithm
- Encourages community participation

#### "Solved My Doubt" Button
- Distinct from upvote - tracks genuine problem resolution
- Provides better metrics for answer quality
- Helps identify truly helpful responses

---

### FAQ System

#### FAQs Page
![FAQs Page](screenshots/faqs/faqs-page.png)
- Organized by subject categories
- Easy browsing and discovery
- Version tracking for updates

#### Detailed FAQ View
![FAQs Detailed](screenshots/faqs/faqs-detailed.png)
- Comprehensive FAQ answers with rich formatting
- Related questions and resources
- Helpfulness feedback tracking

#### Helpfulness Feedback
- Item-level Yes/No feedback tracking
- Helps identify outdated or unclear content
- Drives content improvement

#### Official Badges & Verification
- Verified official answers stand out
- Master FAQ program for canonical answers
- Trust markers for quality content

---

### Search & Discovery

#### Search Modal
![Search Modal](screenshots/search/search-modal.png)
- Full-text search across questions, FAQs, and users
- Press `Ctrl+K` or `/` to open from anywhere
- Elasticsearch-powered for speed and relevance

#### Search Results Page
![Search Page](screenshots/search/search-page.png)
- Comprehensive search results with filters
- Sort by relevance, date, or popularity
- Highlighted matching terms

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` or `/` | Open search modal |
| `j` or `↓` | Navigate down in lists |
| `k` or `↑` | Navigate up in lists |
| `Enter` | View/open selected item |
| `Esc` | Close modal or clear selection |

#### Tag Browsing
![Tags Page](screenshots/tags/tags.png)
- Browse questions by topic tags
- Filter and sort options
- Related questions sidebar

#### Trending & Suggestions
- Trending searches powered by Redis caching
- Search suggestions with top 10 popular queries
- Real-time autocomplete

---

### User System

#### Authentication
- JWT-based secure authentication
- Registration with email verification
- Session management

#### User Profiles
- Custom avatars and bio
- Reputation system
- Achievement badges
- Activity statistics (questions, answers, votes)

#### Saved Content
- Save questions and FAQs for later
- Add personal notes
- Organize with custom tags
- Easy reference and review

#### Real-time Notifications
![Notifications](screenshots/notifications/notifications.png)
- New answers to your questions
- Answers accepted notifications
- Upvotes and "Me Too" alerts
- Live updates via Socket.IO

#### Dark Mode
- Automatic system preference detection
- Manual override with toggle
- Persists to localStorage
- Full dark theme support across all pages

#### Student Onboarding
- 4-step guided tour for new users
- Platform feature introduction
- Encourages engagement from day one

#### Role System
- **User** - Standard access
- **Moderator** - Content moderation privileges
- **Admin** - Full platform control

---

### Admin & Moderation

#### Admin Dashboard
![Admin Dashboard](screenshots/admin/dashboard.png)
- Real-time platform statistics
- User activity metrics (DAU, questions, answers)
- Quick access to moderation tools

#### User Management
![Users Management](screenshots/admin/users.png)
- View all registered users
- Change user roles (User/Moderator/Admin)
- Ban/unban users with reason tracking
- Search and filter functionality

#### Audit Logs
![Audit Logs](screenshots/admin/audit-logs.png)
- Track all admin actions
- Moderation history
- Security and compliance monitoring

#### Spurti Points Tracker
![Spurti Points Tracker](screenshots/admin/spurti-points-tracker.png)
- Gamification points system
- Track user engagement and contributions
- Reward active community members

#### Flagged Content Queue
- Review reported questions and answers
- Approve or remove content
- Track moderation history

#### FAQ Management
- Verify FAQ accuracy
- Mark outdated content
- Promote questions to Master FAQ status

#### Cache Management
- One-click Redis cache clearing
- Improves performance after updates
- Admin-only access

---

### Community Features

#### Leaderboard
![Leaderboard](screenshots/community/leaderboard.png)
- Top contributors by reputation
- Weekly and all-time rankings
- Encourages healthy competition

#### Moderators
![Moderators](screenshots/community/moderators.png)
- List of community moderators
- Contact and reporting options
- Transparency in moderation

---

### UI/UX Highlights

#### Rich Text Editor
- TipTap-based WYSIWYG editor
- Formatting toolbar
- Image upload support

#### Markdown Rendering
- GitHub Flavored Markdown (GFM)
- Syntax highlighting for code blocks
- Consistent content presentation

#### Confetti Celebration
- Celebratory animation when answers are accepted
- Positive reinforcement for contributors
- Delightful user experience

#### View Counter
- Track question popularity
- Sort by most viewed
- Engagement metrics

#### SEO Optimized
- Structured data with JSON-LD
- Meta tags for social sharing
- Sitemap generation

---

### Real-time Features

#### Live Notifications
- Toast notifications for new activity
- No page refresh required
- Powered by Socket.IO

#### Real-time Updates
- Me-too counts update instantly
- Answer counts refresh in real-time
- Solved metrics update without page reload

---

### Interactive Mascot Companion & Gamification

#### Draggable Glassmorphic Mascot (Pyro)
- Interactive, draggable mascot companion displaying visual micro-animations and stage evolution.
- Positioned floating at the bottom-right of the lobby view for logged-in users.
- Remembers drag offsets and retains positioning persistently across sessions using localized coordinate storage.

#### Daily Login Streak Tracker & Progression
- Evaluates logins on page mount and window focus using robust date comparison.
- Daily logins award **+15 EXP** and increment the user's consecutive day streak.
- **Hardcore Streak Mechanic**: If a user misses even a single day, their streak resets to 1, their level resets to **Level 0**, and their EXP resets to **0** (starts the progression over from scratch).
- Evolve stages unlock automatically based on level milestones:
  - **Level 0-2**: Junior Stage
  - **Level 3**: Evolved Stage
  - **Level 4+**: Ultimate Stage

#### Spurti Points (SP) Shop & Accessories
- Unlock and claim milestone rewards using Spurti Points (SP) earned from Q&A contributions.
- Customize Pyro's appearance with accessories like **Shark Hat** or **Balloons**.

---

### Voice Command & AI Assistance

#### Voice Search Activation ("Hey PrashnaSarathi")
- Speech recognition listens for the custom wake-up command `"Hey PrashnaSarathi"`.
- Instantly opens the global search bar modal and automatically begins recording the query without clicking.
- Direct microphone button on the lobby search triggers active voice input instantly.

#### AI Auto-Answer Service
- Automatically parses incoming public student questions on the backend.
- Generates high-confidence, context-grounded baseline assistance to help students resolve doubts immediately.
- Duplicate questions trigger automatic reference matching and direct the student to existing answered paths.

#### Media & File Attachment Support
- Send useful hyperlinks when asking questions.
- Attach files/images to support answers when responding to student doubts.

---

## Running on Other Systems

To set up and run this project on a new developer environment or a separate host system, follow these steps:

### 1. Prerequisites
Ensure you have the following installed on the target system:
* **Docker / Podman & Docker Desktop** (with WSL2 enabled if on Windows)
* **Node.js 20.x** (for local host development without containers)

---

### 2. Environment Configuration (Crucial Step)
Since the `secrets.env` file containing sensitive private keys and credentials is ignored by version control, **you must create it manually** on the target system:

1. Copy `.env.example` to `secrets.env` in the root directory:
   ```bash
   cp .env.example secrets.env
   ```
2. Open `secrets.env` and populate the following values:
   * **Gmail SMTP Credentials**:
     ```env
     GMAIL_USER=your-email@gmail.com
     GMAIL_APP_PASSWORD=sixteencharacterpassword
     ```
     *(Note: The Gmail App Password must be 16 characters with no spaces. Requires 2FA enabled on your Google account).*
   * **Firebase Admin Credentials**:
     Provide the JSON string of your Firebase service account in `FIREBASE_SERVICE_ACCOUNT` on a single line.

---

### 3. Option A: Run via Docker Compose (Recommended)
This starts all required auxiliary services (MongoDB, Redis, Elasticsearch, FastAPI Spam Service, Node Backend, Next.js Frontend) in unified containers:

1. Run the cross-platform setup script or docker-compose command directly:
   ```bash
   # Option 1: Cross-platform script
   ./setup-docker.sh
   
   # Option 2: Direct docker-compose
   docker-compose up --build -d
   ```
2. Access the site at: http://localhost:3000

---

### 4. Option B: Running via Docker Directly (Without Compose)
If you want to run the application using standalone Docker commands without orchestrating through docker-compose:

1. **Start required database & cache containers**:
   ```bash
   # Start MongoDB
   docker run -d --name mongodb -p 27017:27017 mongo:6.0
   
   # Start Redis
   docker run -d --name redis -p 6379:6379 redis:7.0-alpine
   
   # Start Elasticsearch
   docker run -d --name elasticsearch -p 9200:9200 -e "discovery.type=single-node" -e "xpack.security.enabled=false" elasticsearch:8.11.1
   ```

2. **Build and run the Backend**:
   ```bash
   # Build the backend image
   docker build -t prashnasarathi-backend ./backend
   
   # Run the backend container using your secrets.env file
   docker run -d --name backend -p 5000:5000 --env-file secrets.env prashnasarathi-backend
   ```

3. **Build and run the Frontend**:
   ```bash
   # Build the frontend image
   docker build -t prashnasarathi-frontend ./frontend
   
   # Run the frontend container
   docker run -d --name frontend -p 3000:3000 prashnasarathi-frontend
   ```

---

### 5. Option C: Local Host Setup (No Containers)
If you prefer running services directly on the host machine:

1. Start local instances of **MongoDB** (`port 27017`), **Redis** (`port 6379`), and **Elasticsearch** (`port 9200`).
2. Install packages:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Seed the FAQ Database:
   ```bash
   cd backend && npm run seed
   ```
4. Start development servers:
   * **Backend**: `cd backend && npm run dev` (starts on port 5000)
   * **Frontend**: `cd frontend && npm run dev` (starts on port 3000)

---

## Future Enhancements
The following core tasks represent the roadmap for upcoming iterations of PrashnaSārathi, matching the project report specifications:
* **Doubt Resolution Dashboard (`/my-doubts`):** A centralized workspace for students to track open questions, resolution states (AI, review, resolved), and monitor learning stats/help points.
* **"Similar Solved Doubts" Sidebar Recommendations:** An intelligent side panel using context comparison to suggest related resolved questions and learning materials to users as they read a post.
* **Weekly Academic Doubt Digest (Automated Summaries):** Scheduled email digests highlighting top questions for students and summarising common trouble-spots for instructors.
* **Threaded Follow-Up Discussions (Nested Replies):** A nested comment system underneath answers allowing quick follow-up questions without cluttering the main timeline.

