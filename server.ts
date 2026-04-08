import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import { sendInvitationEmail, sendEmail } from "./server/emailService.js";

dotenv.config();

const db = new Database("stories.db");
const JWT_SECRET = process.env.JWT_SECRET || "vox-narrative-secret-key-2024";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    genre TEXT,
    language TEXT,
    characters TEXT,
    tone TEXT,
    setting TEXT,
    owner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS story_branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER,
    parent_id INTEGER,
    content TEXT,
    choice_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(story_id) REFERENCES stories(id),
    FOREIGN KEY(parent_id) REFERENCES story_branches(id)
  );

  CREATE TABLE IF NOT EXISTS collaborations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id INTEGER,
    user_id INTEGER,
    role TEXT DEFAULT 'editor',
    UNIQUE(story_id, user_id),
    FOREIGN KEY(story_id) REFERENCES stories(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Add setting column if it doesn't exist
try {
  db.exec("ALTER TABLE stories ADD COLUMN setting TEXT");
} catch (e) {
  // Column likely already exists
}

// Migration: Add notes column to story_branches
try {
  db.exec("ALTER TABLE story_branches ADD COLUMN notes TEXT");
} catch (e) {
  // Column likely already exists
}

// Migration: Add target_branch_id column to story_branches
try {
  db.exec("ALTER TABLE story_branches ADD COLUMN target_branch_id INTEGER");
} catch (e) {
  // Column likely already exists
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post("/api/auth/register", async (req, res) => {
    const { username, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
      const info = stmt.run(username, email, hashedPassword);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: "Username or email already exists" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  });

  // Story Routes
  app.get("/api/stories", authenticateToken, (req: any, res) => {
    const stories = db.prepare(`
      SELECT s.*, u.username as owner_name 
      FROM stories s 
      JOIN users u ON s.owner_id = u.id 
      WHERE s.owner_id = ? 
      OR s.id IN (SELECT story_id FROM collaborations WHERE user_id = ?)
      ORDER BY s.created_at DESC
    `).all(req.user.id, req.user.id);
    res.json(stories);
  });

  app.post("/api/stories", authenticateToken, (req: any, res) => {
    const { title, genre, language, characters, tone, setting } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    
    try {
      const stmt = db.prepare("INSERT INTO stories (title, genre, language, characters, tone, setting, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const info = stmt.run(title, genre, language, characters, tone, setting, req.user.id);
      res.status(201).json({ id: info.lastInsertRowid });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create story" });
    }
  });

  app.get("/api/stories/:id", authenticateToken, (req: any, res) => {
    const story = db.prepare("SELECT * FROM stories WHERE id = ?").get(req.params.id);
    const branches = db.prepare("SELECT * FROM story_branches WHERE story_id = ? ORDER BY created_at ASC").all(req.params.id);
    res.json({ story, branches });
  });

  app.post("/api/stories/:id/branches", authenticateToken, (req: any, res) => {
    const { content, parent_id, choice_text, target_branch_id } = req.body;
    if (!content && content !== "" && !target_branch_id) return res.status(400).json({ error: "Content or target is required" });
    
    try {
      const stmt = db.prepare("INSERT INTO story_branches (story_id, parent_id, content, choice_text, target_branch_id) VALUES (?, ?, ?, ?, ?)");
      const info = stmt.run(req.params.id, parent_id, content || "", choice_text, target_branch_id);
      const newBranch = { 
        id: info.lastInsertRowid, 
        story_id: req.params.id, 
        parent_id, 
        content: content || "", 
        choice_text, 
        target_branch_id,
        created_at: new Date().toISOString(), 
        notes: "" 
      };
      res.status(201).json(newBranch);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save story segment" });
    }
  });

  app.patch("/api/branches/:id", authenticateToken, (req: any, res) => {
    const { content, notes, choice_text, target_branch_id } = req.body;
    try {
      const branch = db.prepare("SELECT * FROM story_branches WHERE id = ?").get(req.params.id) as any;
      if (!branch) return res.status(404).json({ error: "Branch not found" });

      const stmt = db.prepare(`
        UPDATE story_branches 
        SET content = COALESCE(?, content), 
            notes = COALESCE(?, notes),
            choice_text = COALESCE(?, choice_text),
            target_branch_id = COALESCE(?, target_branch_id)
        WHERE id = ?
      `);
      stmt.run(content, notes, choice_text, target_branch_id, req.params.id);
      
      const updatedBranch = db.prepare("SELECT * FROM story_branches WHERE id = ?").get(req.params.id);
      res.json(updatedBranch);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", authenticateToken, (req: any, res) => {
    try {
      const branch = db.prepare("SELECT * FROM story_branches WHERE id = ?").get(req.params.id) as any;
      if (!branch) return res.status(404).json({ error: "Branch not found" });

      // Recursive delete function for children
      const deleteRecursive = (id: number) => {
        const children = db.prepare("SELECT id FROM story_branches WHERE parent_id = ?").all(id) as any[];
        children.forEach(child => deleteRecursive(child.id));
        db.prepare("DELETE FROM story_branches WHERE id = ?").run(id);
      };

      deleteRecursive(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  app.patch("/api/stories/:id", authenticateToken, (req: any, res) => {
    const { title, genre, language, characters, tone, setting } = req.body;
    try {
      const story = db.prepare("SELECT * FROM stories WHERE id = ?").get(req.params.id) as any;
      if (!story) return res.status(404).json({ error: "Story not found" });

      const stmt = db.prepare(`
        UPDATE stories 
        SET title = COALESCE(?, title), 
            genre = COALESCE(?, genre),
            language = COALESCE(?, language),
            characters = COALESCE(?, characters),
            tone = COALESCE(?, tone),
            setting = COALESCE(?, setting)
        WHERE id = ?
      `);
      stmt.run(title, genre, language, characters, tone, setting, req.params.id);
      
      const updatedStory = db.prepare("SELECT * FROM stories WHERE id = ?").get(req.params.id);
      res.json(updatedStory);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update story" });
    }
  });

  // Collaboration Routes
  app.post("/api/stories/:id/collaborate", authenticateToken, async (req: any, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Collaborator email is required" });
    
    const user = db.prepare("SELECT id, username FROM users WHERE email = ?").get(email) as any;
    if (!user) return res.status(400).json({ error: `User with email ${email} not found. Please ensure they have registered.` });
    
    try {
      db.prepare("INSERT INTO collaborations (story_id, user_id) VALUES (?, ?)").run(req.params.id, user.id);
      
      // Send invitation email
      const story = db.prepare("SELECT title FROM stories WHERE id = ?").get(req.params.id) as any;
      const appUrl = process.env.APP_URL || `http://localhost:3000`;
      const storyUrl = `${appUrl}/story/${req.params.id}`;
      
      await sendInvitationEmail(email, story.title, req.user.username, storyUrl);
      
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Already collaborating" });
    }
  });

  app.post("/api/send-message", authenticateToken, async (req: any, res) => {
    const { to, subject, message } = req.body;
    if (!to || !subject || !message) {
      return res.status(400).json({ 
        error: "Missing required fields", 
        details: { to: !!to, subject: !!subject, message: !!message } 
      });
    }

    try {
      await sendEmail(to, subject, `<p>${message}</p>`);
      res.json({ success: true, message: "Message sent" });
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/activity", authenticateToken, (req: any, res) => {
    try {
      const activity = db.prepare(`
        SELECT b.*, s.title as story_title, u.username as author_name
        FROM story_branches b
        JOIN stories s ON b.story_id = s.id
        JOIN users u ON s.owner_id = u.id -- This is simplified, ideally we'd track who created the branch
        WHERE s.owner_id = ? 
        OR s.id IN (SELECT story_id FROM collaborations WHERE user_id = ?)
        ORDER BY b.created_at DESC
        LIMIT 20
      `).all(req.user.id, req.user.id);
      res.json(activity);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // Socket.io for Real-time
  const storyUsers = new Map<string, Set<string>>();

  io.on("connection", (socket) => {
    let currentStoryId: string | null = null;
    let currentUsername: string | null = null;

    socket.on("join-story", ({ storyId, username }) => {
      currentStoryId = storyId;
      currentUsername = username;
      socket.join(`story-${storyId}`);
      
      if (!storyUsers.has(storyId)) {
        storyUsers.set(storyId, new Set());
      }
      storyUsers.get(storyId)?.add(username);
      
      io.to(`story-${storyId}`).emit("collaborators-update", Array.from(storyUsers.get(storyId) || []));
    });

    socket.on("disconnect", () => {
      if (currentStoryId && currentUsername) {
        storyUsers.get(currentStoryId)?.delete(currentUsername);
        io.to(`story-${currentStoryId}`).emit("collaborators-update", Array.from(storyUsers.get(currentStoryId) || []));
      }
    });

    socket.on("story-update", (data) => {
      socket.to(`story-${data.storyId}`).emit("story-updated", data.branch);
    });

    socket.on("branch-delete", (data) => {
      socket.to(`story-${data.storyId}`).emit("branch-deleted", data.branchId);
    });

    socket.on("typing", (data) => {
      socket.to(`story-${data.storyId}`).emit("user-typing", data.username);
    });

    socket.on("cursor-move", (data) => {
      socket.to(`story-${data.storyId}`).emit("user-cursor-moved", {
        username: data.username,
        cursor: data.cursor
      });
    });

    socket.on("content-change", (data) => {
      socket.to(`story-${data.storyId}`).emit("content-updated", {
        username: data.username,
        content: data.content
      });
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
