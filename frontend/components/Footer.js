import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] mt-auto py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text)]">PrashnaSārathi</span>
          <span className="text-[var(--color-text-muted)] hidden md:inline">•</span>
          <Link href="/questions" className="hover:text-[var(--color-primary)] transition-colors">Questions</Link>
          <span className="text-[var(--color-text-muted)] hidden md:inline">•</span>
          <Link href="/faqs" className="hover:text-[var(--color-primary)] transition-colors">FAQs</Link>
          <span className="text-[var(--color-text-muted)] hidden md:inline">•</span>
          <Link href="/tags" className="hover:text-[var(--color-primary)] transition-colors">Tags</Link>
          <span className="text-[var(--color-text-muted)] hidden md:inline">•</span>
          <Link href="/users" className="hover:text-[var(--color-primary)] transition-colors">Community</Link>
          <span className="text-[var(--color-text-muted)] hidden md:inline">•</span>
          <Link href="/guidelines" className="hover:text-[var(--color-primary)] transition-colors">Guidelines</Link>
          <span className="text-[var(--color-text-muted)] hidden md:inline">•</span>
          <Link href="/downloads" className="hover:text-[var(--color-primary)] transition-colors font-semibold text-emerald-500">Download App</Link>
        </div>
        <div className="text-[var(--color-text-muted)] text-center md:text-right font-mono">
          &copy; {new Date().getFullYear()} · Open source project
        </div>
      </div>
    </footer>
  );
}