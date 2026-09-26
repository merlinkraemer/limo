export default function Loading() {
  return (
    <main className="wrap" style={{ paddingTop: 48 }}>
      <p className="note" role="status" aria-live="polite">
        loading lemonades…
      </p>
    </main>
  );
}
