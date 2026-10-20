import { Router } from "express";
import SocialPost from "../models/SocialPost.js";
import SocialGroup from "../models/SocialGroup.js";
import { liveWorksMongoStore } from "../liveWorksMongoStore.js";
import { liveWorksStore } from "../liveWorksStore.js";

const SEED_GROUPS = [
  {
    clientId: "g1",
    name: "Tech Placement Info",
    blurb: "Daily check-ins before noon.",
    avatar: "/groups/group_tech_placement.jpg",
    membersCount: 12,
    visibility: "public",
  },
  {
    clientId: "g2",
    name: "CSE S7 B",
    blurb: "Long pours, few distractions.",
    avatar: "/groups/group_cse_class.jpg",
    membersCount: 8,
    visibility: "public",
  },
  {
    clientId: "g3",
    name: "Ship Club",
    blurb: "Finish something every week.",
    avatar: "/groups/group_ship_club.jpg",
    membersCount: 21,
    visibility: "public",
  },
];

const SEED_VIEW_POSTS = [
  {
    clientId: "sample-1",
    author: { name: "Alex", handle: "alex", initial: "A" },
    scope: "view",
    meta: "poured 45 min · Design system",
    body: "Closed the gap on the logo mark and shipped the navbar refresh.",
  },
  {
    clientId: "sample-2",
    author: { name: "Maya", handle: "maya", initial: "M" },
    scope: "view",
    meta: "poured 2 hr · API rewrite",
    body: "Three important works cleared before noon. Hourglass never lied.",
  },
  {
    clientId: "sample-3",
    author: { name: "Jordan", handle: "jordan", initial: "J" },
    scope: "view",
    meta: "poured 20 min · Writing",
    body: "Short session, one finished draft. Showing up counts.",
  },
];

function asyncRoute(handler) {
  return (req, res, next) =>
    Promise.resolve()
      .then(() => handler(req, res))
      .catch(next);
}

function postQuery(targetId) {
  const clean = String(targetId || "").trim();
  const conditions = [{ clientId: clean }];
  if (/^[0-9a-fA-F]{24}$/.test(clean)) {
    conditions.push({ _id: clean });
  }
  return { $or: conditions };
}

function formatPost(doc, currentUserId) {
  const isUser = Boolean(
    currentUserId && String(doc.authorId || "") === String(currentUserId)
  );
  const likes = Array.isArray(doc.likes) ? doc.likes.map(String) : [];
  const isLiked = Boolean(currentUserId && likes.includes(String(currentUserId)));

  return {
    _id: String(doc._id || doc.clientId),
    id: String(doc.clientId || doc._id),
    name: doc.author?.name || "SandAdd User",
    handle: doc.author?.handle || "",
    initial:
      doc.author?.initial ||
      doc.author?.name?.slice(0, 1)?.toUpperCase() ||
      "U",
    authorId: String(doc.authorId || ""),
    scope: doc.scope || "view",
    groupId: doc.groupId || null,
    groupName: doc.groupName || "",
    body: doc.body || "",
    meta: doc.meta || "",
    projectId: doc.projectId || null,
    projectName: doc.projectName || "",
    creatorName: doc.creatorName || doc.sharedProject?.creatorName || "",
    creatorHandle: doc.creatorHandle || doc.sharedProject?.creatorHandle || "",
    topicId: doc.topicId || null,
    works: Array.isArray(doc.works) ? doc.works : [],
    sharedProject: doc.sharedProject || null,
    proof: doc.proof || null,
    kind: doc.kind || "post",
    likesCount: likes.length,
    isLiked,
    comments: Array.isArray(doc.comments) ? doc.comments : [],
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : new Date().toISOString(),
    isUser,
  };
}

export default function createSocialRouter(useMemory) {
  const router = Router();
  const liveStore = useMemory ? liveWorksStore : liveWorksMongoStore;

  // In-memory fallbacks if MongoDB is disabled in development
  const memPosts = [];
  const memGroups = [...SEED_GROUPS];

  // Helper to ensure default groups exist in MongoDB
  let seededPromise = null;
  async function ensureSeeded() {
    if (useMemory) return;
    if (!seededPromise) {
      seededPromise = (async () => {
        try {
          const groupCount = await SocialGroup.countDocuments();
          if (groupCount === 0) {
            await SocialGroup.insertMany(
              SEED_GROUPS.map((g) => ({
                ...g,
                creatorId: "system",
                memberIds: [],
              }))
            );
          }
          const postCount = await SocialPost.countDocuments();
          if (postCount === 0) {
            await SocialPost.insertMany(
              SEED_VIEW_POSTS.map((p) => ({
                ...p,
                authorId: "system",
                likes: [],
                comments: [],
              }))
            );
          }
        } catch (err) {
          console.warn("Could not seed default social data:", err.message);
        }
      })();
    }
    return seededPromise;
  }

  // GET /api/social/posts
  router.get(
    "/posts",
    asyncRoute(async (req, res) => {
      await ensureSeeded();
      const scope = req.query.scope === "group" ? "group" : "view";
      const groupId = req.query.groupId ? String(req.query.groupId) : null;
      const currentUserId = req.user?.id || null;

      if (useMemory) {
        let filtered = memPosts.filter((p) => p.scope === scope);
        if (scope === "group" && groupId) {
          filtered = filtered.filter((p) => String(p.groupId) === groupId);
        }
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return res.json(filtered.map((p) => formatPost(p, currentUserId)));
      }

      const query = { scope };
      if (scope === "group") {
        if (groupId) query.groupId = groupId;
      }
      const docs = await SocialPost.find(query)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      return res.json(docs.map((d) => formatPost(d, currentUserId)));
    })
  );

  // POST /api/social/posts
  router.post(
    "/posts",
    asyncRoute(async (req, res) => {
      const currentUserId = String(req.user?.id || "");
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const body = req.body || {};
      const postText = String(body.body || "").trim();
      const sharedProject = body.sharedProject && typeof body.sharedProject === "object"
        ? body.sharedProject
        : null;

      if (!postText && !sharedProject) {
        return res.status(400).json({ error: "Post content or attached project is required." });
      }

      const clientId = String(body.clientId || body.id || `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      const scope = body.scope === "group" ? "group" : "view";
      const groupId = scope === "group" ? String(body.groupId || "") : null;
      if (scope === "group" && !groupId) {
        return res.status(400).json({ error: "Group ID is required for group posts." });
      }

      const author = {
        name: String(req.user.name || "SandAdd User").slice(0, 80),
        handle: String(req.user.handle || req.user.email?.split("@")[0] || "").slice(0, 40),
        initial: String(req.user.name || "U").trim().slice(0, 2).toUpperCase() || "U",
      };

      // If a project is shared, ensure it is published as a LiveWork so all accounts can follow/assign it!
      if (sharedProject) {
        const liveOrigin =
          sharedProject.originId ||
          sharedProject.templateId?.replace(/^(live|fin)-/, "") ||
          body.projectId;

        if (liveOrigin) {
          try {
            await liveStore.put(
              String(liveOrigin),
              {
                originId: String(liveOrigin),
                name: String(sharedProject.name || body.projectName || "Work").slice(0, 80),
                mode: sharedProject.shareMode === "assign" ? "assign" : "follow",
                works: Array.isArray(sharedProject.works) ? sharedProject.works : [],
                durationMs: Number(sharedProject.durationMs) || 30_000,
                about: String(sharedProject.about || "").slice(0, 2000),
                author,
              },
              currentUserId
            );
          } catch (liveErr) {
            console.warn("Auto-publishing live work on post failed:", liveErr.message);
          }
        }
      }

      const postData = {
        clientId,
        authorId: currentUserId,
        author,
        scope,
        groupId,
        groupName: String(body.groupName || "").slice(0, 60),
        body: postText.slice(0, 2000),
        meta: String(body.meta || "").slice(0, 160),
        projectId: body.projectId ? String(body.projectId).slice(0, 120) : null,
        projectName: String(body.projectName || sharedProject?.name || "").slice(0, 80),
        creatorName: String(body.creatorName || sharedProject?.creatorName || "").slice(0, 80),
        creatorHandle: String(body.creatorHandle || sharedProject?.creatorHandle || "").slice(0, 40),
        topicId: body.topicId ? String(body.topicId).slice(0, 120) : null,
        works: Array.isArray(body.works) ? body.works : (Array.isArray(sharedProject?.works) ? sharedProject.works : []),
        sharedProject,
        proof: body.proof || null,
        kind: body.kind === "finished" ? "finished" : "post",
        likes: [],
        comments: [],
        createdAt: new Date(),
      };

      if (useMemory) {
        memPosts.unshift(postData);
        return res.status(201).json(formatPost(postData, currentUserId));
      }

      const created = await SocialPost.create(postData);
      return res.status(201).json(formatPost(created, currentUserId));
    })
  );

  // DELETE /api/social/posts/:id
  router.delete(
    "/posts/:id",
    asyncRoute(async (req, res) => {
      const currentUserId = String(req.user?.id || "");
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const targetId = String(req.params.id);

      if (useMemory) {
        const idx = memPosts.findIndex(
          (p) => p.clientId === targetId || String(p._id) === targetId
        );
        if (idx === -1) return res.status(404).json({ error: "Post not found" });
        if (memPosts[idx].authorId !== currentUserId) {
          return res.status(403).json({ error: "Cannot delete another user's post" });
        }
        memPosts.splice(idx, 1);
        return res.json({ ok: true, id: targetId });
      }

      const post = await SocialPost.findOne(postQuery(targetId));
      if (!post) return res.status(404).json({ error: "Post not found" });
      if (String(post.authorId) !== currentUserId) {
        return res.status(403).json({ error: "Cannot delete another user's post" });
      }

      await SocialPost.deleteOne({ _id: post._id });
      return res.json({ ok: true, id: targetId });
    })
  );

  // POST /api/social/posts/:id/like
  router.post(
    "/posts/:id/like",
    asyncRoute(async (req, res) => {
      const currentUserId = String(req.user?.id || "");
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });
      const targetId = String(req.params.id);

      if (useMemory) {
        const post = memPosts.find(
          (p) => p.clientId === targetId || String(p._id) === targetId
        );
        if (!post) return res.status(404).json({ error: "Post not found" });
        const likes = post.likes || [];
        const has = likes.includes(currentUserId);
        post.likes = has
          ? likes.filter((uid) => uid !== currentUserId)
          : [...likes, currentUserId];
        return res.json({
          liked: !has,
          likesCount: post.likes.length,
        });
      }

      const post = await SocialPost.findOne(postQuery(targetId));
      if (!post) return res.status(404).json({ error: "Post not found" });

      const likes = Array.isArray(post.likes) ? post.likes : [];
      const has = likes.includes(currentUserId);
      if (has) {
        post.likes = likes.filter((uid) => uid !== currentUserId);
      } else {
        post.likes.push(currentUserId);
      }
      await post.save();

      return res.json({
        liked: !has,
        likesCount: post.likes.length,
      });
    })
  );

  // POST /api/social/posts/:id/comments
  router.post(
    "/posts/:id/comments",
    asyncRoute(async (req, res) => {
      const currentUserId = String(req.user?.id || "");
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const text = String(req.body.text || "").trim().slice(0, 500);
      if (!text) return res.status(400).json({ error: "Comment text cannot be empty" });

      const targetId = String(req.params.id);
      const commentObj = {
        id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        authorId: currentUserId,
        name: String(req.user.name || "SandAdd User").slice(0, 80),
        handle: String(req.user.handle || "").slice(0, 40),
        initial: String(req.user.name || "U").trim().slice(0, 1).toUpperCase() || "U",
        text,
        createdAt: new Date().toISOString(),
      };

      if (useMemory) {
        const post = memPosts.find(
          (p) => p.clientId === targetId || String(p._id) === targetId
        );
        if (!post) return res.status(404).json({ error: "Post not found" });
        post.comments = post.comments || [];
        post.comments.push(commentObj);
        return res.json(post.comments);
      }

      const post = await SocialPost.findOne(postQuery(targetId));
      if (!post) return res.status(404).json({ error: "Post not found" });

      post.comments = post.comments || [];
      post.comments.push(commentObj);
      await post.save();

      return res.json(post.comments);
    })
  );

  // GET /api/social/groups
  router.get(
    "/groups",
    asyncRoute(async (_req, res) => {
      await ensureSeeded();
      if (useMemory) {
        return res.json(
          memGroups.map((g) => ({
            id: g.clientId,
            name: g.name,
            blurb: g.blurb,
            avatar: g.avatar,
            members: g.membersCount || (g.memberIds ? g.memberIds.length : 1),
            isCustom: Boolean(g.creatorId && g.creatorId !== "system"),
          }))
        );
      }

      const groups = await SocialGroup.find({ visibility: "public" })
        .sort({ updatedAt: -1 })
        .lean();

      return res.json(
        groups.map((g) => ({
          id: g.clientId,
          name: g.name,
          blurb: g.blurb || "",
          avatar: g.avatar || "",
          members: Math.max(g.memberIds?.length || 0, g.membersCount || 1),
          isCustom: Boolean(g.creatorId && g.creatorId !== "system"),
        }))
      );
    })
  );

  // POST /api/social/groups
  router.post(
    "/groups",
    asyncRoute(async (req, res) => {
      const currentUserId = String(req.user?.id || "");
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });

      const name = String(req.body.name || "").trim().slice(0, 60);
      if (!name) return res.status(400).json({ error: "Group name is required" });

      const blurb = String(req.body.blurb || "").trim().slice(0, 120);
      const avatar = String(req.body.avatar || "").trim();
      const clientId = `ug-${Date.now()}`;

      const groupData = {
        clientId,
        creatorId: currentUserId,
        name,
        blurb,
        avatar,
        memberIds: [currentUserId],
        membersCount: 1,
        visibility: "public",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (useMemory) {
        memGroups.unshift(groupData);
        return res.status(201).json({
          id: groupData.clientId,
          name: groupData.name,
          blurb: groupData.blurb,
          avatar: groupData.avatar,
          members: 1,
          isCustom: true,
        });
      }

      const created = await SocialGroup.create(groupData);
      return res.status(201).json({
        id: created.clientId,
        name: created.name,
        blurb: created.blurb,
        avatar: created.avatar,
        members: 1,
        isCustom: true,
      });
    })
  );

  // POST /api/social/groups/:id/join
  router.post(
    "/groups/:id/join",
    asyncRoute(async (req, res) => {
      const currentUserId = String(req.user?.id || "");
      if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });
      const targetId = String(req.params.id);

      if (useMemory) {
        const group = memGroups.find((g) => g.clientId === targetId);
        if (!group) return res.status(404).json({ error: "Group not found" });
        group.memberIds = group.memberIds || [];
        if (!group.memberIds.includes(currentUserId)) {
          group.memberIds.push(currentUserId);
          group.membersCount = (group.membersCount || 1) + 1;
        }
        return res.json({ ok: true, members: group.membersCount });
      }

      const group = await SocialGroup.findOne({ clientId: targetId });
      if (!group) return res.status(404).json({ error: "Group not found" });

      if (!group.memberIds.includes(currentUserId)) {
        group.memberIds.push(currentUserId);
        group.membersCount = Math.max(group.membersCount || 1, group.memberIds.length);
        await group.save();
      }

      return res.json({ ok: true, members: group.membersCount });
    })
  );

  return router;
}
