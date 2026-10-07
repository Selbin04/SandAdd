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
  const [navVisible, setNavVisible] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    let prevY = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;

      if (currentY <= 30) {
        setNavVisible(true);
      } else if (currentY > prevY + 6) {
        // Scrolling down -> hide navbar
        setNavVisible(false);
      } else if (currentY < prevY - 6) {
        // Scrolling up -> reveal navbar
        setNavVisible(true);
      }

      prevY = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleTheme = () => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  };

  return (
    <nav
      className={`navbar ${navVisible ? "is-visible" : "is-hidden"}`}
      aria-label="Main"
    >
      <div className="navbar-inner">
        <a
          className="navbar-brand"
          href="#progress"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("progress");
          }}
          aria-label="SandAdd - your progress shapes your skills"
        >
          <span className="logo-snow-layer" aria-hidden="true">
            <span className="snow-flake sf-1" />
            <span className="snow-flake sf-2" />
            <span className="snow-flake sf-3" />
            <span className="snow-flake sf-4" />
            <span className="snow-flake sf-5" />
            <span className="snow-flake sf-6" />
            <span className="snow-flake sf-7" />
            <span className="snow-flake sf-8" />
          </span>
          <img
            className="navbar-mark"
            src="/sandadd-mark.png?v=exact4"
            alt=""
          />
          <div className="navbar-brand-text">
            <span className="navbar-wordmark" aria-hidden="true">
              <span className="sand">
                <span className="santa-s-wrapper">
                  <svg
                    className="santa-cap-svg"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    {/* Main Santa hat body */}
                    <path
                      d="M 20,70 C 18,44 34,18 58,10 C 76,4 90,16 86,32 C 82,46 66,58 44,70 Z"
                      fill="#e53935"
                    />
                    {/* Darker red depth shadow */}
                    <path
                      d="M 26,70 C 24,48 38,26 58,16 C 68,10 78,16 75,28 C 72,40 60,52 40,70 Z"
                      fill="#b71c1c"
                      opacity="0.85"
                    />
                    {/* Soft highlight */}
                    <path
                      d="M 32,58 C 30,40 44,24 58,16"
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    {/* White fluffy pom-pom at tip */}
                    <circle cx="86" cy="32" r="12" fill="#ffffff" />
                    <circle cx="84" cy="30" r="8" fill="#f5f5f5" />
                    {/* White fluffy brim at base */}
                    <rect x="12" y="62" width="70" height="20" rx="10" fill="#ffffff" />
                    <rect x="16" y="65" width="62" height="14" rx="7" fill="#f0f0f0" opacity="0.7" />
                  </svg>
                  S
                </span>
                and
              </span>
              <span className="add">Add</span>
            </span>
            <span className="navbar-tagline" aria-hidden="true">
              your progress shapes your skills
            </span>
          </div>
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
              aria-label={page === "social" ? "Social" : "Social, 3 notifications"}
              onClick={() => onNavigate("social")}
            >
              <span className="navbar-count-label">
                Social
                {page !== "social" ? (
                  <span className="navbar-count-badge" aria-hidden="true">3</span>
                ) : null}
              </span>
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
              aria-label="Messages, 3 unread"
              onClick={() => onNavigate("messages")}
            >
              <span className="navbar-count-label">
                Messages
                <span className="navbar-count-badge" aria-hidden="true">3</span>
              </span>
            </button>
          </li>
        </ul>

        <div className="navbar-meta">
          <span className={`storage-pill ${storage}`}>{storage}</span>
          <span className="navbar-active" title={activeName || "No project"}>
            {activeName || "No project"}
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
