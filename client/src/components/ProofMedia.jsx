import { useEffect, useRef, useState } from "react";
import { fetchSocialPostProof } from "../api.js";
import { isImageProof, isPdfProof, isVideoProof } from "../lib/socialFeed.js";
import { normalizeSourceUrl } from "./SourceMedia.jsx";
import YouTubeEmbed from "./YouTubeEmbed.jsx";
import { isYouTubeUrl, extractYouTubeUrl } from "../lib/youtubeHelper.js";

const postProofCache = new Map();
const postProofInflight = new Map();

function resolveRemoteMediaFromPayload(payload, proof) {
  if (!payload) return null;
  if (proof?.remoteWorkId) {
    const wid = String(proof.remoteWorkId);
    const lists = [payload.works, payload.sharedProject?.works];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      const match = list.find((w) => String(w?.id || w?._id || "") === wid);
      if (match?.sourceProof?.dataUrl) return match.sourceProof;
      if (match?.coverImage?.dataUrl) return match.coverImage;
    }
  }
  return payload.proof || null;
}

async function loadPostProofOnce(postId) {
  const key = String(postId || "");
  if (!key) return null;
  if (postProofCache.has(key)) return postProofCache.get(key);
  if (postProofInflight.has(key)) return postProofInflight.get(key);
  const promise = fetchSocialPostProof(key)
    .then((data) => {
      postProofCache.set(key, data);
      postProofInflight.delete(key);
      return data;
    })
    .catch((err) => {
      postProofInflight.delete(key);
      throw err;
    });
  postProofInflight.set(key, promise);
  return promise;
}

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
export default function ProofMedia({ proof, postId = null, className = "social-proof" }) {
  const targetPostId = postId || proof?.remotePostId || null;
  const needsRemote = Boolean(
    proof && !proof.dataUrl && (proof.hasRemoteProof || proof.hasMedia) && targetPostId
  );
  const cachedPayload = targetPostId ? postProofCache.get(String(targetPostId)) : null;
  const cachedResolved = needsRemote ? resolveRemoteMediaFromPayload(cachedPayload, proof) : null;

  const [hydratedProof, setHydratedProof] = useState(() => cachedResolved || null);
  const [inView, setInView] = useState(() => !needsRemote || Boolean(cachedResolved));
  const holderRef = useRef(null);

  useEffect(() => {
    setHydratedProof(cachedResolved || null);
    setInView(!needsRemote || Boolean(cachedResolved));
  }, [targetPostId, proof?.mediaId, proof?.remoteWorkId, needsRemote, Boolean(cachedResolved)]);

  useEffect(() => {
    if (!needsRemote || hydratedProof?.dataUrl) return undefined;
    const node = holderRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "320px" }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [needsRemote, hydratedProof?.dataUrl]);

  useEffect(() => {
    if (!needsRemote || !inView || hydratedProof?.dataUrl) return undefined;
    let cancelled = false;
    loadPostProofOnce(targetPostId)
      .then((payload) => {
        if (cancelled) return;
        const resolved = resolveRemoteMediaFromPayload(payload, proof);
        if (resolved?.dataUrl) {
          setHydratedProof({ ...proof, ...resolved });
        }
      })
      .catch(() => {
        /* ignore lazy fetch failure */
      });
    return () => {
      cancelled = true;
    };
  }, [needsRemote, inView, targetPostId, proof, hydratedProof?.dataUrl]);

  if (!proof) return null;
  const effectiveProof = hydratedProof?.dataUrl ? hydratedProof : proof;

  if (effectiveProof.type === "link" || effectiveProof.kind === "link" || effectiveProof.url) {
    const linkUrl = effectiveProof.url || effectiveProof.link || effectiveProof.name;
    const label = effectiveProof.name || linkUrl;

    if (isYouTubeUrl(linkUrl)) {
      return (
        <YouTubeEmbed
          url={linkUrl}
          title={effectiveProof.name && effectiveProof.name !== linkUrl ? effectiveProof.name : ""}
          className={`${className}-youtube`}
        />
      );
    }

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
  if (effectiveProof.type === "text" || effectiveProof.kind === "text" || effectiveProof.text) {
    const textContent = effectiveProof.text || effectiveProof.name;
    const yt = extractYouTubeUrl(textContent);
    return (
      <div className={`${className}-text-card`}>
        <span className={`${className}-text-icon`} aria-hidden="true">
          📝
        </span>
        <p className={`${className}-text-content`}>{textContent}</p>
        {yt ? (
          <div style={{ marginTop: "8px", width: "100%" }}>
            <YouTubeEmbed url={yt.url} />
          </div>
        ) : null}
      </div>
    );
  }
  if (isImageProof(effectiveProof)) {
    return <ProofImage proof={effectiveProof} className={className} />;
  }
  if (isVideoProof(effectiveProof)) {
    return <ProofVideo proof={effectiveProof} className={className} />;
  }
  if (isPdfProof(effectiveProof)) {
    const label = effectiveProof.name || "PDF";
    return (
      <button
        type="button"
        className={`${className}-pdf`}
        onClick={() => openProofPdf(effectiveProof)}
      >
        <span className={`${className}-pdf-icon`} aria-hidden="true">
          PDF
        </span>
        <span className={`${className}-pdf-label`}>Open {label}</span>
      </button>
    );
  }
  if (effectiveProof.name || needsRemote) {
    if (effectiveProof.name && isYouTubeUrl(effectiveProof.name)) {
      return <YouTubeEmbed url={effectiveProof.name} className={`${className}-youtube`} />;
    }
    const pending = (effectiveProof.hasMedia || needsRemote) && !effectiveProof.dataUrl;
    return (
      <p ref={holderRef} className={`${className}-file`}>
        {pending
          ? `Loading media${effectiveProof.name ? `: ${effectiveProof.name}` : "…"}`
          : `Proof: ${effectiveProof.name}`}
      </p>
    );
  }
  return null;
}
