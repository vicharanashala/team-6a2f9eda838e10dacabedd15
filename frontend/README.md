# PrashnaSārathi — Frontend Application

This folder contains the frontend application for **PrashnaSārathi**, a community-driven Q&A and FAQ platform built with Next.js 14.

---

## 🛠️ Tech Stack & Key Libraries

*   **Framework:** Next.js 14 (App Router)
*   **Libraries:** React 18
*   **Styling:** Vanilla CSS & Tailwind CSS
*   **Rich Text Editor:** TipTap Editor
*   **Client Connections:** Socket.IO Client (real-time notifications, counts, and updates)
*   **Authentication & Services:** Firebase (Auth, Push Subscription Client)

---

## 📁 Directory Structure

```
frontend/
├── app/              # Next.js App Router Page components
│   ├── admin/        # Admin panel (moderation, logs, users, point trackers)
│   ├── auth/         # Login and registration views
│   ├── downloads/    # PWA install pages and guides
│   ├── faqs/         # Browse and manage official FAQs by category
│   ├── questions/    # Student Q&A listings, details, and ask interface
│   ├── saved/        # Student saved posts/FAQs and custom annotations
│   ├── search/       # Main search results view
│   └── users/        # Public user profiles, reputation and transactions
├── components/       # Reusable UI components (QuestionCard, Navbar, SearchModal, etc.)
├── context/          # Context providers (Auth, Socket, Theme, Keyboard, Notifications)
├── hooks/            # Custom hooks (e.g. list keyboard navigation, PWA installer)
├── lib/              # API Client (Axios client setup with interceptors)
├── public/           # Static assets, icons, logo.png, manifest.json
├── pwa/              # PWA service worker and installation scripts
└── styles/           # Global styles and CSS variable declarations
```

---

## 🚀 Commands & Development Workflow

To run the frontend locally:

1.  Ensure you have run `npm install` to install dependencies.
2.  Make sure the backend is active at `http://localhost:5000` (or as configured in `secrets.env`).
3.  Start the Next.js development server:
    ```bash
    npm run dev
    ```
    The site will start on port `3000` (http://localhost:3000).

To build for production:
```bash
npm run build
```
This compiles the application and runs `scripts/build-sw.js` to construct the production Service Worker.

---

## ✨ Features & Polish Details

*   **Keyboard Navigation:** Use `j` / `k` (or `ArrowUp` / `ArrowDown`) to move up and down through list views, `/` or `Ctrl + K` to open the search modal, `Enter` to navigate to the selected page, and `Esc` to exit.
*   **Global Accessibility Scaling:** The application uses a base font size configured at `16.5px` inside `styles/globals.css` to globally increase readability and accessibility for users.
*   **Mobile Table Responsiveness:** All tables in the administrative panel are wrapped in horizontally scrollable views (`overflow-x-auto`) and configured with explicit minimum widths (`min-w-[700px]`, `min-w-[800px]`, `min-w-[900px]`) to prevent columns from collapsing or text wrapping unreadably on mobile devices.
