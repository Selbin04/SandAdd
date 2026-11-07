/**
 * Utility functions for YouTube video detection, parsing, and embedding.
 */

/**
 * Extracts YouTube video information from a URL string or returns null if not a YouTube link.
 * @param {string} urlOrText - The URL to parse
 * @returns {null | {
 *   videoId: string,
 *   startTime: number | null,
 *   embedUrl: string,
 *   standardEmbedUrl: string,
 *   watchUrl: string,
 *   thumbnailUrl: string,
 *   hqThumbnailUrl: string,
 *   maxResThumbnailUrl: string
 * }}
 */
export function parseYouTubeVideo(urlOrText) {
  if (!urlOrText || typeof urlOrText !== "string") return null;
  const str = urlOrText.trim();
  if (!str) return null;

  // Must contain youtube or youtu.be
  if (!/(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(str)) {
    return null;
  }

  let videoId = null;

  // 1. Match youtu.be/<id>
  const shortMatch = str.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i);
  if (shortMatch && shortMatch[1]) {
    videoId = shortMatch[1];
  }

  // 2. Match youtube.com/watch?v=<id> or /embed/<id> or /shorts/<id> or /live/<id> or /v/<id>
  if (!videoId) {
    const longMatch = str.match(
      /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?[^#\s]*v=|embed\/|shorts\/|live\/|v\/)([a-zA-Z0-9_-]{11})/i
    );
    if (longMatch && longMatch[1]) {
      videoId = longMatch[1];
    }
  }

  // 3. Fallback URL query param search
  if (!videoId) {
    try {
      const normalized = /^https?:\/\//i.test(str) ? str : `https://${str}`;
      const parsed = new URL(normalized);
      if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtube-nocookie.com")) {
        const vParam = parsed.searchParams.get("v");
        if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
          videoId = vParam;
        } else if (parsed.pathname) {
          const segments = parsed.pathname.split("/").filter(Boolean);
          if (["shorts", "embed", "v", "live"].includes(segments[0]) && /^[a-zA-Z0-9_-]{11}$/.test(segments[1])) {
            videoId = segments[1];
          }
        }
      }
    } catch {}
  }

  if (!videoId || videoId.length !== 11) return null;

  // Parse start time (e.g. t=1m20s, t=80, start=80)
  let startTime = null;
  const timeMatch = str.match(/[?&#](?:t|start)=([0-9a-zA-Z]+)/i);
  if (timeMatch && timeMatch[1]) {
    const rawTime = timeMatch[1].toLowerCase();
    if (/^\d+s?$/.test(rawTime)) {
      startTime = parseInt(rawTime, 10);
    } else {
      let totalSeconds = 0;
      const hMatch = rawTime.match(/(\d+)h/);
      const mMatch = rawTime.match(/(\d+)m/);
      const sMatch = rawTime.match(/(\d+)s/);
      if (hMatch) totalSeconds += parseInt(hMatch[1], 10) * 3600;
      if (mMatch) totalSeconds += parseInt(mMatch[1], 10) * 60;
      if (sMatch) totalSeconds += parseInt(sMatch[1], 10);
      if (totalSeconds > 0) startTime = totalSeconds;
    }
  }

  const baseEmbed = `https://www.youtube-nocookie.com/embed/${videoId}`;
  const startParam = startTime ? `start=${startTime}` : "";
  const commonParams = "rel=0&modestbranding=1&playsinline=1&enablejsapi=1";

  return {
    videoId,
    startTime,
    embedUrl: `${baseEmbed}?${[startParam, "autoplay=1", commonParams].filter(Boolean).join("&")}`,
    standardEmbedUrl: `${baseEmbed}?${[startParam, commonParams].filter(Boolean).join("&")}`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}${startTime ? `&t=${startTime}` : ""}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    hqThumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    maxResThumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  };
}

/**
 * Checks whether a given string is or contains a valid YouTube link.
 * @param {string} urlOrText
 * @returns {boolean}
 */
export function isYouTubeUrl(urlOrText) {
  return Boolean(parseYouTubeVideo(urlOrText));
}

/**
 * Scans a text string to find the first YouTube URL inside it.
 * @param {string} text
 * @returns {null | { url: string, video: ReturnType<typeof parseYouTubeVideo> }}
 */
export function extractYouTubeUrl(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/(https?:\/\/[^\s]+|youtu\.be\/[a-zA-Z0-9_-]{11}|(?:www\.)?youtube\.com\/[^\s]+)/i);
  if (!match) return null;
  const parsed = parseYouTubeVideo(match[0]);
  if (!parsed) return null;
  return {
    url: match[0],
    video: parsed,
  };
}

