import { Router } from "express";
import zlib from "zlib";

/**
 * Extract text from PDF buffer by decompressing FlateDecode streams
 * and extracting text operators (Tj, TJ, text literals).
 */
function extractPdfText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return "";
  let fullText = "";

  try {
    const rawString = buffer.toString("binary");

    // Extract PDF metadata if present
    const titleMatch = /\/Title\s*\(([^)]+)\)/i.exec(rawString);
    const subjectMatch = /\/Subject\s*\(([^)]+)\)/i.exec(rawString);
    if (titleMatch) fullText += titleMatch[1] + ".\n";
    if (subjectMatch) fullText += subjectMatch[1] + ".\n";

    // Find and decompress all stream blocks
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;
    let streamCount = 0;

    while ((match = streamRegex.exec(rawString)) !== null && streamCount < 30) {
      streamCount += 1;
      const rawStream = Buffer.from(match[1], "binary");
      let decompressed = "";

      try {
        decompressed = zlib.inflateSync(rawStream).toString("latin1");
      } catch {
        try {
          decompressed = zlib.unzipSync(rawStream).toString("latin1");
        } catch {
          decompressed = match[1];
        }
      }

      // 1. Match Tj operators: (some text) Tj
      const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(decompressed)) !== null) {
        const clean = tjMatch[1].replace(/\\([()\\])/g, "$1").trim();
        if (clean.length > 1 && !/^[\x00-\x1F]+$/.test(clean)) {
          fullText += clean + " ";
        }
      }

      // 2. Match TJ array operators: [(s) 10 (t) 20 (r)] TJ
      const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
      let arrMatch;
      while ((arrMatch = tjArrayRegex.exec(decompressed)) !== null) {
        const parts = arrMatch[1].match(/\(([^)]+)\)/g) || [];
        const word = parts
          .map((p) => p.slice(1, -1).replace(/\\([()\\])/g, "$1"))
          .join("");
        if (word.length > 1) {
          fullText += word + " ";
        }
      }

      // 3. Fallback: extract consecutive printable ASCII chunks if no Tj matched
      if (!fullText) {
        const words = decompressed.match(/[A-Za-z0-9,.:;'"?!-]{3,}/g) || [];
        if (words.length > 15) {
          fullText += words.slice(0, 100).join(" ") + " ";
        }
      }
    }
  } catch (err) {
    console.warn("Could not fully extract text from PDF:", err?.message);
  }

  // Clean up whitespace and non-printable characters
  return fullText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Clean and normalize text from HTML, extracting real article body
 */
function extractHtmlArticle(html = "") {
  let title = "";
  let description = "";
  let headings = [];
  let paragraphs = [];

  try {
    // 1. Title
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    if (titleMatch) title = titleMatch[1].replace(/\s+/g, " ").trim();

    // 2. Meta description & og:description
    const ogDescMatch =
      /<meta[^>]+(?:property|name)=["'](?:og:description|description|twitter:description)["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:description|description|twitter:description)["']/i.exec(html);
    if (ogDescMatch) description = ogDescMatch[1].replace(/\s+/g, " ").trim();

    // 3. Meta og:title fallback
    if (!title) {
      const ogTitleMatch =
        /<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["']/i.exec(html);
      if (ogTitleMatch) title = ogTitleMatch[1].replace(/\s+/g, " ").trim();
    }

    // 4. Extract headings (h1, h2, h3)
    const headingMatches = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)];
    headings = headingMatches
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter((h) => h.length > 3 && h.length < 120 && !/sign in|cookie|subscribe|login/i.test(h))
      .slice(0, 5);

    // 5. Remove junk sections before extracting paragraphs
    const bodyOnly = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ")
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ");

    // 6. Extract paragraphs
    const pMatches = [...bodyOnly.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
    paragraphs = pMatches
      .map((m) =>
        m[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, " ")
          .trim()
      )
      .filter((p) => {
        if (p.length < 35) return false;
        if (/cookie policy|privacy policy|terms of service|all rights reserved|subscribe to|sign in/i.test(p))
          return false;
        return true;
      });
  } catch (err) {
    console.warn("HTML parse error:", err?.message);
  }

  const combinedText = paragraphs.join("\n\n");
  return { title, description, headings, paragraphs, combinedText };
}

/**
 * Intelligent content-based summarizer (summarizes actual content without requiring an external API key)
 */
function summarizeContentLocally(rawText, { title = "", type = "link", domain = "" } = {}) {
  const clean = String(rawText || "").replace(/\s+/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      overview: `Resource at ${domain || "attached source"}. Click to view.`,
      keyPoints: ["No extractable text content found inside this resource."],
      sourceType: "Web Resource",
      estimatedTime: "Instant",
    };
  }

  // Break into clean sentences
  const allSentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 250);

  // Extract key topic words from title and top headings
  const titleWords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !/home|page|website|github|wiki|official/i.test(w));

  // Score sentences by relevance and substantive length
  const scored = allSentences.map((sentence, index) => {
    let score = 0;
    const sLower = sentence.toLowerCase();

    // Earlier sentences carry intro value
    if (index === 0) score += 5;
    if (index === 1) score += 3;
    if (index === 2) score += 2;

    // Matches with title keywords
    for (const tw of titleWords) {
      if (sLower.includes(tw)) score += 3;
    }

    // Good sentence length (50 - 160 chars)
    if (sentence.length >= 50 && sentence.length <= 160) score += 2;

    // Demote boilerplate sentences
    if (/cookies|browser|javascript|privacy|rights reserved|click here/i.test(sLower)) {
      score -= 10;
    }

    return { sentence, score, index };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Select the top 3-4 distinct sentences for key points
  const selectedPoints = scored
    .slice(0, 4)
    .sort((a, b) => a.index - b.index) // Restore narrative order
    .map((item) => item.sentence);

  // Compose overview from the lead or top sentence
  let overview = "";
  if (allSentences[0]) {
    overview = allSentences[0];
    if (allSentences[1] && overview.length < 90) {
      overview += " " + allSentences[1];
    }
  } else {
    overview = clean.slice(0, 160) + "…";
  }

  // Estimated reading time
  const readMins = Math.max(1, Math.ceil(wordCount / 200));

  return {
    overview,
    keyPoints: selectedPoints.length > 0 ? selectedPoints : [overview],
    sourceType:
      type === "file"
        ? "Document File"
        : /github\.com/i.test(domain)
          ? "GitHub Repository"
          : /youtube\.com|youtu\.be/i.test(domain)
            ? "Video"
            : /docs\.|documentation|wiki/i.test(domain)
              ? "Documentation"
              : "Web Article",
    estimatedTime: `${readMins} min read (${wordCount} words)`,
  };
}

/**
 * Call Google Gemini REST API to summarize content
 */
async function callGeminiApi({ prompt, apiKey, inlineData = null }) {
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const parts = [{ text: prompt }];
  if (inlineData && inlineData.mimeType && inlineData.data) {
    parts.push({
      inline_data: {
        mime_type: inlineData.mimeType,
        data: inlineData.data,
      },
    });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = String(candidateText).trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    return JSON.parse(cleaned);
  } finally {
    clearTimeout(timer);
  }
}

export default function createAiRoutes() {
  const router = Router();

  router.post("/summarize-source", async (req, res) => {
    try {
      const {
        type = "text",
        content = "",
        proof = null,
        title = "",
        clientApiKey = "",
      } = req.body || {};

      const apiKey =
        clientApiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.OPENAI_API_KEY ||
        "";

      const normalizedContent = String(content || "").trim();
      const isUrl =
        type === "link" ||
        /^https?:\/\//i.test(normalizedContent) ||
        /^[\w.-]+\.[a-z]{2,}/i.test(normalizedContent);

      // ==========================================
      // CASE 1: WEB LINK / URL
      // ==========================================
      if (isUrl) {
        const targetUrl = normalizedContent.startsWith("http")
          ? normalizedContent
          : `https://${normalizedContent}`;

        let domain = "";
        try {
          domain = new URL(targetUrl).hostname.replace(/^www\./, "");
        } catch {
          domain = targetUrl;
        }

        let pageTitle = title || "";
        let pageDesc = "";
        let articleText = "";

        // Special handling for YouTube videos via oEmbed API
        if (/youtube\.com|youtu\.be/i.test(domain)) {
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
            const oeRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
            if (oeRes.ok) {
              const oeData = await oeRes.json();
              pageTitle = oeData.title || pageTitle;
              pageDesc = `YouTube video by ${oeData.author_name || "creator"}.`;
              articleText = `Video Title: ${oeData.title}. Channel: ${oeData.author_name}. URL: ${targetUrl}.`;
            }
          } catch {
            /* continue to regular fetch */
          }
        }

        // Special handling for GitHub repos
        if (/github\.com/i.test(domain)) {
          const ghMatch = /github\.com\/([^\/]+)\/([^\/]+)/i.exec(targetUrl);
          if (ghMatch) {
            const [, owner, repo] = ghMatch;
            const cleanRepo = repo.replace(/\.git$/i, "");
            try {
              // Try fetching raw README
              const rawReadmeUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/HEAD/README.md`;
              const rmRes = await fetch(rawReadmeUrl, { signal: AbortSignal.timeout(4000) });
              if (rmRes.ok) {
                const readmeContent = await rmRes.text();
                articleText = readmeContent.slice(0, 5000);
                pageTitle = `${owner}/${cleanRepo} (GitHub Repository)`;
              }
            } catch {
              /* continue to standard fetch */
            }
          }
        }

        // Standard Webpage Fetch
        if (!articleText) {
          try {
            const fetchRes = await fetch(targetUrl, {
              signal: AbortSignal.timeout(6000),
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
              },
            });

            if (fetchRes.ok) {
              const html = await fetchRes.text();
              const parsed = extractHtmlArticle(html);
              if (parsed.title) pageTitle = parsed.title;
              if (parsed.description) pageDesc = parsed.description;
              articleText = parsed.combinedText || parsed.description || "";
            }
          } catch (fetchErr) {
            console.warn("Could not fetch URL for summarization:", fetchErr?.message);
          }
        }

        const effectiveTitle = pageTitle || domain;
        const fullContentToSummarize = `${pageDesc ? pageDesc + "\n\n" : ""}${articleText}`;

        // 1. If Gemini API Key is available, prompt Gemini for AI synthesis
        if (apiKey && fullContentToSummarize.length > 50) {
          try {
            const prompt = `You are a productivity AI assistant. The user has attached this web source to their task.
Read the actual content below and provide a concise summary of what is inside, so the user understands the substance of this page before opening it.

Resource URL: ${targetUrl}
Domain: ${domain}
Page Title: ${effectiveTitle}
Extracted Content:
"""
${fullContentToSummarize.slice(0, 3000)}
"""

Return a JSON object with this exact structure:
{
  "overview": "A clear 1-2 sentence explanation of what this page is about and what specific information/solution it provides.",
  "keyPoints": [
    "Key substantive takeaway or section 1",
    "Key substantive takeaway or section 2",
    "Key substantive takeaway or section 3"
  ],
  "sourceType": "Specific type (e.g. Documentation, Technical Guide, GitHub Repository, Video, Article, API Reference)",
  "estimatedTime": "Estimated read or review time (e.g. 3 min read, 5 min video)"
}`;

            const geminiResult = await callGeminiApi({ prompt, apiKey });
            if (geminiResult && geminiResult.overview) {
              return res.json({
                ok: true,
                summary: {
                  title: effectiveTitle,
                  overview: geminiResult.overview,
                  keyPoints: Array.isArray(geminiResult.keyPoints)
                    ? geminiResult.keyPoints.slice(0, 4)
                    : [],
                  sourceType: geminiResult.sourceType || "Web Link",
                  estimatedTime: geminiResult.estimatedTime || "2 min read",
                  provider: "gemini",
                  generatedAt: new Date().toISOString(),
                },
              });
            }
          } catch (geminiErr) {
            console.warn("Gemini call failed, falling back to local content analyzer:", geminiErr?.message);
          }
        }

        // 2. Intelligent Local Content Summarizer (Reads the actual page content)
        const localSummary = summarizeContentLocally(fullContentToSummarize || effectiveTitle, {
          title: effectiveTitle,
          type: "link",
          domain,
        });

        return res.json({
          ok: true,
          summary: {
            title: effectiveTitle,
            overview: pageDesc || localSummary.overview,
            keyPoints: localSummary.keyPoints,
            sourceType: localSummary.sourceType,
            estimatedTime: localSummary.estimatedTime,
            provider: "content-analyzer",
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // ==========================================
      // CASE 2: ATTACHED FILE
      // ==========================================
      if (type === "file" || (proof && (proof.dataUrl || proof.name))) {
        const fileName = proof?.name || title || "Attached file";
        const mimeType = proof?.type || "";
        const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(fileName);
        const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName);
        const isCodeOrText =
          /\.(txt|md|markdown|js|jsx|ts|tsx|json|csv|py|html|css|yaml|yml|sql|sh|log|xml)$/i.test(fileName) ||
          mimeType.startsWith("text/") ||
          mimeType === "application/json";

        // Extract base64 payload
        let base64Data = null;
        if (proof?.dataUrl && proof.dataUrl.includes(",")) {
          base64Data = proof.dataUrl.split(",")[1];
        }

        let extractedFileText = "";

        // Extract text from text/code files
        if (isCodeOrText && base64Data) {
          try {
            extractedFileText = Buffer.from(base64Data, "base64").toString("utf-8");
          } catch (err) {
            console.warn("Could not decode text file:", err?.message);
          }
        }

        // Extract text from PDF documents
        if (isPdf && base64Data) {
          try {
            const pdfBuffer = Buffer.from(base64Data, "base64");
            extractedFileText = extractPdfText(pdfBuffer);
          } catch (err) {
            console.warn("Could not extract PDF text:", err?.message);
          }
        }

        // If Gemini API Key is available, prompt Gemini
        if (apiKey && (extractedFileText || (base64Data && (isImage || isPdf)))) {
          try {
            let prompt = "";
            let inlineData = null;

            if (isImage && base64Data) {
              prompt = `You are a productivity assistant. The user attached this image file (${fileName}) as a task source.
Analyze the visual content of this image (including any text, diagrams, code, UI, or information visible inside) and summarize what it shows.

Return a JSON object with this exact structure:
{
  "overview": "A clear 1-2 sentence description of what this image shows and what information is in it.",
  "keyPoints": [
    "Key visual detail or text visible 1",
    "Key visual detail or text visible 2",
    "Key visual detail or text visible 3"
  ],
  "sourceType": "Image Proof / Diagram",
  "estimatedTime": "Visual inspection"
}`;
              inlineData = {
                mimeType: mimeType || "image/jpeg",
                data: base64Data,
              };
            } else if (isPdf && base64Data && !extractedFileText) {
              // Scanned PDF with no text stream — pass raw PDF to Gemini multimodal
              prompt = `You are a productivity assistant. The user attached this PDF document (${fileName}) as a task source.
Read and summarize the actual contents inside this document.

Return a JSON object with this exact structure:
{
  "overview": "A clear 1-2 sentence summary of what this PDF document covers and its main purpose.",
  "keyPoints": [
    "Key topic or section inside 1",
    "Key topic or section inside 2",
    "Key topic or section inside 3"
  ],
  "sourceType": "PDF Document",
  "estimatedTime": "Estimated reading time"
}`;
              inlineData = {
                mimeType: "application/pdf",
                data: base64Data,
              };
            } else {
              // We have extracted text from the file (PDF or code/text)
              prompt = `You are a productivity assistant. The user attached this file (${fileName}) as a task source.
Read the actual content of this file below and summarize what is inside, what it does, and key takeaways so the user knows what is in the file before opening it.

File Name: ${fileName}
Content excerpt:
"""
${extractedFileText.slice(0, 3500)}
"""

Return a JSON object with this exact structure:
{
  "overview": "A clear 1-2 sentence summary of what this file contains, what it does, or what topics it discusses.",
  "keyPoints": [
    "Key function, section, or finding 1",
    "Key function, section, or finding 2",
    "Key function, section, or finding 3"
  ],
  "sourceType": "${isPdf ? "PDF Document" : isCodeOrText ? "Code / Data File" : "Document"}",
  "estimatedTime": "Estimated read or review time"
}`;
            }

            const geminiResult = await callGeminiApi({ prompt, apiKey, inlineData });
            if (geminiResult && geminiResult.overview) {
              return res.json({
                ok: true,
                summary: {
                  title: fileName,
                  overview: geminiResult.overview,
                  keyPoints: Array.isArray(geminiResult.keyPoints)
                    ? geminiResult.keyPoints.slice(0, 4)
                    : [],
                  sourceType: geminiResult.sourceType || (isPdf ? "PDF Document" : isImage ? "Image File" : "File"),
                  estimatedTime: geminiResult.estimatedTime || "1 min",
                  provider: "gemini",
                  generatedAt: new Date().toISOString(),
                },
              });
            }
          } catch (geminiErr) {
            console.warn("Gemini file analysis failed, using local content analyzer:", geminiErr?.message);
          }
        }

        // Local Content Summarization on actual file text
        if (extractedFileText && extractedFileText.length > 20) {
          const localFileSummary = summarizeContentLocally(extractedFileText, {
            title: fileName,
            type: "file",
          });

          return res.json({
            ok: true,
            summary: {
              title: fileName,
              overview: localFileSummary.overview,
              keyPoints: localFileSummary.keyPoints,
              sourceType: isPdf
                ? "PDF Document"
                : isCodeOrText
                  ? `Code/Text File (${fileName.split(".").pop()?.toUpperCase() || "TXT"})`
                  : "Document",
              estimatedTime: localFileSummary.estimatedTime,
              provider: "content-analyzer",
              generatedAt: new Date().toISOString(),
            },
          });
        }

        // If file is an image without API key
        const sizeKb = proof?.size ? Math.round(proof.size / 1024) : null;
        if (isImage) {
          return res.json({
            ok: true,
            summary: {
              title: fileName,
              overview: `Image proof attachment (${fileName})${sizeKb ? ` of size ${sizeKb} KB` : ""}. Click to inspect full image.`,
              keyPoints: [
                `Image format: ${mimeType || "image"}`,
                sizeKb ? `File size: ${sizeKb} KB` : "Uploaded task attachment",
                "Tip: Add GEMINI_API_KEY to enable AI OCR & visual inspection",
              ],
              sourceType: "Image Proof",
              estimatedTime: "Visual check",
              provider: "content-analyzer",
              generatedAt: new Date().toISOString(),
            },
          });
        }

        // Fallback for empty/unrecognized binary
        return res.json({
          ok: true,
          summary: {
            title: fileName,
            overview: `Attached file (${fileName})${sizeKb ? `, ${sizeKb} KB` : ""}.`,
            keyPoints: [
              `Type: ${mimeType || "File attachment"}`,
              sizeKb ? `Size: ${sizeKb} KB` : "Attached file",
              "Click 'Open' to inspect the full contents.",
            ],
            sourceType: isPdf ? "PDF Document" : "Attached File",
            estimatedTime: "1 min",
            provider: "content-analyzer",
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // ==========================================
      // CASE 3: TEXT NOTES / SNIPPET
      // ==========================================
      const noteText = normalizedContent || title || "Empty note";

      if (apiKey && noteText.length > 20) {
        try {
          const prompt = `You are a productivity assistant. The user wrote this text note as a task source.
Summarize what it is about in 1-2 concise sentences and extract 2-3 key takeaways.

Note content:
"""
${noteText.slice(0, 2000)}
"""

Return a JSON object with this exact structure:
{
  "overview": "1-2 sentence TL;DR distillation of what this note is about.",
  "keyPoints": [
    "Key takeaway 1",
    "Key takeaway 2"
  ],
  "sourceType": "Task Notes",
  "estimatedTime": "1 min read"
}`;

          const geminiResult = await callGeminiApi({ prompt, apiKey });
          if (geminiResult && geminiResult.overview) {
            return res.json({
              ok: true,
              summary: {
                title: title || "Text Note",
                overview: geminiResult.overview,
                keyPoints: Array.isArray(geminiResult.keyPoints)
                  ? geminiResult.keyPoints.slice(0, 4)
                  : [],
                sourceType: geminiResult.sourceType || "Task Notes",
                estimatedTime: geminiResult.estimatedTime || "1 min read",
                provider: "gemini",
                generatedAt: new Date().toISOString(),
              },
            });
          }
        } catch (geminiErr) {
          console.warn("Gemini note summarization failed:", geminiErr?.message);
        }
      }

      // Smart local text note summarizer
      const localNoteSummary = summarizeContentLocally(noteText, {
        title: title || "Task Notes",
        type: "text",
      });

      return res.json({
        ok: true,
        summary: {
          title: title || "Text Note",
          overview: localNoteSummary.overview,
          keyPoints: localNoteSummary.keyPoints,
          sourceType: "Task Note",
          estimatedTime: localNoteSummary.estimatedTime,
          provider: "content-analyzer",
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("AI summarize source endpoint failed:", error);
      return res.status(500).json({
        error: "Failed to summarize source",
        details: error.message,
      });
    }
  });

  /**
   * AI Workspace: Generate up to 5 progress files at once
   */
  router.post("/generate-topics", async (req, res) => {
    try {
      const {
        prompt = "",
        count = 3,
        projectName = "",
        existingTopics = [],
        clientApiKey = "",
      } = req.body || {};

      const numItems = Math.max(1, Math.min(5, parseInt(count, 10) || 3));
      const cleanPrompt = String(prompt || "").trim();
      const apiKey =
        clientApiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.OPENAI_API_KEY ||
        "";

      let generatedTopics = [];

      // 1. If Gemini API key is available, generate with Gemini
      if (apiKey) {
        try {
          const geminiPrompt = `You are a world-class AI productivity architect and milestone planner.
User's Idea / Prompt: "${cleanPrompt || "Create structured progress files"}"
Progress Folder Name: "${projectName || "Progress Folder"}"
Number of Progress Files to create: ${numItems}
Existing Milestones in folder: ${
            Array.isArray(existingTopics) && existingTopics.length > 0
              ? existingTopics.map((t) => (typeof t === "string" ? t : t?.text || "")).filter(Boolean).join(", ")
              : "None yet"
          }

Instructions:
1. Deeply understand the core idea, domain, skill, or objective expressed in the user's prompt ("${cleanPrompt}").
2. Build exactly ${numItems} sequential, highly suitable progress files (milestones) directly derived from the user's idea.
3. For each progress file, provide:
   - "text": A crisp, motivating milestone title (5-10 words, e.g. "Step 1: Set Up Project Architecture & Core Dependencies")
   - "description": A comprehensive, practical description text for this progress file (2-3 complete sentences explaining what this progress file is, key deliverables, implementation steps, and actionable guidance).
   - "source": An appropriate, real, high-quality reference URL or authoritative documentation link directly relevant to this specific step (e.g. official docs, guides, standards, or learning resources).
   - "coverTheme": One of ["space", "sunset", "neon", "forest", "royal", "midnight"]
   - "estimatedMinutes": Suggested time in minutes (e.g. 30, 45, 60, 90)

Return ONLY a strict JSON array of ${numItems} objects with exact keys: text, description, source, coverTheme, estimatedMinutes.
Example format:
[
  {
    "text": "Step 1: Foundational Setup & Dependency Architecture",
    "description": "Initialize the project environment, configure linting and directory structures, and establish core library dependencies.",
    "source": "https://developer.mozilla.org/en-US/docs/Learn",
    "coverTheme": "neon",
    "estimatedMinutes": 30
  }
]`;

          const geminiResult = await callGeminiApi({ prompt: geminiPrompt, apiKey });
          if (Array.isArray(geminiResult)) {
            generatedTopics = geminiResult;
          } else if (geminiResult && Array.isArray(geminiResult.topics)) {
            generatedTopics = geminiResult.topics;
          }
        } catch (geminiErr) {
          console.warn("Gemini generation fallback:", geminiErr?.message);
        }
      }

      // 2. Intelligent local fallback generator if no API key or Gemini failed
      if (!Array.isArray(generatedTopics) || generatedTopics.length === 0) {
        generatedTopics = generateFallbackMilestones(cleanPrompt, projectName, numItems);
      }

      // Sanitize and ensure maximum 5 items
      const sanitized = generatedTopics.slice(0, numItems).map((item, idx) => ({
        id: `gen_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        text: String(item.text || `Progress Step ${idx + 1}`).trim(),
        description: String(item.description || "Actionable milestone for this progress path.").trim(),
        source: String(item.source || "").trim(),
        coverTheme: item.coverTheme || ["space", "sunset", "neon", "forest", "royal", "midnight"][idx % 6],
        estimatedMinutes: parseInt(item.estimatedMinutes, 10) || 45,
      }));

      return res.json({
        ok: true,
        count: sanitized.length,
        topics: sanitized,
      });
    } catch (err) {
      console.error("AI generate-topics failed:", err);
      return res.status(500).json({
        error: "Failed to generate progress files",
        details: err?.message,
      });
    }
  });

  return router;
}

/**
 * Intelligent domain-aware milestone generator fallback.
 * Parses user prompt ideas and synthesizes suitable progress files with rich descriptions and appropriate sources.
 */
function generateFallbackMilestones(prompt = "", projectName = "", count = 3) {
  const num = Math.max(1, Math.min(5, parseInt(count, 10) || 3));
  const raw = `${prompt} ${projectName}`.trim();
  const lower = raw.toLowerCase();

  // Extract cleaned-up subject from user prompt
  let subject = prompt.trim()
    .replace(/^(create|make|generate|build|give me|write|design|plan|prepare|learn|master)\s+/i, "")
    .replace(/^(milestones|steps|progress files|tasks|roadmap|plan)\s+(for|about|to|on)\s+/i, "")
    .replace(/^(how to|in \d+ steps?)\s+/i, "")
    .replace(/\s+(in \d+ steps?|up to \d+|milestones?)$/i, "")
    .trim();

  if (!subject) {
    subject = projectName.trim() || "Progress Milestone";
  }

  // Capitalize first letter of subject
  subject = subject.charAt(0).toUpperCase() + subject.slice(1);

  let pool = [];

  if (/react|next\.?js|vue|angular|svelte|frontend|web\s*dev|html|css|tailwind|javascript|typescript/i.test(lower)) {
    pool = [
      {
        text: `Phase 1: Project Setup & Core Tooling for ${subject}`,
        description: `Initialize project repository, install development dependencies, configure linting, and establish modern folder architecture for ${subject}.`,
        source: "https://developer.mozilla.org/en-US/docs/Learn",
        coverTheme: "neon",
      },
      {
        text: `Phase 2: Component Architecture & State Management for ${subject}`,
        description: `Build reusable UI primitive components, structure modular layouts, and implement responsive state management patterns.`,
        source: "https://react.dev/learn",
        coverTheme: "space",
      },
      {
        text: `Phase 3: Interactive Workflows & Data Integration for ${subject}`,
        description: `Connect user interface forms to backend endpoints, handle asynchronous loading states, and implement robust error boundaries.`,
        source: "https://web.dev/learn",
        coverTheme: "midnight",
      },
      {
        text: `Phase 4: Optimization, Accessibility & Automated Testing for ${subject}`,
        description: `Conduct performance audits, adhere to WCAG accessibility criteria, minimize bundle size, and write unit/integration test coverage.`,
        source: "https://vite.dev/guide/",
        coverTheme: "royal",
      },
      {
        text: `Phase 5: Production Deployment & Verification for ${subject}`,
        description: `Configure CI/CD build pipelines, deploy to cloud hosting with custom domains, and verify cross-browser responsiveness.`,
        source: "https://vercel.com/docs",
        coverTheme: "sunset",
      },
    ];
  } else if (/python|ai|machine\s*learning|deep\s*learning|data\s*science|pandas|pytorch|tensorflow|nlp|llm/i.test(lower)) {
    pool = [
      {
        text: `Phase 1: Environment Setup & Dataset Ingestion for ${subject}`,
        description: `Set up Python virtual environment, install data analysis libraries, and load raw datasets with automated verification.`,
        source: "https://docs.python.org/3/tutorial/",
        coverTheme: "space",
      },
      {
        text: `Phase 2: Exploratory Analysis & Feature Engineering for ${subject}`,
        description: `Clean missing values, generate statistical distributions, and transform input features for predictive modeling.`,
        source: "https://pandas.pydata.org/docs/getting_started/",
        coverTheme: "midnight",
      },
      {
        text: `Phase 3: Model Architecture & Baseline Training for ${subject}`,
        description: `Design baseline algorithm, establish cross-validation splits, and train initial models with loss metric tracking.`,
        source: "https://pytorch.org/tutorials/",
        coverTheme: "neon",
      },
      {
        text: `Phase 4: Hyperparameter Tuning & Model Validation for ${subject}`,
        description: `Tune hyperparameters, compare test accuracy across benchmarks, and generate confusion matrices and error reports.`,
        source: "https://huggingface.co/docs",
        coverTheme: "royal",
      },
      {
        text: `Phase 5: Inference Pipeline & Practical Deployment for ${subject}`,
        description: `Export trained weights, containerize inference service with FastAPI, and document reproducible execution steps.`,
        source: "https://scikit-learn.org/stable/tutorial/",
        coverTheme: "forest",
      },
    ];
  } else if (/fitness|workout|gym|health|diet|running|marathon|weight|exercise|nutrition|yoga/i.test(lower)) {
    pool = [
      {
        text: `Phase 1: Baseline Assessment & Goal Calibration for ${subject}`,
        description: `Record baseline fitness metrics, establish safe movement standards, and outline weekly training volume targets for ${subject}.`,
        source: "https://www.who.int/health-topics/physical-activity",
        coverTheme: "forest",
      },
      {
        text: `Phase 2: Nutritional Blueprint & Hydration Protocol for ${subject}`,
        description: `Calculate daily macronutrient targets, plan nutrient-dense meals, and establish consistent hydration timing for optimal energy.`,
        source: "https://nutrition.gov/topics/basic-nutrition",
        coverTheme: "sunset",
      },
      {
        text: `Phase 3: Core Conditioning & Movement Mechanics for ${subject}`,
        description: `Execute dynamic warm-ups, master proper biomechanical form across key compound movements, and track initial sets.`,
        source: "https://www.acefitness.org/resources/everyone/exercise-library/",
        coverTheme: "neon",
      },
      {
        text: `Phase 4: Progressive Overload & Endurance Scaling for ${subject}`,
        description: `Systematically increase training resistance, pace, or intervals while maintaining strict recovery protocols.`,
        source: "https://www.runnersworld.com/training/",
        coverTheme: "space",
      },
      {
        text: `Phase 5: Performance Benchmark & Long-Term Roadmap for ${subject}`,
        description: `Re-evaluate physical benchmarks against initial baselines, analyze adaptations, and build a sustainable maintenance plan.`,
        source: "https://bodybuilding.com/content",
        coverTheme: "royal",
      },
    ];
  } else if (/business|startup|saas|marketing|ecommerce|sales|product|launch|finance/i.test(lower)) {
    pool = [
      {
        text: `Phase 1: Market Research & Audience Discovery for ${subject}`,
        description: `Identify high-urgency customer pain points, conduct competitor gap analysis, and define unique value proposition for ${subject}.`,
        source: "https://hbr.org",
        coverTheme: "midnight",
      },
      {
        text: `Phase 2: Value Proposition & Offer Packaging for ${subject}`,
        description: `Draft compelling offer copy, outline tiered pricing structures, and create risk-reversal guarantees for conversion.`,
        source: "https://ycombinator.com/library",
        coverTheme: "sunset",
      },
      {
        text: `Phase 3: High-Converting Landing Experience for ${subject}`,
        description: `Build responsive conversion page, integrate lead capture forms, and instrument analytics funnels.`,
        source: "https://stripe.com/resources",
        coverTheme: "space",
      },
      {
        text: `Phase 4: Multi-Channel Outreach & Traffic Acquisition for ${subject}`,
        description: `Launch targeted distribution across search, social communities, and direct partner channels to validate traffic.`,
        source: "https://moz.com/beginners-guide-to-seo",
        coverTheme: "neon",
      },
      {
        text: `Phase 5: KPI Review, Conversion Optimization & Scaling for ${subject}`,
        description: `Analyze acquisition costs, gather customer feedback, optimize churn points, and scale winning promotional vectors.`,
        source: "https://help.shopify.com",
        coverTheme: "royal",
      },
    ];
  } else {
    // Dynamic universal prompt-driven synthesis
    const enc = encodeURIComponent(subject.split(" ")[0].toLowerCase());
    pool = [
      {
        text: `Phase 1: Foundations, Scope & Setup for ${subject}`,
        description: `Research essential principles, organize prerequisite resources, and establish workspace foundations for ${subject}.`,
        source: `https://en.wikipedia.org/wiki/${enc || "Productivity"}`,
        coverTheme: "space",
      },
      {
        text: `Phase 2: Core Methodology & First Prototype for ${subject}`,
        description: `Map out sequential steps, construct initial functional drafts, and test early assumptions against clear success criteria.`,
        source: "https://khanacademy.org",
        coverTheme: "neon",
      },
      {
        text: `Phase 3: Deep Execution & Key Deliverables for ${subject}`,
        description: `Tackle primary workload, produce tangible milestone artifacts, and document key findings and best practices.`,
        source: "https://notion.so",
        coverTheme: "sunset",
      },
      {
        text: `Phase 4: Quality Review, Polish & Refinement for ${subject}`,
        description: `Identify edge cases, eliminate friction, polish visual/technical quality, and ensure rigorous standards for ${subject}.`,
        source: "https://medium.com",
        coverTheme: "midnight",
      },
      {
        text: `Phase 5: Capstone Completion, Validation & Launch for ${subject}`,
        description: `Synthesize finished components, conduct final verification, publish milestone documentation, and celebrate completion.`,
        source: "https://github.com",
        coverTheme: "royal",
      },
    ];
  }

  const themes = ["space", "sunset", "neon", "forest", "royal", "midnight"];
  return pool.slice(0, num).map((item, idx) => ({
    ...item,
    coverTheme: item.coverTheme || themes[idx % themes.length],
    estimatedMinutes: 30 + idx * 15,
  }));
}
