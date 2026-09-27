'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="wrap" style={{ paddingTop: 48 }}>
      <div className="boxed" role="alert">
        <h2 className="done-h">couldn’t load the leaderboard</h2>
        <p className="note">the lemonade database is not answering right now.</p>
        <button className="btn" onClick={() => reset()}>
          try again
        </button>
      </div>
    </main>
  );
}
