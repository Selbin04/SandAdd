import { useState, useEffect } from "react";
import { restoreTopicSourceProof } from "../lib/socialFeed.js";

export function IconPaperclip({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function IconMoreVertical({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="19" r="2.2" />
    </svg>
  );
}

export function IconHeartBubble({ className = "", filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path
        d="M15.8 9.2a2.5 2.5 0 0 0-3.5 0l-.3.4-.3-.4a2.5 2.5 0 0 0-3.5 0 2.5 2.5 0 0 0 0 3.5l3.8 3.8 3.8-3.8a2.5 2.5 0 0 0 0-3.5Z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function DoneCoverImage({ cover, className = "" }) {
  const resolveCoverUrl = (c) => {
    if (!c) return "";
    if (typeof c === "string") return c;
    return c.dataUrl || "";
  };

  const [url, setUrl] = useState(() => resolveCoverUrl(cover));

  useEffect(() => {
    if (!cover) {
      setUrl("");
      return;
    }
    if (typeof cover === "string" && cover) {
      setUrl(cover);
      return;
    }
    if (cover.dataUrl) {
      setUrl(cover.dataUrl);
      return;
    }
    if (cover.mediaId) {
      let alive = true;
      restoreTopicSourceProof(cover).then((full) => {
        if (alive && full?.dataUrl) {
          setUrl(full.dataUrl);
        }
      });
      return () => {
        alive = false;
      };
    }
    setUrl("");
  }, [cover, cover?.dataUrl, cover?.mediaId]);

  if (!url) return null;
  return <img src={url} alt="Cover" className={className} />;
}

