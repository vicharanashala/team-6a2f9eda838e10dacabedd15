import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-lg font-bold text-primary-600 mb-2">PrashnaSārathi</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">A community-driven Q&A and FAQ platform for knowledge sharing.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">Quick Links</h4>
            <div className="space-y-2">
              <Link href="/questions" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Questions</Link>
              <Link href="/faqs" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">FAQs</Link>
              <Link href="/tags" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Tags</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-text)] mb-3">Community</h4>
            <div className="space-y-2">
              <Link href="/questions/ask" className="block text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">Ask a Question</Link>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-center text-xs text-[var(--color-text-secondary)]">
          &copy; {new Date().getFullYear()} PrashnaSārathi. Open source project.
        </div>
      </div>
    </footer>
  );
}
