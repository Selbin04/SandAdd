import { useState } from "react";
import { isImageProof, isPdfProof, isVideoProof } from "../lib/socialFeed.js";
import { normalizeSourceUrl } from "./SourceMedia.jsx";

function openProofPdf(proof) {
  if (!proof?.dataUrl) return;
  try {
    const [header, base64] = proof.dataUrl.split(",");
    if (!base64) {
      window.open(proof.dataUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const mime = header?.includes("application/pdf")
      ? "application/pdf"
      : proof.type || "application/pdf";
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      // Popup blocked — fall back to download
      const a = document.createElement("a");
      a.href = url;
      a.download = proof.name || "proof.pdf";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    window.open(proof.dataUrl, "_blank", "noopener,noreferrer");
  }
}

function ProofImage({ proof, className }) {
  const [ratio, setRatio] = useState(null);

  return (
    <div className={`${className}-frame`}>
      <img
        ref={(el) => {
          if (el?.complete && el?.naturalWidth && el?.naturalHeight && !ratio) {
            setRatio(`${el.naturalWidth} / ${el.naturalHeight}`);
          }
        }}
        className={className}
        src={proof.dataUrl}
        alt={proof.name || "Proof"}
        loading="lazy"
        style={ratio ? { aspectRatio: ratio } : undefined}
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          if (naturalWidth && naturalHeight) {
            setRatio(`${naturalWidth} / ${naturalHeight}`);
          }
        }}
      />
    </div>
  );
}

function ProofVideo({ proof, className }) {
  const [ratio, setRatio] = useState(null);

  return (
    <div className={`${className}-frame is-video-frame`}>
      <video
        ref={(el) => {
          if (el?.videoWidth && el?.videoHeight && !ratio) {
            setRatio(`${el.videoWidth} / ${el.videoHeight}`);
          }
        }}
        className={`${className} is-video`}
        src={proof.dataUrl}
        controls
        playsInline
        preload="metadata"
        style={ratio ? { aspectRatio: ratio } : undefined}
        onLoadedMetadata={(e) => {
          const { videoWidth, videoHeight } = e.currentTarget;
          if (videoWidth && videoHeight) {
            setRatio(`${videoWidth} / ${videoHeight}`);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        Your browser can’t play this video.
      </video>
    </div>
  );
}

/** Renders attached proof (image, video, PDF link, link URL, text note, or file name). */
export default function ProofMedia({ proof, className = "social-proof" }) {
  if (!proof) return null;
  if (proof.type === "link" || proof.kind === "link" || proof.url) {
    const linkUrl = proof.url || proof.link || proof.name;
    const label = proof.name || linkUrl;
    return (
      <a
        href={normalizeSourceUrl(linkUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${className}-link`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={`${className}-link-icon`} aria-hidden="true">
          🔗
        </span>
        <span className={`${className}-link-label`}>{label}</span>
      </a>
    );
  }
  if (proof.type === "text" || proof.kind === "text" || proof.text) {
    const textContent = proof.text || proof.name;
    return (
      <div className={`${className}-text-card`}>
        <span className={`${className}-text-icon`} aria-hidden="true">
          📝
        </span>
        <p className={`${className}-text-content`}>{textContent}</p>
      </div>
    );
  }
  if (isImageProof(proof)) {
    return <ProofImage proof={proof} className={className} />;
  }
  if (isVideoProof(proof)) {
    return <ProofVideo proof={proof} className={className} />;
  }
  if (isPdfProof(proof)) {
    const label = proof.name || "PDF";
    return (
      <button
        type="button"
        className={`${className}-pdf`}
        onClick={() => openProofPdf(proof)}
      >
        <span className={`${className}-pdf-icon`} aria-hidden="true">
          PDF
        </span>
        <span className={`${className}-pdf-label`}>Open {label}</span>
      </button>
    );
  }
  if (proof.name) {
    const pending = proof.hasMedia && !proof.dataUrl;
    return (
      <p className={`${className}-file`}>
        {pending ? `Loading media: ${proof.name}` : `Proof: ${proof.name}`}
      </p>
    );
  }
  return null;
}
