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
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            src="/octocrate-logo.svg"
            alt="OctoCrate"
            className="h-16 sm:h-28"
          />
          <div>
            <p className="text-xs sm:text-sm text-zinc-500 italic leading-snug">
              Eight arms in the crates.<br />Music curated from the deep.
            </p>
            {formattedDate && (
              <p className="text-[10px] sm:text-xs text-zinc-600 mt-1">
                Updated {formattedDate}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
