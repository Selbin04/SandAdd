import { useEffect, useRef, useState } from "react";

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
  const navRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Dynamically measure navbar height so page content never overlaps in any display ratio
  useEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return undefined;

    const syncHeight = () => {
      const h = navEl.offsetHeight || navEl.getBoundingClientRect().height;
      if (h > 0) {
        document.documentElement.style.setProperty(
          "--navbar-height",
          `${Math.ceil(h)}px`
        );
      }
    };

    syncHeight();

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(syncHeight);
      ro.observe(navEl);
    }

    window.addEventListener("resize", syncHeight, { passive: true });
    window.addEventListener("orientationchange", syncHeight, { passive: true });

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", syncHeight);
      window.removeEventListener("orientationchange", syncHeight);
    };
  }, []);

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
      ref={navRef}
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
          aria-label="SandAdd"
        >
          <img
            className="navbar-mark"
            src="/sandadd-mark.png?v=newlogo"
            alt=""
          />
          <div className="navbar-brand-text">
            <span className="navbar-wordmark" aria-hidden="true">
              <span className="sand">Sand</span>
              <span className="add">Add</span>
            </span>
          </div>
        </a>

        <ul className="navbar-links">
          <li>
            <button
              id="nav-btn-progress"
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
              id="nav-btn-social"
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
              id="nav-btn-portfolio"
              type="button"
              className={page === "portfolio" ? "is-active" : ""}
              aria-current={page === "portfolio" ? "page" : undefined}
              onClick={() => onNavigate("portfolio")}
            >
              Portfolio
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
            id="nav-btn-profile"
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
