import { useState, useEffect } from "react";
import { getMembership, purchaseMembership } from "../lib/membershipStore.js";
import { getCardAvatar, getCardCreatorName } from "../lib/projectCardAvatar.js";
import "./MembershipModal.css";

export default function MembershipModal({ project, onClose }) {
  const [status, setStatus] = useState(() => getMembership(project));
  const [processingTier, setProcessingTier] = useState(null);
  const [successTier, setSuccessTier] = useState(null);

  const creatorName = getCardCreatorName(project) || "Creator";
  const avatarSrc = getCardAvatar(project);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePay = (tier) => {
    if (processingTier) return;
    setProcessingTier(tier);
    setSuccessTier(null);

    // Simulate dummy payment processing
    setTimeout(() => {
      const updated = purchaseMembership(project, tier);
      setProcessingTier(null);
      setSuccessTier(tier);
      setStatus(updated || { isMember: true, tier });
    }, 700);
  };

  return (
    <div className="membership-modal-overlay" onClick={onClose}>
      <div
        className="membership-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="membership-modal-title"
      >
        <button
          type="button"
          className="membership-modal-close"
          onClick={onClose}
          aria-label="Close membership modal"
        >
          ×
        </button>

        <header className="membership-modal-head">
          <div className="membership-creator-badge-wrap">
            {avatarSrc ? (
              <img src={avatarSrc} alt={creatorName} className="membership-creator-avatar" />
            ) : (
              <div className="membership-creator-avatar-fallback">
                {creatorName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="membership-crown-badge">👑</span>
          </div>

          <h2 id="membership-modal-title" className="membership-modal-title">
            Join {creatorName}’s Membership
          </h2>
          <p className="membership-modal-sub">
            Support the creator directly and unlock valuable progress paths and exclusive member-only progress files.
          </p>

          {status.isMember && !status.isCreator && (
            <div className="membership-active-banner">
              <span className="membership-active-icon">✓</span>
              <span>
                You are currently an active <strong>{status.tier === "paths" ? "Valuable Paths (RS 199)" : "Supporter (RS 99)"}</strong> member!
              </span>
            </div>
          )}

          {status.isCreator && (
            <div className="membership-creator-banner">
              <span>👑 You are the Creator of this progress folder (Full Creator Access)</span>
            </div>
          )}
        </header>

        {successTier && (
          <div className="membership-success-alert" role="alert">
            <span className="success-icon">🎉</span>
            <div>
              <strong>Payment Successful!</strong>
              <p>You have unlocked membership for this progress folder.</p>
            </div>
          </div>
        )}

        <div className="membership-options-grid">
          {/* Option 1: Support Creator RS 99 */}
          <div
            className={`membership-card ${status.tier === "support" ? "is-current-plan" : ""}`}
          >
            <div className="membership-card-badge">SUPPORTER</div>
            <div className="membership-card-price-row">
              <span className="membership-card-currency">RS</span>
              <span className="membership-card-price">99</span>
              <span className="membership-card-period">/ month</span>
            </div>

            <h3 className="membership-card-title">Support creator by paying RS 99</h3>
            <p className="membership-card-desc">
              Directly support {creatorName}’s work and stand out in the community.
            </p>

            <ul className="membership-perks-list">
              <li>
                <span className="perk-check">✓</span>
                <span>Special Supporter badge beside your profile</span>
              </li>
              <li>
                <span className="perk-check">✓</span>
                <span>Direct appreciation & creator recognition</span>
              </li>
              <li>
                <span className="perk-check">✓</span>
                <span>Highlight your comments in the progress group</span>
              </li>
            </ul>

            <button
              type="button"
              className={`membership-pay-btn ${status.tier === "support" ? "is-active-btn" : ""}`}
              onClick={() => handlePay("support")}
              disabled={Boolean(processingTier)}
            >
              {processingTier === "support" ? (
                <span className="membership-btn-spinner-wrap">
                  <span className="membership-spinner" />
                  <span>Processing RS 99…</span>
                </span>
              ) : status.tier === "support" ? (
                "Active Supporter (Pay again)"
              ) : (
                "Pay RS 99"
              )}
            </button>
            <span className="membership-dummy-note">Dummy test payment</span>
          </div>

          {/* Option 2: Get Valuable Progress Paths RS 199 */}
          <div
            className={`membership-card is-popular ${status.tier === "paths" ? "is-current-plan" : ""}`}
          >
            <div className="membership-card-badge is-gold">BEST VALUE · VIP</div>
            <div className="membership-card-price-row">
              <span className="membership-card-currency">RS</span>
              <span className="membership-card-price">199</span>
              <span className="membership-card-period">/ month</span>
            </div>

            <h3 className="membership-card-title">Get valuable progress paths : RS 199</h3>
            <p className="membership-card-desc">
              Full all-inclusive access to premium progress paths and member-only progress files.
            </p>

            <ul className="membership-perks-list">
              <li>
                <span className="perk-check">✓</span>
                <span><strong>Unlock all Member-only progress files</strong> inside this folder</span>
              </li>
              <li>
                <span className="perk-check">✓</span>
                <span>Access all valuable progress paths created by {creatorName}</span>
              </li>
              <li>
                <span className="perk-check">✓</span>
                <span>Premium source links, templates & full resources</span>
              </li>
              <li>
                <span className="perk-check">✓</span>
                <span>Includes all RS 99 Supporter perks</span>
              </li>
            </ul>

            <button
              type="button"
              className={`membership-pay-btn is-gold-btn ${status.tier === "paths" ? "is-active-btn" : ""}`}
              onClick={() => handlePay("paths")}
              disabled={Boolean(processingTier)}
            >
              {processingTier === "paths" ? (
                <span className="membership-btn-spinner-wrap">
                  <span className="membership-spinner" />
                  <span>Processing RS 199…</span>
                </span>
              ) : status.tier === "paths" ? (
                "Active VIP Member (Pay again)"
              ) : (
                "Pay RS 199"
              )}
            </button>
            <span className="membership-dummy-note">Dummy test payment</span>
          </div>
        </div>

        <footer className="membership-modal-foot">
          <p className="membership-footer-note">
            💡 This is a simulation payment for creator memberships. No real payment card is charged.
          </p>
        </footer>
      </div>
    </div>
  );
}

