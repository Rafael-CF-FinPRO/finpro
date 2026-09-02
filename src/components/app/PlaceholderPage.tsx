export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>

      <div className="card mt-6 flex min-h-[280px] flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="font-medium text-stone-700">Em construção</p>
        <p className="max-w-sm text-sm text-[var(--muted)]">
          Esta área será desenvolvida em uma próxima etapa do FinPRO.
        </p>
      </div>
    </div>
  );
}
