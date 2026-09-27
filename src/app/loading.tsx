export default function Loading() {
  return (
    <main className="wrap route-loading">
      <span className="route-loading-lemon" aria-hidden="true">
        🍋
      </span>
      <p className="note" role="status" aria-live="polite">
        loading lemonades…
      </p>
    </main>
  );
}
