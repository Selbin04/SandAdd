/**
 * Utility for calculating and formatting deterministic likes & members statistics
 * for progress folders, giving the platform a bustling, popular feel.
 */

export function getStableSeed(key) {
  const str = String(key || "sandadd");
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return Math.abs(h);
}

export function getDummyBaseStats(itemOrId) {
  const id =
    typeof itemOrId === "object" && itemOrId !== null
      ? itemOrId._id || itemOrId.id || itemOrId.name || "default"
      : String(itemOrId || "default");

  const seed = getStableSeed(id);
  // Realistic popular counts:
  // Base likes: 120 to 2,920
  const baseLikes = 120 + (seed % 2800);
  // Base members: 35 to 895
  const baseMembers = 35 + (Math.floor(seed / 2800) % 860);

  return { baseLikes, baseMembers };
}

export function formatStatCount(n) {
  const num = typeof n === "number" ? n : parseInt(n, 10) || 0;
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(num);
}

export const DUMMY_COMMENT_POOL = [
  {
    author: "Aarav Sharma",
    text: "This step was super helpful, thanks for sharing!",
    offsetHours: 3,
  },
  {
    author: "Priya Patel",
    text: "Bookmarked this path! Very clean explanation.",
    offsetHours: 8,
  },
  {
    author: "Rohan Kulkarni",
    text: "Followed this exact method and it worked smoothly.",
    offsetHours: 14,
  },
  {
    author: "Ananya Mehta",
    text: "Such a structured way to track progress. Keep it up!",
    offsetHours: 22,
  },
  {
    author: "David Chen",
    text: "Great breakdown, looking forward to the next update.",
    offsetHours: 30,
  },
  {
    author: "Sarah Jenkins",
    text: "Solved the exact issue I was stuck on yesterday. Thanks!",
    offsetHours: 38,
  },
  {
    author: "Vikram Malhotra",
    text: "Love how detailed this is. Added to my favorites.",
    offsetHours: 45,
  },
  {
    author: "Neha Verma",
    text: "Awesome progress! Thanks for documenting the journey.",
    offsetHours: 52,
  },
  {
    author: "Aditya Verma",
    text: "Clean implementation, appreciate the source references!",
    offsetHours: 64,
  },
  {
    author: "Kavita Rao",
    text: "This inspired me to organize my own workflow like this.",
    offsetHours: 76,
  },
  {
    author: "Marcus Vance",
    text: "Great milestone achieved here! 🔥",
    offsetHours: 88,
  },
  {
    author: "Tanvi Gupta",
    text: "Super valuable, shared this with my team.",
    offsetHours: 96,
  },
  {
    author: "Liam Taylor",
    text: "Really helpful references attached here.",
    offsetHours: 110,
  },
  {
    author: "Sneha Reddy",
    text: "Tried this today and everything clicked. Thank you!",
    offsetHours: 125,
  },
  {
    author: "Karan Johar",
    text: "The notes on this file saved me a lot of time.",
    offsetHours: 140,
  },
  {
    author: "Emily Watson",
    text: "Clean and focused. Perfect pacing for this step.",
    offsetHours: 160,
  },
];

/**
 * Returns a random deterministic like count for a progress file (task/topic).
 * Ranges between 14 and 168.
 */
export function getDummyTopicLikes(topicOrId) {
  const id =
    typeof topicOrId === "object" && topicOrId !== null
      ? String(topicOrId.id || topicOrId._id || topicOrId.text || "topic")
      : String(topicOrId || "topic");
  const seed = getStableSeed(id);
  return 14 + (seed % 155);
}

/**
 * Returns a deterministic list of 2-4 authentic comments for a progress file (task/topic).
 */
export function getDummyTopicComments(topicOrId) {
  const id =
    typeof topicOrId === "object" && topicOrId !== null
      ? String(topicOrId.id || topicOrId._id || topicOrId.text || "topic")
      : String(topicOrId || "topic");
  const seed = getStableSeed(id);
  const count = 2 + (seed % 3); // 2, 3, or 4 comments
  const poolLen = DUMMY_COMMENT_POOL.length;
  const startIndex = seed % poolLen;

  const result = [];
  for (let i = 0; i < count; i++) {
    const item = DUMMY_COMMENT_POOL[(startIndex + i * 3) % poolLen];
    const offsetMs = (item.offsetHours + (seed % 10)) * 3600000;
    result.push({
      id: `dummy-cmt-${seed}-${i}`,
      author: item.author,
      text: item.text,
      createdAt: new Date(Date.now() - offsetMs).toISOString(),
      isDummy: true,
    });
  }
  return result;
}
