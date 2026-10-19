export function BoardLoading() {
  return (
    <div className="board-layout">
      <div
        aria-busy="true"
        aria-label="Loading the Board"
        aria-live="polite"
        className="board-loading-placeholder"
        role="status"
      >
        <svg
          aria-hidden="true"
          className="board-loading-spinner"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            fill="none"
            r="10"
            stroke="currentColor"
            strokeDasharray="32 32"
            strokeLinecap="round"
            strokeWidth="2"
          />
        </svg>
        <p>Loading the Board…</p>
      </div>
    </div>
  );
}
