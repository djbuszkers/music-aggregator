interface HeaderProps {
  lastUpdated: string | null;
}

export function Header({ lastUpdated }: HeaderProps) {
  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-6">
        {/* Compact logo on mobile, full logo on desktop */}
        <img
          src="/muzyczka-logo-compact.svg"
          alt="Muzyczka"
          className="sm:hidden h-7"
        />
        <img
          src="/muzyczka-logo-full.svg"
          alt="Muzyczka"
          className="hidden sm:block h-10"
        />
        {formattedDate && (
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Last updated: {formattedDate}
          </p>
        )}
      </div>
    </header>
  );
}
