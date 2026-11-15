import { readCatalog } from "./liveWorks.js";
import { POPULAR_FOLDERS } from "../components/PopularFoldersBox.jsx";

/**
 * Curated list of top educational and learning channels on YouTube,
 * categorized for automatic path recommendation.
 */

export const CURATED_CHANNELS = [
  // --- Web Development & JavaScript / Frontend ---
  {
    id: "freecodecamp",
    name: "freeCodeCamp.org",
    handle: "@freecodecamp",
    subscribers: "9.8M",
    tags: ["Web Development", "Python", "Fullstack", "CS Fundamentals"],
    category: "coding",
    keywords: ["web", "javascript", "js", "html", "css", "react", "node", "frontend", "fullstack", "programming", "code", "dev"],
    description: "In-depth, full-length crash courses on web development, modern frameworks, Python, and computer science basics.",
    url: "https://www.youtube.com/@freecodecamp",
    avatarBg: "#0a0a23",
    avatarText: "fCC",
  },
  {
    id: "fireship",
    name: "Fireship",
    handle: "@Fireship",
    subscribers: "3.4M",
    tags: ["Modern Tech", "100 Seconds", "Fullstack"],
    category: "coding",
    keywords: ["web", "javascript", "react", "next", "vue", "supabase", "firebase", "tech", "modern", "frontend"],
    description: "High-intensity code tutorials, 100 seconds of code, and rapid breakdowns of modern tech stacks.",
    url: "https://www.youtube.com/@Fireship",
    avatarBg: "#ff3e00",
    avatarText: "🔥",
  },
  {
    id: "the-net-ninja",
    name: "The Net Ninja",
    handle: "@NetNinja",
    subscribers: "1.3M",
    tags: ["React", "TypeScript", "Node.js", "Step-by-Step"],
    category: "coding",
    keywords: ["react", "typescript", "ts", "next", "vue", "node", "javascript", "frontend", "backend"],
    description: "Bite-sized, practical project playlists covering React, Next.js, TypeScript, and modern JavaScript.",
    url: "https://www.youtube.com/@NetNinja",
    avatarBg: "#1f1f1f",
    avatarText: "🥷",
  },
  {
    id: "traversy-media",
    name: "Traversy Media",
    handle: "@TraversyMedia",
    subscribers: "2.2M",
    tags: ["Crash Courses", "Fullstack Projects"],
    category: "coding",
    keywords: ["web", "html", "css", "javascript", "fullstack", "react", "php", "django", "express"],
    description: "Real-world crash courses and practical project builds from Brad Traversy for all web developers.",
    url: "https://www.youtube.com/@TraversyMedia",
    avatarBg: "#333333",
    avatarText: "TM",
  },
  {
    id: "kevin-powell",
    name: "Kevin Powell",
    handle: "@KevinPowell",
    subscribers: "1.1M",
    tags: ["CSS", "Responsive Layouts", "Animations"],
    category: "coding",
    keywords: ["css", "html", "responsive", "grid", "flexbox", "styling", "layout", "frontend"],
    description: "The leading authority on modern CSS, deep layout mechanics, Flexbox, Grid, and responsive UX.",
    url: "https://www.youtube.com/@KevinPowell",
    avatarBg: "#22252a",
    avatarText: "KP",
  },
  {
    id: "web-dev-simplified",
    name: "Web Dev Simplified",
    handle: "@WebDevSimplified",
    subscribers: "1.6M",
    tags: ["React", "JavaScript", "Clean Code"],
    category: "coding",
    keywords: ["web", "javascript", "react", "css", "clean code", "frontend"],
    description: "Simplifies complex web development concepts into concise, practical examples with clean code.",
    url: "https://www.youtube.com/@WebDevSimplified",
    avatarBg: "#007acc",
    avatarText: "WDS",
  },

  // --- Python, AI, Data Science & Machine Learning ---
  {
    id: "corey-schafer",
    name: "Corey Schafer",
    handle: "@coreyms",
    subscribers: "1.3M",
    tags: ["Python", "Django", "Flask", "OOP"],
    category: "python",
    keywords: ["python", "django", "flask", "backend", "oop", "sql", "git"],
    description: "Meticulous, industry-standard tutorials on Python fundamentals, OOP, Django, and clean backend development.",
    url: "https://www.youtube.com/@coreyms",
    avatarBg: "#306998",
    avatarText: "CS",
  },
  {
    id: "programming-with-mosh",
    name: "Programming with Mosh",
    handle: "@programmingwithmosh",
    subscribers: "3.9M",
    tags: ["Python", "C#", "SQL", "Fundamentals"],
    category: "coding",
    keywords: ["python", "sql", "c#", "java", "coding", "beginner", "backend"],
    description: "Clear, beginner-friendly crash courses on Python, algorithms, databases, and core software engineering.",
    url: "https://www.youtube.com/@programmingwithmosh",
    avatarBg: "#2196f3",
    avatarText: "Mosh",
  },
  {
    id: "statquest",
    name: "StatQuest with Josh Starmer",
    handle: "@statquest",
    subscribers: "1.2M",
    tags: ["Machine Learning", "AI", "Statistics"],
    category: "ai",
    keywords: ["machine learning", "ml", "ai", "data science", "statistics", "neural", "deep learning"],
    description: "Visual, step-by-step breakdowns of machine learning algorithms, statistical methods, and neural networks.",
    url: "https://www.youtube.com/@statquest",
    avatarBg: "#e91e63",
    avatarText: "SQ",
  },
  {
    id: "3blue1brown",
    name: "3Blue1Brown",
    handle: "@3blue1brown",
    subscribers: "6.4M",
    tags: ["Math & AI", "Neural Networks", "Visual Proofs"],
    category: "math",
    keywords: ["math", "linear algebra", "calculus", "neural networks", "ai", "deep learning", "algorithms"],
    description: "Breathtaking visual explanations of higher mathematics, linear algebra, and deep learning architectures.",
    url: "https://www.youtube.com/@3blue1brown",
    avatarBg: "#7c5295",
    avatarText: "3B1B",
  },

  // --- DSA & Computer Science & System Design ---
  {
    id: "neetcode",
    name: "NeetCode",
    handle: "@NeetCode",
    subscribers: "860K",
    tags: ["LeetCode", "DSA", "Interview Prep"],
    category: "dsa",
    keywords: ["dsa", "leetcode", "algorithms", "data structures", "interview", "coding interview"],
    description: "Intuitive visual problem-solving for the LeetCode 75/150 and algorithmic patterns for tech interviews.",
    url: "https://www.youtube.com/@NeetCode",
    avatarBg: "#2c3e50",
    avatarText: "NC",
  },
  {
    id: "abdul-bari",
    name: "Abdul Bari",
    handle: "@abdul_bari",
    subscribers: "1.1M",
    tags: ["Algorithms", "Dynamic Programming", "CS Theory"],
    category: "dsa",
    keywords: ["algorithms", "dsa", "dynamic programming", "graphs", "sorting", "complexity"],
    description: "Renowned blackboard algorithm lectures on dynamic programming, greedy algorithms, and data structures.",
    url: "https://www.youtube.com/@abdul_bari",
    avatarBg: "#d35400",
    avatarText: "AB",
  },
  {
    id: "bytebytego",
    name: "ByteByteGo",
    handle: "@ByteByteGo",
    subscribers: "920K",
    tags: ["System Design", "Distributed Architecture"],
    category: "system_design",
    keywords: ["system design", "architecture", "distributed", "scalability", "cloud", "backend"],
    description: "Clear animated architectural diagrams explaining large-scale distributed systems and high-load backend design.",
    url: "https://www.youtube.com/@ByteByteGo",
    avatarBg: "#0f4c81",
    avatarText: "BBG",
  },
  {
    id: "techworld-with-nana",
    name: "TechWorld with Nana",
    handle: "@TechWorldwithNana",
    subscribers: "1.2M",
    tags: ["DevOps", "Docker", "Kubernetes"],
    category: "devops",
    keywords: ["docker", "kubernetes", "devops", "cloud", "ci/cd", "linux", "aws"],
    description: "Visual, friendly DevOps and cloud engineering masterclasses for Docker, Kubernetes, and automated pipelines.",
    url: "https://www.youtube.com/@TechWorldwithNana",
    avatarBg: "#8e44ad",
    avatarText: "Nana",
  },

  // --- UI/UX & Design ---
  {
    id: "figma",
    name: "Figma",
    handle: "@FigmaDesign",
    subscribers: "540K",
    tags: ["Official Figma", "Design Systems", "Prototyping"],
    category: "design",
    keywords: ["figma", "design", "ui", "ux", "ui/ux", "prototyping", "wireframe"],
    description: "Official tutorials from Figma covering design systems, auto-layout, interactive prototypes, and Code Connect.",
    url: "https://www.youtube.com/@FigmaDesign",
    avatarBg: "#0acf83",
    avatarText: "Figma",
  },
  {
    id: "designcourse",
    name: "DesignCourse",
    handle: "@DesignCourse",
    subscribers: "1.1M",
    tags: ["UI/UX", "Visual Design", "Frontend Styling"],
    category: "design",
    keywords: ["ui", "ux", "ui/ux", "design", "figma", "typography", "colors", "styling"],
    description: "Practical UI/UX design fundamentals, typography, spacing, contrast, and frontend implementation.",
    url: "https://www.youtube.com/@DesignCourse",
    avatarBg: "#673ab7",
    avatarText: "DC",
  },
  {
    id: "mizko",
    name: "Mizko",
    handle: "@mizko",
    subscribers: "360K",
    tags: ["Figma Workflows", "Product Design", "Client Systems"],
    category: "design",
    keywords: ["figma", "ui/ux", "product design", "design system", "freelance"],
    description: "Industry-proven Figma workflows, scalable design systems, and client-ready digital product design.",
    url: "https://www.youtube.com/@mizko",
    avatarBg: "#2c3e50",
    avatarText: "Mizko",
  },

  // --- Fitness, Calisthenics & Health ---
  {
    id: "jeff-nippard",
    name: "Jeff Nippard",
    handle: "@JeffNippard",
    subscribers: "5.4M",
    tags: ["Science-Based", "Strength & Technique"],
    category: "fitness",
    keywords: ["fitness", "workout", "gym", "muscle", "hypertrophy", "training", "exercise", "strength", "health"],
    description: "Evidence-based training mechanics, hypertrophy science, and pristine exercise execution breakdowns.",
    url: "https://www.youtube.com/@JeffNippard",
    avatarBg: "#111111",
    avatarText: "JN",
  },
  {
    id: "hybrid-calisthenics",
    name: "Hybrid Calisthenics",
    handle: "@HybridCalisthenics",
    subscribers: "4.9M",
    tags: ["Bodyweight", "Mobility", "Accessible Progressions"],
    category: "fitness",
    keywords: ["calisthenics", "bodyweight", "fitness", "pushups", "pullups", "mobility", "beginner", "workout"],
    description: "Kind, approachable bodyweight fitness progressions and joint mobility for anyone at any fitness level.",
    url: "https://www.youtube.com/@HybridCalisthenics",
    avatarBg: "#2e7d32",
    avatarText: "HC",
  },
  {
    id: "huberman-lab",
    name: "Andrew Huberman",
    handle: "@hubermanlab",
    subscribers: "6.1M",
    tags: ["Neuroscience", "Focus", "Physical Optimization"],
    category: "health",
    keywords: ["health", "focus", "sleep", "habits", "brain", "neuroscience", "performance", "wellness"],
    description: "Neuroscience protocols for optimizing focus, neuroplasticity, physical stamina, and restorative sleep.",
    url: "https://www.youtube.com/@hubermanlab",
    avatarBg: "#1a1a1a",
    avatarText: "HL",
  },

  // --- Productivity & Study ---
  {
    id: "ali-abdaal",
    name: "Ali Abdaal",
    handle: "@aliabdaal",
    subscribers: "5.6M",
    tags: ["Evidence-Based Productivity", "Study Strategies"],
    category: "productivity",
    keywords: ["productivity", "study", "learning", "habits", "focus", "time management", "goals"],
    description: "Actionable productivity strategies, active recall study frameworks, and lifestyle architecture.",
    url: "https://www.youtube.com/@aliabdaal",
    avatarBg: "#3f51b5",
    avatarText: "AA",
  },
  {
    id: "thomas-frank",
    name: "Thomas Frank",
    handle: "@Thomasfrank",
    subscribers: "2.9M",
    tags: ["Habits", "Study Skills", "Organization"],
    category: "productivity",
    keywords: ["study", "habits", "productivity", "notion", "college", "focus"],
    description: "High-performance study routines, habit loops, and organizational systems for students and creators.",
    url: "https://www.youtube.com/@Thomasfrank",
    avatarBg: "#d32f2f",
    avatarText: "TF",
  },
];

/**
 * Returns a list of recommended channels matching a shared path's name,
 * tasks, and description.
 */
export function getRecommendedChannelsForPath(pathName = "", works = [], description = "") {
  const query = [
    pathName,
    description,
    ...(Array.isArray(works) ? works.map((w) => w?.text || "") : []),
  ]
    .join(" ")
    .toLowerCase();

  // Score each curated channel based on keyword matches
  const scored = CURATED_CHANNELS.map((ch) => {
    let score = 0;
    for (const kw of ch.keywords) {
      if (query.includes(kw)) {
        score += kw.length > 4 ? 3 : 2;
      }
    }
    for (const tag of ch.tags) {
      if (query.includes(tag.toLowerCase())) {
        score += 4;
      }
    }
    return { channel: ch, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // If we have positive matches, return top matches
  const positive = scored.filter((s) => s.score > 0).map((s) => s.channel);

  if (positive.length >= 4) {
    return positive.slice(0, 6);
  }

  // Fallback to mix of top-rated learning channels
  const fallbacks = [
    "freecodecamp",
    "fireship",
    "bytebytego",
    "kevin-powell",
    "neetcode",
    "ali-abdaal",
  ];
  const picked = [...positive];
  for (const id of fallbacks) {
    if (picked.length >= 6) break;
    const found = CURATED_CHANNELS.find((c) => c.id === id);
    if (found && !picked.some((p) => p.id === id)) {
      picked.push(found);
    }
  }
  return picked;
}

/**
 * Generates an external YouTube search URL for channels on a specific topic.
 */
export function getYouTubeChannelSearchUrl(pathName) {
  const q = encodeURIComponent(`${pathName || "tutorials"} channel`);
  // sp=EgIQAg%253D%253D specifies Type: Channel in YouTube search filters
  return `https://www.youtube.com/results?search_query=${q}&sp=EgIQAg%253D%253D`;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "with", "from", "into", "over", "some",
  "only", "then", "them", "they", "just", "also", "here", "this", "that", "your",
  "what", "have", "more", "done", "will", "been", "week", "today", "yesterday",
  "poured", "hours", "hour", "mins", "minute", "time", "path", "folder", "task",
  "tasks", "progress", "work", "works", "about", "list", "prep", "project"
]);

function tokenize(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#_ -]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

const CATEGORY_KEYWORDS = {
  coding: [
    "code", "tech", "placement", "interview", "algo", "algorithm", "dsa", "leetcode",
    "react", "frontend", "fullstack", "backend", "web", "javascript", "js", "python",
    "api", "database", "node", "css", "html", "bugfix", "system", "sql", "git", "dev",
    "engineering", "component", "server", "deploy", "orm", "test", "app"
  ],
  design: [
    "design", "ui", "ux", "figma", "prototype", "tokens", "palette", "typography",
    "wireframe", "styling", "layout", "hero", "navbar", "graphic", "visual", "color"
  ],
  writing: [
    "write", "writing", "read", "reading", "book", "blog", "draft", "content",
    "newsletter", "article", "publish", "notes", "copy", "author", "post"
  ],
  habits: [
    "daily", "habit", "study", "exam", "focus", "streak", "morning", "routine",
    "productivity", "learn", "learning", "goals"
  ],
};

function getCategoryTags(tokens) {
  const matched = new Set();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (tokens.some((t) => words.includes(t))) {
      matched.add(cat);
    }
  }
  return matched;
}

/**
 * Returns publicly available progress folders inside our platform related to the given post.
 * Sources:
 * 1. Community feed/group posts sharing progress folders
 * 2. Platform live works (from readCatalog)
 * 3. Platform curated popular progress folders (from POPULAR_FOLDERS)
 */
export function getRecommendedPlatformFolders(currentPost, allPosts = []) {
  if (!currentPost) return [];

  const shared = currentPost?.sharedProject;
  const targetTemplateId = String(
    shared?.templateId || currentPost?.sharedTemplateId || currentPost?.id || ""
  );
  const targetOriginId = shared?.originId || currentPost?.originId || null;
  const targetName = (
    shared?.name ||
    currentPost?.projectName ||
    (currentPost?.meta?.includes("·") ? currentPost.meta.split("·")[1]?.trim() : "") ||
    ""
  ).trim();

  const rawTargetWorks = Array.isArray(shared?.works)
    ? shared.works
    : Array.isArray(currentPost?.works)
      ? currentPost.works
      : [];
  const targetAbout = (
    shared?.about ||
    currentPost?.body ||
    currentPost?.blurb ||
    ""
  ).trim();
  const targetAuthor = (
    currentPost?.name ||
    currentPost?.author?.name ||
    ""
  ).trim().toLowerCase();

  const targetNameTokens = tokenize(targetName);
  const targetWorksTokens = tokenize(
    rawTargetWorks.map((w) => (typeof w === "string" ? w : w?.text || "")).join(" ")
  );
  const targetAboutTokens = tokenize(targetAbout);
  const allTargetTokens = [
    ...new Set([...targetNameTokens, ...targetWorksTokens, ...targetAboutTokens]),
  ];
  const targetCats = getCategoryTags(allTargetTokens);

  const candidates = [];
  const seenTemplateIds = new Set();
  if (targetTemplateId) seenTemplateIds.add(targetTemplateId);
  if (targetOriginId) seenTemplateIds.add(String(targetOriginId));

  // --- Source 1: Posts from community feed / groups ---
  if (Array.isArray(allPosts)) {
    for (const item of allPosts) {
      if (!item || String(item.id) === String(currentPost?.id)) continue;
      const itemShared = item.sharedProject;
      const itemName = (
        itemShared?.name ||
        item.projectName ||
        (item.meta?.includes("·") ? item.meta.split("·")[1]?.trim() : "") ||
        ""
      ).trim();
      const itemWorks = Array.isArray(itemShared?.works)
        ? itemShared.works
        : Array.isArray(item.works)
          ? item.works
          : [];

      // Only consider posts that actually share a progress folder/works
      if (!itemName || itemWorks.length === 0) continue;

      const itemTemplateId = String(
        itemShared?.templateId || item.sharedTemplateId || item.id || ""
      );
      const itemOriginId = itemShared?.originId || item.originId || null;

      if (seenTemplateIds.has(itemTemplateId)) continue;
      if (itemOriginId && seenTemplateIds.has(String(itemOriginId))) continue;

      const itemAuthor = (item.name || item.author?.name || "").trim();
      if (
        itemAuthor.toLowerCase() === targetAuthor &&
        itemName.toLowerCase() === targetName.toLowerCase()
      ) {
        continue;
      }

      seenTemplateIds.add(itemTemplateId);
      if (itemOriginId) seenTemplateIds.add(String(itemOriginId));

      candidates.push({
        id: `post-${item.id}`,
        templateId: itemTemplateId,
        originId: itemOriginId,
        shareMode: itemShared?.shareMode || item.shareMode || "follow",
        name: itemName,
        about: itemShared?.about || item.body || "",
        works: itemWorks.map((w, idx) => ({
          id: w.id || `w-${idx}`,
          text: typeof w === "string" ? w : w?.text || "",
          done: Boolean(w?.done),
          hasCheckbox: w?.hasCheckbox !== false,
          source: w?.source || "",
          sourceProof: w?.sourceProof || null,
          sources: Array.isArray(w?.sources) ? w.sources : [],
        })),
        durationMs: itemShared?.durationMs || item.durationMs || 30000,
        author: {
          name: itemAuthor || "Community Creator",
          handle: item.handle || item.author?.handle || "",
          initial: item.initial || itemAuthor?.[0] || "C",
          avatar: item.avatar || null,
        },
        sourceType: "community",
        badge: "Community Path",
      });
    }
  }

  // --- Source 2: Platform Live Works (readCatalog) ---
  try {
    const catalog = readCatalog();
    if (catalog && typeof catalog === "object") {
      const seenCatalogKeys = new Set();
      for (const [key, entry] of Object.entries(catalog)) {
        if (!entry || entry.deleted) continue;
        const originId = entry.originId || key;
        if (seenCatalogKeys.has(originId)) continue;
        seenCatalogKeys.add(originId);

        const entryTemplateId = String(entry.sharedTemplateId || `live-${originId}`);
        if (seenTemplateIds.has(entryTemplateId) || seenTemplateIds.has(String(originId))) {
          continue;
        }

        const entryName = (entry.name || "").trim();
        if (!entryName) continue;

        const entryWorks = Array.isArray(entry.works) ? entry.works : [];
        if (entryWorks.length === 0) continue;

        const entryAuthor = (entry.author?.name || "Live Creator").trim();
        if (
          entryAuthor.toLowerCase() === targetAuthor &&
          entryName.toLowerCase() === targetName.toLowerCase()
        ) {
          continue;
        }

        seenTemplateIds.add(entryTemplateId);
        seenTemplateIds.add(String(originId));

        candidates.push({
          id: `live-${originId}`,
          templateId: entryTemplateId,
          originId: originId,
          shareMode: entry.mode || "follow",
          name: entryName,
          about: entry.about || "",
          works: entryWorks.map((w, idx) => ({
            id: w.id || `lw-${idx}`,
            text: typeof w === "string" ? w : w?.text || "",
            done: Boolean(w?.done),
            hasCheckbox: w?.hasCheckbox !== false,
            source: w?.source || "",
            sourceProof: w?.sourceProof || null,
            sources: Array.isArray(w?.sources) ? w.sources : [],
          })),
          durationMs: entry.durationMs || 30000,
          author: {
            name: entryAuthor,
            handle: entry.author?.handle || "",
            initial: entryAuthor[0] || "L",
            avatar: entry.author?.avatar || null,
          },
          sourceType: "live",
          badge: entry.mode === "assign" ? "Assigned Folder" : "Live Creator",
        });
      }
    }
  } catch {
    // ignore
  }

  // --- Source 3: Platform Popular & Starter Folders ---
  if (Array.isArray(POPULAR_FOLDERS)) {
    for (const folder of POPULAR_FOLDERS) {
      if (!folder?.name) continue;
      const popTemplateId = folder.id || `pop-${folder.name.toLowerCase().replace(/\s+/g, "-")}`;
      if (seenTemplateIds.has(popTemplateId)) continue;

      candidates.push({
        id: folder.id,
        templateId: popTemplateId,
        originId: null,
        shareMode: null,
        name: folder.name,
        about: `${folder.category} · Platform Curated Progress Folder`,
        category: folder.category,
        icon: folder.icon,
        works: (folder.tasks || []).map((t, idx) => ({
          id: `${folder.id}-t-${idx}`,
          text: t.text,
          done: false,
          hasCheckbox: t.hasCheckbox !== false,
          source: "",
        })),
        durationMs: 30000,
        author: {
          name: "Platform Curated",
          handle: "sandadd",
          initial: folder.icon || "★",
          avatar: null,
          isPlatform: true,
        },
        sourceType: "popular",
        badge: folder.category || "Curated",
      });
    }
  }

  // Score each candidate against target
  const scored = candidates.map((cand) => {
    const cNameTokens = tokenize(cand.name);
    const cWorksTokens = tokenize(
      cand.works.map((w) => w.text || "").join(" ")
    );
    const cAboutTokens = tokenize(cand.about);
    const cAllTokens = [...new Set([...cNameTokens, ...cWorksTokens, ...cAboutTokens])];
    const cCats = getCategoryTags(cAllTokens);

    let score = 0;

    // Direct token matches in name
    for (const t of targetNameTokens) {
      if (cNameTokens.includes(t)) score += 8;
      else if (cWorksTokens.includes(t)) score += 4;
      else if (cAboutTokens.includes(t)) score += 2;
    }

    // Direct token matches in works/tasks
    for (const t of targetWorksTokens) {
      if (cNameTokens.includes(t)) score += 5;
      else if (cWorksTokens.includes(t)) score += 3;
      else if (cAboutTokens.includes(t)) score += 1;
    }

    // Category / domain alignment
    for (const cat of targetCats) {
      if (cCats.has(cat)) score += 6;
    }

    // Substring match in names
    const tLower = targetName.toLowerCase();
    const cLower = cand.name.toLowerCase();
    if (tLower && (cLower.includes(tLower) || tLower.includes(cLower))) {
      score += 10;
    }

    // Task count richness boost
    score += Math.min(cand.works.length, 5) * 0.3;

    return { ...cand, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by name so we don't show identical folder names
  const result = [];
  const registeredNames = new Set([targetName.toLowerCase()]);
  for (const item of scored) {
    const lowerName = item.name.toLowerCase();
    if (registeredNames.has(lowerName)) continue;
    registeredNames.add(lowerName);
    result.push(item);
  }

  return result;
}

