'use client';
import Link from 'next/link';

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] via-purple-500 to-pink-500">
              Community Guidelines & Policies
            </span>
          </h1>
          <p className="text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-2xl mx-auto">
            Welcome to PrashnaSārathi. Our goal is to foster a helpful, respectful, and safe community Q&A environment for students and instructors alike.
          </p>
        </div>

        <div className="space-y-8">
          {/* Section 1: Community Guidelines */}
          <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🤝</span>
              <h2 className="text-xl font-bold text-[var(--color-text)]">Community Guidelines</h2>
            </div>
            
            <div className="space-y-6 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">1. Be Respectful and Supportive</h3>
                <p>We are a learning community. Treat all members with respect, kindness, and empathy. Harassment, insults, hate speech, or derogatory comments targeting anyone will not be tolerated.</p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">2. Ask Clear, Searchable Questions</h3>
                <p>Before posting, search existing FAQs and questions using the search modal (`Ctrl+K` or `/`) to check if your question has already been answered. If not, write a clear title and details, and choose an appropriate category.</p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">3. Share Honest Confidence Levels</h3>
                <p>When answering questions, specify your confidence level honestly: select 🤔 <em>"I think so"</em> if you aren't fully certain, 👍 <em>"Pretty sure"</em> for standard answers, or 💯 <em>"I know this"</em> if you are absolutely certain of the solution.</p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">4. Use the "Solved My Doubt" Feature Honestly</h3>
                <p>If another student's answer resolves your issue, click the <strong>Solved My Doubt</strong> button. This helps build reputation for helpful contributors and flags high-quality solutions for moderators.</p>
              </div>
            </div>
          </section>

          {/* Section 2: Platform Policies */}
          <section className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl">🛡️</span>
              <h2 className="text-xl font-bold text-[var(--color-text)]">Platform Policies</h2>
            </div>

            <div className="space-y-6 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">1. AI Spam and Content Guard</h3>
                <p>All posts are automatically scanned by our FastAPI AI microservice. Questions flagged as spam, promotional content, or off-topic gibberish will be blocked immediately upon submission (returning an HTTP 400 rejection).</p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">2. Content Moderation</h3>
                <p>Moderators and administrators reserve the right to edit, soft-delete, merge duplicate questions, or hide content pending review. Users whose posts are flag-reported multiple times will face moderation review.</p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">3. Cooldown and Rate Limiting</h3>
                <p>To prevent spam and DDOS-like traffic, posting questions, answers, and comments is subject to rate limiting and cooldown periods. Violating these bounds will result in temporary request blocks.</p>
              </div>

              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-base mb-1">4. Ban and Suspension Policy</h3>
                <p>Users who repeatedly violate community guidelines, abuse the voting system, post harmful links, or bypass AI spam guards will be permanently banned from the platform by administrators.</p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <div className="text-center pt-4">
            <Link href="/" className="btn-primary inline-flex items-center gap-2">
              Back to Q&A Board
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
