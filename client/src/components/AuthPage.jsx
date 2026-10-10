import { useState } from "react";
import "./AuthPage.css";

export default function AuthPage({ onAuthed, busy = false, error = "", onClearError }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const isRegister = mode === "register";
  const showError = localError || error;

  const switchMode = (next) => {
    setMode(next);
    setLocalError("");
    onClearError?.();
  };

  const submit = (e) => {
    e.preventDefault();
    setLocalError("");
    onClearError?.();

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail || !password) {
      setLocalError("Email and password are required.");
      return;
    }
    if (isRegister && trimmedName.length < 2) {
      setLocalError("Enter your name (at least 2 characters).");
      return;
    }
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    onAuthed?.({
      mode,
      name: trimmedName,
      email: trimmedEmail,
      password,
    });
  };

  return (
    <section className="auth-page" aria-label="Sign in">
      <div className="auth-shell">
        <header className="auth-brand">
          <img
            className="auth-mark"
            src="/sandadd-mark.png?v=exact4"
            alt=""
          />
          <h1 className="auth-wordmark">
            <span className="sand">Sand</span>
            <span className="add">Add</span>
          </h1>
        </header>

        <form className="auth-card" onSubmit={submit}>
          <div className="auth-tabs" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? "is-active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? "is-active" : ""}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>

          {isRegister ? (
            <label className="auth-field">
              <span>Name</span>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={busy}
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              disabled={busy}
              required
              minLength={6}
            />
          </label>

          {showError ? <p className="auth-error">{showError}</p> : null}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy
              ? isRegister
                ? "Creating…"
                : "Signing in…"
              : isRegister
                ? "Create account"
                : "Enter SandAdd"}
          </button>
        </form>
      </div>
    </section>
  );
}
