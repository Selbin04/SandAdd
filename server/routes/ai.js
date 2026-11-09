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

CRITICAL INSTRUCTIONS:
1. Deeply understand the core idea, domain, technical framework, or objective expressed in the user's prompt ("${cleanPrompt}").
2. Build exactly ${numItems} sequential, highly suitable progress files (milestones) directly derived from the user's idea.
3. For EVERY progress file, you MUST satisfy these strict requirements:
   - "text": A crisp, professional milestone title (e.g. "Phase 1: Environment Setup & Core Dependencies for ...")
   - "description": A comprehensive, in-depth description text of MINIMUM 2 LARGE, INFORMATIVE SENTENCES (at least 60-90 words total).
     * Sentence 1 must articulate the purpose, technical specifications, and key deliverables of this milestone.
     * Sentence 2 must outline actionable step-by-step implementation instructions, best practices, and verification criteria.
   - "links": An array of AT LEAST 5 SUITABLE, HIGH-QUALITY REFERENCE LINKS directly related to this milestone (e.g. official documentation, GitHub repositories, API guides, tutorials, cheatsheets, or specification standards). Each item must be:
     {"title": "Descriptive Link Title", "url": "https://..."}
     You MUST provide at least 5 distinct, real, working URLs per milestone.
   - "source": Primary reference URL (the first link from the links array)
   - "coverTheme": One of ["space", "sunset", "neon", "forest", "royal", "midnight"]
   - "estimatedMinutes": Suggested time in minutes (e.g. 30, 45, 60, 90)

Return ONLY a strict JSON array of ${numItems} objects with exact keys: text, description, links, source, coverTheme, estimatedMinutes.
Example format:
[
  {
    "text": "Phase 1: Architectural Foundation & Tooling Setup for Stripe Checkout",
    "description": "Initialize the modern development environment with TypeScript and Next.js, configure strict environment variables for payment keys, and establish modular directory hierarchies for API routes and checkout webhooks. Install the official Stripe Node SDK alongside robust validation libraries, implement secure CORS headers, and verify sandbox connectivity using Stripe CLI test fixtures to ensure complete pipeline integrity before proceeding.",
    "links": [
      { "title": "Stripe Checkout Quickstart Documentation", "url": "https://stripe.com/docs/checkout/quickstart" },
      { "title": "Stripe Node.js SDK API Reference", "url": "https://stripe.com/docs/api" },
      { "title": "Next.js Route Handlers & Server API Architecture", "url": "https://nextjs.org/docs/app/building-your-application/routing/route-handlers" },
      { "title": "MDN Web Security & CORS Configuration Guide", "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS" },
      { "title": "GitHub Stripe Samples Next.js Repository", "url": "https://github.com/stripe-samples" }
    ],
    "source": "https://stripe.com/docs/checkout/quickstart",
    "coverTheme": "neon",
    "estimatedMinutes": 45
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

      // Sanitize and ensure maximum 5 items, guaranteeing minimum 2 large sentences & minimum 5 suitable links
      const sanitized = generatedTopics.slice(0, numItems).map((item, idx) => {
        let links = [];
        if (Array.isArray(item.links) && item.links.length > 0) {
          links = item.links.map((l, lIdx) => ({
            title: String(l?.title || `Related Resource ${lIdx + 1}`).trim(),
            url: String(l?.url || l?.source || l || "").trim(),
          })).filter((l) => l.url.length > 0);
        } else if (Array.isArray(item.sources) && item.sources.length > 0) {
          links = item.sources.map((s, sIdx) => ({
            title: String(s?.title || `Related Resource ${sIdx + 1}`).trim(),
            url: String(s?.url || s?.content || s?.source || "").trim(),
          })).filter((l) => l.url.length > 0);
        }

        if (item.source && !links.some((l) => l.url === item.source)) {
          links.unshift({
            title: "Primary Reference Resource",
            url: String(item.source).trim(),
          });
        }

        // Guarantee minimum 5 suitable links
        if (links.length < 5) {
          const fallbackLinks = getFallbackLinksForSubject(cleanPrompt || projectName, idx);
          for (const fb of fallbackLinks) {
            if (links.length >= 5) break;
            if (!links.some((l) => l.url === fb.url)) {
              links.push(fb);
            }
          }
        }

        const primarySource = links[0]?.url || String(item.source || "").trim();

        // Guarantee description contains at least 2 large sentences
        let desc = String(item.description || "").trim();
        const sentences = desc.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
        if (sentences.length < 2 || desc.length < 90) {
          desc = ensureTwoLargeSentences(desc, item.text, cleanPrompt || projectName);
        }

        return {
          id: `gen_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          text: String(item.text || `Progress Step ${idx + 1}`).trim(),
          description: desc,
          links,
          source: primarySource,
          coverTheme: item.coverTheme || ["space", "sunset", "neon", "forest", "royal", "midnight"][idx % 6],
          estimatedMinutes: parseInt(item.estimatedMinutes, 10) || 45,
        };
      });

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
 * Ensures description text contains a minimum of 2 large, informative sentences.
 */
function ensureTwoLargeSentences(existingDesc = "", milestoneTitle = "", prompt = "") {
  const clean = String(existingDesc || "").trim();
  const subject = String(prompt || milestoneTitle || "this milestone").trim();

  let sentence1 = clean;
  if (sentence1.length < 40) {
    sentence1 = `This milestone establishes the comprehensive foundational architecture, technical requirements, and core deliverable standards necessary for successfully executing ${milestoneTitle || subject}.`;
  }
  if (!sentence1.endsWith(".") && !sentence1.endsWith("!") && !sentence1.endsWith("?")) {
    sentence1 += ".";
  }

  const sentence2 = `Carefully develop and configure each essential component according to industry best practices and clean code conventions, and systematically validate the pipeline through rigorous testing and milestone verification checkpoints before proceeding.`;

  return `${sentence1} ${sentence2}`;
}

/**
 * Provides a rich pool of minimum 5 authoritative, domain-appropriate links for any topic.
 */
function getFallbackLinksForSubject(rawText = "", phaseIdx = 0) {
  const lower = String(rawText || "").toLowerCase();

  if (/react|next\.?js|vue|angular|svelte|frontend|web\s*dev|html|css|tailwind|javascript|typescript/i.test(lower)) {
    return [
      { title: "MDN Web Docs - Modern Web Development Guide", url: "https://developer.mozilla.org/en-US/docs/Learn" },
      { title: "React Official Learn & Component Architecture", url: "https://react.dev/learn" },
      { title: "Vite Next-Generation Frontend Tooling Documentation", url: "https://vite.dev/guide/" },
      { title: "Tailwind CSS Modern Styling Documentation", url: "https://tailwindcss.com/docs" },
      { title: "TypeScript Handbook - Practical Guide", url: "https://www.typescriptlang.org/docs/handbook/intro.html" },
      { title: "Web.dev Core Web Vitals & Performance Guide", url: "https://web.dev/explore/fast" },
      { title: "Radix UI Accessible Primitive Components", url: "https://www.radix-ui.com/primitives" },
    ];
  }

  if (/python|ai|machine\s*learning|deep\s*learning|data\s*science|pandas|pytorch|tensorflow|nlp|llm/i.test(lower)) {
    return [
      { title: "Python 3 Official Tutorial & Language Reference", url: "https://docs.python.org/3/tutorial/" },
      { title: "PyTorch Official Deep Learning Tutorials", url: "https://pytorch.org/tutorials/" },
      { title: "Hugging Face Transformers & Model Hub", url: "https://huggingface.co/docs" },
      { title: "Pandas Data Analysis Getting Started Guide", url: "https://pandas.pydata.org/docs/getting_started/" },
      { title: "Scikit-Learn Machine Learning in Python", url: "https://scikit-learn.org/stable/tutorial/" },
      { title: "Kaggle Open Datasets & Machine Learning Hub", url: "https://www.kaggle.com/datasets" },
      { title: "FastAPI Modern Web APIs for ML Deployment", url: "https://fastapi.tiangolo.com/tutorial/" },
    ];
  }

  if (/fitness|workout|gym|health|diet|running|marathon|weight|exercise|nutrition|yoga/i.test(lower)) {
    return [
      { title: "WHO World Health Organization Physical Activity Guidelines", url: "https://www.who.int/health-topics/physical-activity" },
      { title: "ACE American Council on Exercise Library & Biomechanics", url: "https://www.acefitness.org/resources/everyone/exercise-library/" },
      { title: "USDA Nutrition.gov Dietary Planning & Macronutrients Guide", url: "https://nutrition.gov/topics/basic-nutrition" },
      { title: "Runner's World Training Plans & Pacing Guides", url: "https://www.runnersworld.com/training/" },
      { title: "Bodybuilding.com Resistance Training & Workout Database", url: "https://www.bodybuilding.com/content" },
    ];
  }

  if (/business|startup|saas|marketing|ecommerce|sales|product|launch|finance|stripe|shopify/i.test(lower)) {
    return [
      { title: "Stripe Documentation & Payment Integration Guide", url: "https://stripe.com/docs" },
      { title: "Y Combinator Startup Library & Playbook", url: "https://www.ycombinator.com/library" },
      { title: "Shopify Development Documentation & Store Setup", url: "https://shopify.dev/docs" },
      { title: "Moz Beginner's Guide to SEO & Inbound Marketing", url: "https://moz.com/beginners-guide-to-seo" },
      { title: "Harvard Business Review Management & Strategy Insights", url: "https://hbr.org/" },
    ];
  }

  if (/backend|cloud|api|node|express|database|mongodb|postgres|sql|docker|aws/i.test(lower)) {
    return [
      { title: "Node.js Official Documentation & API Reference", url: "https://nodejs.org/en/docs/" },
      { title: "Express.js RESTful Routing & Middleware Guide", url: "https://expressjs.com/en/starter/installing.html" },
      { title: "PostgreSQL Official Tutorial & SQL Fundamentals", url: "https://www.postgresql.org/docs/current/tutorial.html" },
      { title: "MongoDB Manual & Aggregation Pipeline Tutorial", url: "https://www.mongodb.com/docs/manual/tutorial/" },
      { title: "Docker Official Containerization Quickstart", url: "https://docs.docker.com/get-started/" },
    ];
  }

  if (/mobile|ios|android|react\s*native|flutter|swift|kotlin|expo/i.test(lower)) {
    return [
      { title: "React Native Official Getting Started & Core Components", url: "https://reactnative.dev/docs/getting-started" },
      { title: "Flutter Official Documentation & Widget Catalog", url: "https://docs.flutter.dev/" },
      { title: "Android Developers Official Training & Modern Architecture", url: "https://developer.android.com/develop" },
      { title: "Apple Developer Swift & SwiftUI Documentation", url: "https://developer.apple.com/documentation/swiftui/" },
      { title: "Expo Cross-Platform Framework Documentation", url: "https://docs.expo.dev/" },
    ];
  }

  if (/ui|ux|figma|design|wireframe|prototype/i.test(lower)) {
    return [
      { title: "Figma Learn & Best Practices Guide", url: "https://help.figma.com/hc/en-us/categories/360002051613-Get-started" },
      { title: "Nielsen Norman Group UX Principles & Heuristics", url: "https://www.nngroup.com/articles/ten-usability-heuristics/" },
      { title: "Google Material Design 3 Design System & Guidelines", url: "https://m3.material.io/" },
      { title: "Apple Human Interface Guidelines", url: "https://developer.apple.com/design/human-interface-guidelines" },
      { title: "Laws of UX Visual Design Psychology Principles", url: "https://lawsofux.com/" },
    ];
  }

  const enc = encodeURIComponent(String(rawText).split(" ")[0].toLowerCase());
  return [
    { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
    { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
    { title: "GitHub Open Source Ecosystem & Community Reference", url: "https://github.com/explore" },
    { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
    { title: "Coursera / edX Academic Learning & Certification Portal", url: "https://www.coursera.org" },
  ];
}

/**
 * Intelligent domain-aware milestone generator fallback.
 * Synthesizes suitable progress files with minimum 2 large sentences and minimum 5 suitable links each.
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
        description: `Initialize the modern project repository with strict TypeScript and Vite configurations, install foundational development dependencies, and establish clean folder structures for modular components, styles, and utilities. Configure ESLint and Prettier for automated code quality enforcement, set up path aliases, and verify fast-refresh compilation to ensure an optimal developer workflow before proceeding.`,
        links: [
          { title: "MDN Web Docs - Getting Started with the Web", url: "https://developer.mozilla.org/en-US/docs/Learn" },
          { title: "Vite Next-Gen Frontend Tooling Guide", url: "https://vite.dev/guide/" },
          { title: "TypeScript Handbook - The Basics", url: "https://www.typescriptlang.org/docs/handbook/intro.html" },
          { title: "ESLint Configuration & Rules Reference", url: "https://eslint.org/docs/latest/use/getting-started" },
          { title: "Tailwind CSS Modern Styling Documentation", url: "https://tailwindcss.com/docs/installation" },
        ],
        coverTheme: "neon",
      },
      {
        text: `Phase 2: Component Architecture & Responsive Layouts for ${subject}`,
        description: `Design and assemble reusable UI primitive components following accessibility principles, establish consistent typography and color tokens, and craft fluid responsive grid layouts for all screen viewports. Break down complex user interface sections into self-contained dumb and smart components, utilizing Radix primitives and modern CSS Flexbox and Grid to guarantee exceptional visual harmony.`,
        links: [
          { title: "React Official Learn & Component Architecture", url: "https://react.dev/learn" },
          { title: "Web.dev Responsive Web Design Fundamentals", url: "https://web.dev/explore/design" },
          { title: "Radix UI Accessible Primitives Documentation", url: "https://www.radix-ui.com/primitives" },
          { title: "Lucide Open Source Icon Library & Guide", url: "https://lucide.dev/icons/" },
          { title: "CSS-Tricks A Complete Guide to Flexbox & Grid", url: "https://css-tricks.com/snippets/css/a-guide-to-flexbox/" },
        ],
        coverTheme: "space",
      },
      {
        text: `Phase 3: Interactive Workflows & State Management for ${subject}`,
        description: `Implement robust global and local state management patterns to coordinate user interactions, handle multi-step form submissions, and maintain seamless client-side navigation. Connect asynchronous data fetching layers with TanStack Query or native Fetch, implement optimistic UI updates, and build clear skeleton loaders alongside defensive error boundaries to prevent runtime crashes.`,
        links: [
          { title: "React Hooks Reference & State Management", url: "https://react.dev/reference/react" },
          { title: "TanStack React Query Data Fetching Guide", url: "https://tanstack.com/query/latest/docs/framework/react/overview" },
          { title: "MDN Fetch API & Asynchronous Network Requests", url: "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch" },
          { title: "Zustand Barebones State Management Guide", url: "https://docs.pmnd.rs/zustand/getting-started/introduction" },
          { title: "Zod TypeScript-first Schema Validation", url: "https://zod.dev" },
        ],
        coverTheme: "midnight",
      },
      {
        text: `Phase 4: Optimization, Accessibility & Automated Testing for ${subject}`,
        description: `Conduct comprehensive performance profiling with Google Lighthouse to eliminate rendering bottlenecks, optimize bundle sizes via code-splitting, and ensure strict compliance with WCAG accessibility guidelines. Write comprehensive unit and integration test suites using Vitest and React Testing Library, verifying critical user journeys and edge cases to ensure long-term codebase stability.`,
        links: [
          { title: "Vitest Next-Generation Unit Testing Framework", url: "https://vitest.dev/guide/" },
          { title: "Testing Library - React Testing Utilities", url: "https://testing-library.com/docs/react-testing-library/intro/" },
          { title: "Web.dev Core Web Vitals & Performance Optimization", url: "https://web.dev/explore/fast" },
          { title: "Lighthouse Performance & Accessibility Audits", url: "https://developer.chrome.com/docs/lighthouse/overview/" },
          { title: "WCAG Web Content Accessibility Guidelines", url: "https://www.w3.org/WAI/standards-guidelines/wcag/" },
        ],
        coverTheme: "royal",
      },
      {
        text: `Phase 5: Production Deployment & Verification for ${subject}`,
        description: `Configure automated CI/CD deployment pipelines on modern cloud platforms such as Vercel or Cloudflare Pages, set up custom domains with SSL certificates, and tune production caching headers. Validate production asset delivery, verify responsive behavior across mobile, tablet, and desktop devices, and publish release documentation celebrating the milestone completion.`,
        links: [
          { title: "Vercel Production Deployment & Framework Guides", url: "https://vercel.com/docs" },
          { title: "Cloudflare Pages Jamstack Hosting & Edge Deployment", url: "https://developers.cloudflare.com/pages/" },
          { title: "Netlify Continuous Deployment Workflow Guide", url: "https://docs.netlify.com/" },
          { title: "GitHub Actions CI/CD Pipeline Automation", url: "https://docs.github.com/en/actions" },
          { title: "Google Search Central Technical SEO Quickstart", url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide" },
        ],
        coverTheme: "sunset",
      },
    ];
  } else if (/python|ai|machine\s*learning|deep\s*learning|data\s*science|pandas|pytorch|tensorflow|nlp|llm/i.test(lower)) {
    pool = [
      {
        text: `Phase 1: Environment Setup & Dataset Ingestion for ${subject}`,
        description: `Configure an isolated Python virtual environment, install state-of-the-art data science libraries, and establish reproducible Jupyter notebook workflows for exploratory research. Ingest raw structured or unstructured datasets from authoritative repositories, execute automated schema validation, and inspect missing value distributions to create clean foundational data partitions.`,
        links: [
          { title: "Python Official Tutorial & Virtual Environments", url: "https://docs.python.org/3/tutorial/venv.html" },
          { title: "Kaggle Open Datasets & Machine Learning Hub", url: "https://www.kaggle.com/datasets" },
          { title: "Pandas Getting Started & Data Ingestion Guide", url: "https://pandas.pydata.org/docs/getting_started/" },
          { title: "NumPy Fundamental Numerical Computing Guide", url: "https://numpy.org/doc/stable/user/absolute_beginners.html" },
          { title: "Anaconda / Conda Environment Management Docs", url: "https://docs.conda.io/projects/conda/en/latest/user-guide/getting-started.html" },
        ],
        coverTheme: "space",
      },
      {
        text: `Phase 2: Exploratory Analysis & Feature Engineering for ${subject}`,
        description: `Analyze data distributions, correlation heatmaps, and outlier behaviors using Seaborn and Matplotlib to extract meaningful underlying trends and patterns. Engineer discriminative input features, normalize numerical vectors, encode categorical attributes, and construct robust train-validation-test splits to prevent statistical data leakage during training.`,
        links: [
          { title: "Seaborn Statistical Data Visualization Tutorials", url: "https://seaborn.pydata.org/tutorial.html" },
          { title: "Scikit-Learn Preprocessing & Feature Engineering", url: "https://scikit-learn.org/stable/modules/preprocessing.html" },
          { title: "Matplotlib Comprehensive Plotting Library Guide", url: "https://matplotlib.org/stable/tutorials/index.html" },
          { title: "Towards Data Science Exploratory Data Analysis Best Practices", url: "https://towardsdatascience.com" },
          { title: "SciPy Statistical Functions and Distributions Reference", url: "https://docs.scipy.org/doc/scipy/reference/stats.html" },
        ],
        coverTheme: "midnight",
      },
      {
        text: `Phase 3: Model Architecture & Baseline Training for ${subject}`,
        description: `Formulate the mathematical architecture and choose appropriate baseline algorithms across linear models, ensemble trees, or neural network architectures in PyTorch or Scikit-Learn. Establish loss functions, configure gradient descent optimizers with learning rate schedulers, and log training loss trajectories across epochs using experiment tracking tools.`,
        links: [
          { title: "PyTorch Deep Learning Tutorials & Quickstart", url: "https://pytorch.org/tutorials/" },
          { title: "Hugging Face Transformers & Model Hub", url: "https://huggingface.co/docs" },
          { title: "Scikit-Learn Supervised & Unsupervised Learning", url: "https://scikit-learn.org/stable/user_guide.html" },
          { title: "TensorFlow Core Machine Learning Documentation", url: "https://www.tensorflow.org/tutorials" },
          { title: "Weights & Biases Experiment Tracking & Metrics", url: "https://docs.wandb.ai/" },
        ],
        coverTheme: "neon",
      },
      {
        text: `Phase 4: Hyperparameter Tuning & Model Validation for ${subject}`,
        description: `Execute systematic hyperparameter exploration via Bayesian optimization or grid sweeps to maximize target accuracy, precision, recall, and F1 metrics. Analyze confusion matrices, residual error distributions, and cross-validation variance across holdout splits to guarantee that the trained model generalizes exceptionally well without overfitting.`,
        links: [
          { title: "Scikit-Learn Model Evaluation & Scoring Metrics", url: "https://scikit-learn.org/stable/modules/model_evaluation.html" },
          { title: "Optuna Hyperparameter Optimization Framework", url: "https://optuna.readthedocs.io/en/stable/" },
          { title: "Hugging Face PEFT Parameter-Efficient Fine-Tuning", url: "https://huggingface.co/docs/peft/" },
          { title: "PyTorch Lightning Scalable Deep Learning", url: "https://lightning.ai/docs/pytorch/latest//" },
          { title: "Papers with Code State-of-the-Art Benchmarks", url: "https://paperswithcode.com" },
        ],
        coverTheme: "royal",
      },
      {
        text: `Phase 5: Inference Pipeline & Practical Deployment for ${subject}`,
        description: `Export optimized model artifacts, serialize weights using ONNX runtime, and construct high-performance asynchronous REST endpoints using FastAPI. Containerize the complete inference service using Docker, document API request/response schemas, and verify batch latency benchmarks under simulated load for production reliability.`,
        links: [
          { title: "FastAPI Modern Python Web APIs for ML Services", url: "https://fastapi.tiangolo.com/tutorial/" },
          { title: "ONNX Open Neural Network Exchange Runtime", url: "https://onnxruntime.ai/docs/" },
          { title: "Docker Containerization Guide for Machine Learning", url: "https://docs.docker.com/get-started/" },
          { title: "Ray Serve Scalable Model Serving Architecture", url: "https://docs.ray.io/en/latest/serve/index.html" },
          { title: "MLflow Open Source Lifecycle Management", url: "https://mlflow.org/docs/latest/index.html" },
        ],
        coverTheme: "forest",
      },
    ];
  } else if (/fitness|workout|gym|health|diet|running|marathon|weight|exercise|nutrition|yoga/i.test(lower)) {
    pool = [
      {
        text: `Phase 1: Baseline Assessment & Goal Calibration for ${subject}`,
        description: `Record comprehensive baseline physical metrics, screen joint mobility, and establish realistic quantitative milestones for strength, endurance, and body composition. Formulate an individualized weekly training schedule, outline movement safety guidelines, and log initial baseline measurements in a dedicated training journal to ensure accountability.`,
        links: [
          { title: "WHO World Health Organization Physical Activity Guidelines", url: "https://www.who.int/health-topics/physical-activity" },
          { title: "ACE American Council on Exercise Library & Biomechanics", url: "https://www.acefitness.org/resources/everyone/exercise-library/" },
          { title: "USDA Nutrition.gov Dietary Planning & Macronutrients Guide", url: "https://nutrition.gov/topics/basic-nutrition" },
          { title: "Runner's World Training Plans & Pacing Guides", url: "https://www.runnersworld.com/training/" },
          { title: "Bodybuilding.com Resistance Training & Workout Database", url: "https://www.bodybuilding.com/content" },
        ],
        coverTheme: "forest",
      },
      {
        text: `Phase 2: Nutritional Blueprint & Hydration Protocol for ${subject}`,
        description: `Calculate daily basal metabolic rate and target macronutrient splits aligned with energy expenditure, prioritizing lean protein intake and nutrient-dense whole foods. Establish disciplined pre- and post-workout hydration and fueling protocols, eliminate inflammatory processed ingredients, and prepare weekly meal prep routines to support consistent muscular recovery.`,
        links: [
          { title: "USDA Nutrition.gov Dietary Planning & Macronutrients Guide", url: "https://nutrition.gov/topics/basic-nutrition" },
          { title: "Harvard T.H. Chan School of Public Health Nutrition Source", url: "https://www.hsph.harvard.edu/nutritionsource/" },
          { title: "National Institutes of Health Dietary Supplements Factsheets", url: "https://ods.od.nih.gov/factsheets/list-all/" },
          { title: "EatRight Academy of Nutrition and Dietetics", url: "https://www.eatright.org/food" },
          { title: "MyFitnessPal Calorie & Macro Tracking Platform", url: "https://www.myfitnesspal.com" },
        ],
        coverTheme: "sunset",
      },
      {
        text: `Phase 3: Core Conditioning & Movement Mechanics for ${subject}`,
        description: `Master fundamental compound movement patterns with strict biomechanical form, emphasizing spinal alignment, core engagement, and controlled eccentric tempos. Implement dedicated dynamic warm-up drills and mobility sequences before sessions to safeguard connective tissue and maximize neuromuscular activation across all target muscle groups.`,
        links: [
          { title: "ACE Exercise Technique & Biomechanics Library", url: "https://www.acefitness.org/resources/everyone/exercise-library/" },
          { title: "ExRx.net Comprehensive Exercise & Muscle Directory", url: "https://exrx.net" },
          { title: "BarBend Strength Training & Lifting Mechanics", url: "https://barbend.com" },
          { title: "National Strength and Conditioning Association Guidelines", url: "https://www.nsca.com" },
          { title: "Yoga Journal Mobility & Flexibility Practices", url: "https://www.yogajournal.com" },
        ],
        coverTheme: "neon",
      },
      {
        text: `Phase 4: Progressive Overload & Endurance Scaling for ${subject}`,
        description: `Systematically increase weekly training stimulus by manipulating resistance loads, repetition volume, training density, and cardiovascular intervals according to proven periodization models. Monitor heart rate recovery, manage central nervous system fatigue through planned deload cycles, and ensure at least eight hours of quality sleep for peak physical adaptation.`,
        links: [
          { title: "Runner's World Training Plans & Pacing Guides", url: "https://www.runnersworld.com/training/" },
          { title: "Stronger By Science Evidence-Based Training Science", url: "https://www.strongerbyscience.com" },
          { title: "Strava Global Athlete Tracking & Community", url: "https://www.strava.com" },
          { title: "Mayo Clinic Fitness & Exercise Programs", url: "https://www.mayoclinic.org/healthy-lifestyle/fitness/basics/fitness-basics/hlv-20049447" },
          { title: "American Heart Association Physical Activity Guidelines", url: "https://www.heart.org/en/healthy-living/fitness" },
        ],
        coverTheme: "space",
      },
      {
        text: `Phase 5: Performance Benchmark & Long-Term Roadmap for ${subject}`,
        description: `Re-evaluate physical performance benchmarks against initial baseline metrics, assessing strength improvements, body composition shifts, and cardiovascular stamina gains. Formulate a sustainable long-term periodization roadmap with new quarterly targets, celebratory reward milestones, and habit maintenance strategies to keep progressing year-round.`,
        links: [
          { title: "Bodybuilding.com Resistance Training & Workout Database", url: "https://www.bodybuilding.com/content" },
          { title: "WHO Physical Activity Guidelines & Lifelong Health", url: "https://www.who.int/health-topics/physical-activity" },
          { title: "ACE Health & Fitness Continuing Education", url: "https://www.acefitness.org" },
          { title: "Precision Nutrition Habit-Based Coaching Articles", url: "https://www.precisionnutrition.com/blog" },
          { title: "CrossFit Official Workout & Fitness Standards", url: "https://www.crossfit.com" },
        ],
        coverTheme: "royal",
      },
    ];
  } else if (/business|startup|saas|marketing|ecommerce|sales|product|launch|finance|stripe|shopify/i.test(lower)) {
    pool = [
      {
        text: `Phase 1: Market Research & Audience Discovery for ${subject}`,
        description: `Conduct comprehensive customer discovery interviews to isolate high-urgency pain points, analyze competitor value propositions, and quantify addressable market demand. Synthesize customer persona profiles with specific willingness-to-pay criteria, validate regulatory and financial requirements, and define crystal-clear differentiation angles before investing resources.`,
        links: [
          { title: "Harvard Business Review Strategy & Innovation", url: "https://hbr.org/" },
          { title: "Y Combinator Startup Library & Playbook", url: "https://www.ycombinator.com/library" },
          { title: "Statista Global Market Data & Consumer Insights", url: "https://www.statista.com" },
          { title: "CB Insights Venture Capital & Market Intelligence", url: "https://www.cbinsights.com/research/" },
          { title: "Strategyzer Business Model Canvas Framework", url: "https://www.strategyzer.com/library" },
        ],
        coverTheme: "midnight",
      },
      {
        text: `Phase 2: Value Proposition & Offer Packaging for ${subject}`,
        description: `Draft compelling offer positioning that clearly addresses customer objections, establish tiered pricing structures backed by unit economics, and formulate strong risk-reversal guarantees. Create conversion-focused messaging frameworks, define core deliverables and bonus assets, and validate messaging resonance through peer and early-adopter feedback loops.`,
        links: [
          { title: "Y Combinator Essential Startup Advice", url: "https://www.ycombinator.com/library" },
          { title: "Copyblogger Content Marketing & Sales Copywriting", url: "https://copyblogger.com" },
          { title: "Stripe Atlas Business Formation & Pricing Guides", url: "https://stripe.com/atlas/guides" },
          { title: "Reforge Product Strategy & Growth Frameworks", url: "https://www.reforge.com/blog" },
          { title: "First Round Review Tactical Management Insights", url: "https://review.firstround.com" },
        ],
        coverTheme: "sunset",
      },
      {
        text: `Phase 3: High-Converting Landing Experience for ${subject}`,
        description: `Build a blazing-fast responsive landing page featuring persuasive hero headlines, social proof testimonials, clear feature breakdowns, and frictionless checkout integrations. Instrument privacy-compliant analytics funnels, set up automated email confirmation sequences, and conduct end-to-end sandbox payment simulations to guarantee zero checkout drop-off.`,
        links: [
          { title: "Stripe Documentation & Payment Integration Guide", url: "https://stripe.com/docs" },
          { title: "Shopify Developer Documentation & APIs", url: "https://shopify.dev/docs" },
          { title: "Web.dev Landing Page Speed & Conversion Optimization", url: "https://web.dev/explore/fast" },
          { title: "Unbounce High-Converting Landing Page Guide", url: "https://unbounce.com/landing-page-articles/" },
          { title: "Google Analytics 4 Measurement & Funnel Setup", url: "https://support.google.com/analytics/answer/9304153" },
        ],
        coverTheme: "space",
      },
      {
        text: `Phase 4: Multi-Channel Outreach & Traffic Acquisition for ${subject}`,
        description: `Execute a multi-channel go-to-market distribution strategy across organic search engine optimization, targeted community discussions, and curated strategic partnerships. Launch high-value educational content assets, track customer acquisition costs across channels, and continuously A/B test ad copy and email subject lines to compound traffic momentum.`,
        links: [
          { title: "Moz Beginner's Guide to SEO & Inbound Marketing", url: "https://moz.com/beginners-guide-to-seo" },
          { title: "HubSpot Inbound Marketing Methodology & Tools", url: "https://www.hubspot.com/inbound-marketing" },
          { title: "Ahrefs SEO & Content Marketing Learning Hub", url: "https://ahrefs.com/blog/" },
          { title: "Product Hunt Launch Playbook & Community Guidelines", url: "https://www.producthunt.com" },
          { title: "Buffer Social Media Marketing Strategies", url: "https://buffer.com/resources" },
        ],
        coverTheme: "neon",
      },
      {
        text: `Phase 5: KPI Review, Conversion Optimization & Scaling for ${subject}`,
        description: `Deeply analyze customer acquisition cost against customer lifetime value, inspect checkout drop-off funnels, and systematically resolve customer onboarding friction points. Implement customer referral mechanisms, optimize recurring retention loops, and compile a quarterly scaling forecast to sustainably accelerate long-term revenue growth.`,
        links: [
          { title: "Harvard Business Review Scaling & Leadership", url: "https://hbr.org/" },
          { title: "Stripe Resources on SaaS Metrics & Billing", url: "https://stripe.com/resources/more/saas-metrics-101" },
          { title: "Baremetrics SaaS Financial Metrics & Benchmarks", url: "https://baremetrics.com/academy" },
          { title: "ProfitWell Subscription Pricing & Churn Analysis", url: "https://www.profitwell.com/recur" },
          { title: "Mixpanel Product Analytics & Retention Guides", url: "https://mixpanel.com/blog/" },
        ],
        coverTheme: "royal",
      },
    ];
  } else {
    // Dynamic universal prompt-driven synthesis
    const enc = encodeURIComponent(subject.split(" ")[0].toLowerCase());
    pool = [
      {
        text: `Phase 1: Foundations, Scope & Setup for ${subject}`,
        description: `Thoroughly investigate foundational theories, assemble all necessary documentation and development tools, and define explicit success criteria for executing ${subject}. Establish organized directory structures, configure essential environment variables, and document initial milestone assumptions to maintain clear project trajectory from day one.`,
        links: [
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
          { title: "GitHub Open Source Ecosystem & Community Reference", url: "https://github.com/explore" },
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Coursera / edX Academic Learning & Certification Portal", url: "https://www.coursera.org" },
        ],
        coverTheme: "space",
      },
      {
        text: `Phase 2: Core Methodology & First Prototype for ${subject}`,
        description: `Synthesize the primary methodology into a tangible working prototype, validating assumptions through hands-on experimentation and incremental builds for ${subject}. Document initial functional benchmarks, collect immediate feedback on operational friction, and iteratively refine component architecture to ensure a solid foundation.`,
        links: [
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
          { title: "MIT OpenCourseWare Learning Materials & Syllabi", url: "https://ocw.mit.edu" },
          { title: "MDN Web Docs - Technical References & Guides", url: "https://developer.mozilla.org" },
          { title: "Stack Overflow Developer Community & Discussions", url: "https://stackoverflow.com" },
          { title: "Dev.to Community Tutorials & Development Stories", url: "https://dev.to" },
        ],
        coverTheme: "neon",
      },
      {
        text: `Phase 3: Deep Execution & Key Deliverables for ${subject}`,
        description: `Execute the full scope of milestone deliverables with focused concentration, producing polished assets and integrating all required functional modules for ${subject}. Eliminate edge-case bugs, streamline inter-module communication, and document architectural decisions to establish reliable, maintainable standards.`,
        links: [
          { title: "GitHub Open Source Ecosystem & Community Reference", url: "https://github.com/explore" },
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Medium In-Depth Engineering & Design Case Studies", url: "https://medium.com" },
          { title: "Hacker News Tech & Entrepreneurship Discussions", url: "https://news.ycombinator.com" },
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
        ],
        coverTheme: "sunset",
      },
      {
        text: `Phase 4: Quality Review, Polish & Refinement for ${subject}`,
        description: `Perform rigorous end-to-end quality assurance audits, resolving visual and technical discrepancies while optimizing execution efficiency and accessibility for ${subject}. Solicit peer critiques, benchmark performance against industry standards, and polish interactive details to deliver a premium user experience.`,
        links: [
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Medium In-Depth Engineering & Design Case Studies", url: "https://medium.com" },
          { title: "Coursera / edX Academic Learning & Certification Portal", url: "https://www.coursera.org" },
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
        ],
        coverTheme: "midnight",
      },
      {
        text: `Phase 5: Capstone Completion, Validation & Launch for ${subject}`,
        description: `Consolidate all finalized milestone components, verify end-to-end completion against original acceptance criteria, and publish clean documentation for ${subject}. Archive project deliverables, distribute release announcements, and celebrate milestone completion with stakeholders and community members.`,
        links: [
          { title: "GitHub Open Source Ecosystem & Community Reference", url: "https://github.com/explore" },
          { title: "Coursera / edX Academic Learning & Certification Portal", url: "https://www.coursera.org" },
          { title: "Notion Guide & Project Execution Template", url: "https://www.notion.so/help/guides" },
          { title: "Wikipedia Knowledge Base & Core Concepts", url: `https://en.wikipedia.org/wiki/${enc || "Productivity"}` },
          { title: "Khan Academy Comprehensive Learning Roadmap", url: "https://www.khanacademy.org" },
        ],
        coverTheme: "royal",
      },
    ];
  }

  const themes = ["space", "sunset", "neon", "forest", "royal", "midnight"];
  return pool.slice(0, num).map((item, idx) => {
    const links = Array.isArray(item.links) && item.links.length >= 5
      ? item.links
      : getFallbackLinksForSubject(raw, idx);
    const primarySource = links[0]?.url || item.source || "";
    return {
      ...item,
      links,
      source: primarySource,
      coverTheme: item.coverTheme || themes[idx % themes.length],
      estimatedMinutes: 30 + idx * 15,
    };
  });
}
