"use client";

// Root error boundary — renders instead of the root layout, so it must be
// self-contained (no context hooks) and provide its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf8f5", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1410", margin: "0 0 8px" }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: "#6b625a", lineHeight: 1.5 }}>
              An unexpected error occurred. {error.message ? `(${error.message})` : ""}
            </p>
            <button onClick={reset} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "none", background: "#d97706", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
