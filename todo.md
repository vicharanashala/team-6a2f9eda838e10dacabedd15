PrashnaSārathi

**Objective:** Every student should feel safe asking doubts, get answers fast, and feel their problem was genuinely solved.

---

## Phase 1: Eliminate the Fear of Asking (Foundation)

- [ ] ### 1. Anonymous Question Asking
  - Toggle "Ask anonymously" when posting a question
  - Question author shows as "Anonymous Student" instead of username
  - The author can still see & interact with their own question (they're authenticated)
  - Author's identity is visible to moderators/admins only
  - *Why:* Many students hesitate to ask "dumb" questions publicly. This removes that barrier completely.

- [ ] ### 2. "I Have the Same Doubt" (+1 / Me Too) Button
  - A button on every question: "Me Too (X students)"
  - Instead of asking the same question again, students just click this
  - Question gets bumped in priority when it has many "Me Too"s
  - When an answer is accepted, all "Me Too" students get a notification
  - *Why:* Eliminates duplicate questions and shows students they're not alone in their doubt

- [ ] ### 3. "Solved My Doubt" Button (Distinct from Upvote)
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

- [ ] ### 5. Answer Confidence Badge
  - When answering, the student picks a confidence level:
    - ` I think so` (low confidence)
    - `Pretty sure` (medium)
    - `I know this` (high/verified)
  - Displayed prominently on the answer card
  - Helps questioners gauge how much to trust an answer
  - *Why:* An answer from a fellow student might be wrong — confidence signaling helps

- [ ] ### 6. "Similar Solved Doubts" Sidebar
  - When viewing a question, show a sidebar with 3-5 similar questions that have been marked as "Solved"
  - Uses the existing similar-question logic but filters to resolved ones only
  - *Why:* The student might get their answer instantly without waiting for a new response

---

## Phase 3: Engagement & Motivation

- [ ] ### 7. Top Contributor / Subject Expert Badges
  - Auto-awarded per tag: "Top Answerer in React", "Helper in Python", etc.
  - Criteria: most accepted/solved answers in that tag in the last 30 days
  - Badge shown next to the username on answers
  - *Why:* Recognizes peer-to-peer help and builds trust in answers

- [ ] ### 8. Doubt Resolved Celebration
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

- [ ] ### 10. Student Onboarding Walkthrough
  - On first visit (detected by `localStorage` flag or `firstLogin`):
    - Step 1: "Welcome to PrashnaSārathi! Your doubts are welcome here."
    - Step 2: "Browse FAQs for common questions" → point to /faqs
    - Step 3: "Search before asking — your doubt might already be solved"
    - Step 4: "Ask your first question — anonymously if you prefer"
  - *Why:* New students don't know where to start — this guides them

- [ ] ### 11. Dark Mode
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

## Recommended Implementation Order

| Done? | # | Feature | Phase | Effort | Impact |
|-------|---|---------|-------|--------|--------|
|  | 1 | Anonymous Asking | 1 | 2 days | High |
|  | 2 | "Me Too" Button | 1 | 2 days | High |
|  | 3 | "Solved My Doubt" Button | 1 | 2 days | Very High |
|  | 4 | Doubt Resolution Dashboard | 2 | 3 days | Very High |
|  | 5 | Answer Confidence Badge | 2 | 1 day | Medium |
|  | 6 | Similar Solved Doubts Sidebar | 2 | 1 day | Medium |
|  | 7 | Top Contributor Badges | 3 | 2 days | Medium |
|  | 8 | Doubt Resolved Celebration | 3 | 1 day | High |
|  | 9 | "This Helped Me" Button | 3 | 1 day | Medium |
|  | 10 | Onboarding Walkthrough | 4 | 2 days | High |
|  | 11 | Dark Mode | 4 | 2 days | Medium |
|  | 12 | Related Learning Resources | 4 | 2 days | Low-Medium |
|  | 13 | Threaded Follow-up Discussions | 5 | 3-5 days | Medium |
|  | 14 | Weekly Doubt Digest | 5 | 3-5 days | Medium |
|  | 15 | Request Answer from Contributor | 5 | 3-5 days | Medium |
|  | 16 | PWA / Install Prompt | 5 | 3-5 days | Medium |
