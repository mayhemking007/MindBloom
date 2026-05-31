import React from "react";
import ReactDOM from "react-dom/client";

import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Memo-grafter example app</p>
        <h1>MindBloom</h1>
        <p>
          Phase 0 is ready: React, Express, shared TypeScript utilities, and a
          deployment-friendly workspace are in place.
        </p>
        <a href={`${apiBaseUrl}/health`}>API health</a>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
