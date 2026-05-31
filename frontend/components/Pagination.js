import Link from 'next/link';

export default function Pagination({ pagination, basePath, queryParams = {} }) {
  if (!pagination || pagination.pages <= 1) return null;

  const buildUrl = (page) => {
    const params = new URLSearchParams({ ...queryParams, page: String(page) });
    return `${basePath}?${params}`;
  };

  const { page, pages } = pagination;

  return (
    <div className="flex items-center justify-center gap-1.5 mt-10">
      {page > 1 && (
        <Link href={buildUrl(page - 1)} className="btn-secondary btn-sm flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Previous
        </Link>
      )}
      {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        let p;
        if (pages <= 7) {
          p = i + 1;
        } else if (page <= 4) {
          p = i + 1;
        } else if (page >= pages - 3) {
          p = pages - 6 + i;
        } else {
          p = page - 3 + i;
        }
        return (
          <Link
            key={p}
            href={buildUrl(p)}
            className={`w-9 h-9 flex items-center justify-center text-sm rounded-lg transition-all ${
              p === page
                ? 'bg-[var(--color-primary)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text)]'
            }`}
          >
            {p}
          </Link>
        );
      })}
      {page < pages && (
        <Link href={buildUrl(page + 1)} className="btn-secondary btn-sm flex items-center gap-1.5">
          Next
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </Link>
      )}
    </div>
  );
}