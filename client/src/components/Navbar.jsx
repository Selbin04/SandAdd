import { useEffect, useState } from "react";

const THEME_KEY = "sandadd.theme";

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export default function Navbar({
  storage,
  activeName,
  page,
  onNavigate,
  onLogout,
  userName,
}) {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  return (
    <nav className="navbar" aria-label="Main">
      <div className="navbar-inner">
        <a
          className="navbar-brand"
          href="#progress"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("progress");
          }}
          aria-label="SandAdd"
        >
          <img
            className="navbar-mark"
            src="/sandadd-mark.png?v=exact4"
            alt=""
          />
          <span className="navbar-wordmark" aria-hidden="true">
            <span className="sand">Sand</span>
            <span className="add">Add</span>
          </span>
        </a>

        <ul className="navbar-links">
          <li>
            <button
              type="button"
              className={page === "progress" ? "is-active" : ""}
              aria-current={page === "progress" ? "page" : undefined}
              onClick={() => onNavigate("progress")}
            >
              Progress
            </button>
          </li>
          <li>
            <button
              type="button"
              className={page === "social" ? "is-active" : ""}
              aria-current={page === "social" ? "page" : undefined}
              onClick={() => onNavigate("social")}
            >
              Social
            </button>
          </li>
          <li>
            <button
              type="button"
              className={page === "portfolio" ? "is-active" : ""}
              aria-current={page === "portfolio" ? "page" : undefined}
              onClick={() => onNavigate("portfolio")}
            >
              Portfolio
            </button>
          </li>
          <li>
            <button
              type="button"
              className={page === "messages" ? "is-active" : ""}
              aria-current={page === "messages" ? "page" : undefined}
              onClick={() => onNavigate("messages")}
            >
              Messages
            </button>
          </li>
        </ul>

        <div className="navbar-meta">
          <span className={`storage-pill ${storage}`}>{storage}</span>
          <span className="navbar-active" title={activeName || "No work"}>
            {activeName || "No work"}
          </span>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to white theme"}
            title={theme === "light" ? "Dark" : "White"}
          >
            {theme === "light" ? "Dark" : "White"}
          </button>
          <button
            type="button"
            className={`profile-btn ${page === "profile" ? "is-active" : ""}`}
            aria-label="Open profile"
            aria-current={page === "profile" ? "page" : undefined}
            title={userName || "Profile"}
            onClick={() => onNavigate("profile")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" fill="currentColor" />
              <path
                d="M5 19.5c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5"
                fill="currentColor"
              />
            </svg>
          </button>
          {onLogout ? (
            <button
              type="button"
              className="logout-btn"
              onClick={onLogout}
              title="Sign out"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
