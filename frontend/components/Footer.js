import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-purple-400 mb-2">PrashnaSārathi</h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md">A community-driven Q&A and FAQ platform for knowledge sharing. Get your questions answered and help others learn.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text)] mb-4">Explore</h4>
            <div className="space-y-2.5">
              <Link href="/questions" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">Questions</Link>
              <Link href="/faqs" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">FAQs</Link>
              <Link href="/tags" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">Tags</Link>
              <Link href="/users" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">Community</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text)] mb-4">Participate</h4>
            <div className="space-y-2.5">
              <Link href="/questions/ask" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">Ask a Question</Link>
              <Link href="/auth?mode=signup" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors">Join Community</Link>
            </div>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-text-muted)]">
          <span>&copy; {new Date().getFullYear()} PrashnaSārathi. Open source project.</span>
          <div className="flex items-center gap-4">
            <Link href="/guidelines" className="hover:text-[var(--color-primary)] transition-colors">Guidelines & Policies</Link>
            <span>•</span>
            <span>Built with care for the community</span>
          </div>
        </div>

      </div>
    </footer>
  );
}