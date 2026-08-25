import { Router, type Request, type Response } from "express";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@workspace/db";
import { conversations, messages, sessions, users } from "@workspace/db/schema";

const router = Router();
const ADMIN_EMAIL = "suleimanabdullhamid0@gmail.com";
const FREE_LIMIT = 25;
const PREMIUM_LIMIT = 1000;

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(derived, Buffer.from(key, "hex"));
}
function publicUser(user: typeof users.$inferSelect) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan, usage: user.usage, usageLimit: user.usageLimit };
}
async function userFromRequest(req: Request) {
  const sid = req.cookies?.nova_session;
  if (!sid) return null;
  const rows = await db.select({ user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sid), sql`${sessions.expiresAt} > now()`)).limit(1);
  return rows[0]?.user ?? null;
}
async function ensureAdmin() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return;
  const existing = await db.select().from(users).where(eq(users.email, ADMIN_EMAIL)).limit(1);
  if (existing.length) {
    if (existing[0].role !== "ADMIN" || existing[0].plan !== "PREMIUM") {
      await db.update(users).set({ role: "ADMIN", plan: "PREMIUM", usageLimit: PREMIUM_LIMIT }).where(eq(users.email, ADMIN_EMAIL));
    }
    return;
  }
  await db.insert(users).values({ email: ADMIN_EMAIL, passwordHash: hashPassword(password), role: "ADMIN", plan: "PREMIUM", usageLimit: PREMIUM_LIMIT });
}
function requireUser(handler: (req: Request, res: Response, user: NonNullable<Awaited<ReturnType<typeof userFromRequest>>>) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    const user = await userFromRequest(req);
    if (!user) { res.status(401).json({ error: "Authentication required" }); return; }
    await handler(req, res, user);
  };
}

router.get("/auth/me", requireUser(async (_req, res, user) => res.json(publicUser(user))));
router.post("/auth/signup", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || password.length < 8) { res.status(400).json({ error: "A valid email and password of at least 8 characters are required" }); return; }
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) { res.status(409).json({ error: "An account with this email already exists" }); return; }
  const [user] = await db.insert(users).values({ email, name: req.body?.name ? String(req.body.name).slice(0, 80) : null, passwordHash: hashPassword(password) }).returning();
  const sid = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ id: sid, userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) });
  res.cookie("nova_session", sid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 * 30 });
  res.status(201).json(publicUser(user));
});
router.post("/auth/login", async (req, res) => {
  await ensureAdmin();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) { res.status(401).json({ error: "Invalid email or password" }); return; }
  const sid = randomBytes(32).toString("hex");
  await db.insert(sessions).values({ id: sid, userId: user.id, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) });
  res.cookie("nova_session", sid, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 24 * 30 });
  res.json(publicUser(user));
});
router.post("/auth/logout", async (req, res) => {
  if (req.cookies?.nova_session) await db.delete(sessions).where(eq(sessions.id, req.cookies.nova_session));
  res.clearCookie("nova_session");
  res.status(204).send();
});

router.get("/conversations", requireUser(async (_req, res, user) => {
  const rows = await db.select({ conversation: conversations, messageCount: count(messages.id) }).from(conversations)
    .leftJoin(messages, eq(messages.conversationId, conversations.id)).where(eq(conversations.userId, user.id))
    .groupBy(conversations.id).orderBy(desc(conversations.updatedAt));
  res.json(rows.map(({ conversation, messageCount }) => ({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt.toISOString(), messageCount: Number(messageCount) })));
}));
router.post("/conversations", requireUser(async (req, res, user) => {
  const [conversation] = await db.insert(conversations).values({ userId: user.id, title: String(req.body?.title ?? "New conversation").slice(0, 120) }).returning();
  res.status(201).json({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt.toISOString(), messageCount: 0 });
}));
router.get("/conversations/:id/messages", requireUser(async (req, res, user) => {
  const [owned] = await db.select().from(conversations).where(and(eq(conversations.id, String(req.params.id)), eq(conversations.userId, user.id))).limit(1);
  if (!owned) { res.status(404).json({ error: "Conversation not found" }); return; }
  const rows = await db.select().from(messages).where(eq(messages.conversationId, owned.id)).orderBy(messages.createdAt);
  res.json(rows.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(), citations: m.citations ? JSON.parse(m.citations) : [] })));
}));
router.post("/conversations/:id/messages", requireUser(async (req, res, user) => {
  const content = String(req.body?.content ?? "").trim();
  const [owned] = await db.select().from(conversations).where(and(eq(conversations.id, String(req.params.id)), eq(conversations.userId, user.id))).limit(1);
  if (!owned) { res.status(404).json({ error: "Conversation not found" }); return; }
  if (!content) { res.status(400).json({ error: "Message cannot be empty" }); return; }
  if (user.usage >= user.usageLimit) { res.status(402).json({ error: "Usage limit reached", usageLimit: user.usageLimit }); return; }
  await db.insert(messages).values({ conversationId: owned.id, role: "user", content });
  const assistantContent = process.env.OPENAI_API_KEY
    ? "AI provider is connected, but the model adapter is not configured for this deployment yet."
    : "NOVA is ready for your prompt. Add an AI provider connection to enable live responses.";
  const [reply] = await db.insert(messages).values({ conversationId: owned.id, role: "assistant", content: assistantContent }).returning();
  await db.update(users).set({ usage: user.usage + 1 }).where(eq(users.id, user.id));
  await db.update(conversations).set({ updatedAt: new Date(), title: owned.title === "New conversation" ? content.slice(0, 48) : owned.title }).where(eq(conversations.id, owned.id));
  res.json({ id: reply.id, role: reply.role, content: reply.content, createdAt: reply.createdAt.toISOString(), citations: [] });
}));

router.post("/assistant/research", requireUser(async (_req, res) => {
  res.json({ status: "configuration_required", answer: "Web research is not configured yet. Connect a web search provider to enable cited research.", sources: [] });
}));
router.post("/assistant/generate-image", requireUser(async (_req, res) => {
  res.json({ status: "configuration_required", message: "Image generation is not configured yet. Connect an image provider to enable generation.", url: null });
}));
router.post("/billing/checkout", requireUser(async (_req, res) => {
  res.json({ status: "configuration_required", message: "Payments are not configured yet. Connect Stripe to enable secure premium checkout.", url: null });
}));

router.get("/admin/overview", requireUser(async (_req, res, user) => {
  if (user.role !== "ADMIN") { res.status(403).json({ error: "Admin access required" }); return; }
  const [allUsers] = await db.select({ value: count() }).from(users);
  const [premium] = await db.select({ value: count() }).from(users).where(eq(users.plan, "PREMIUM"));
  const [today] = await db.select({ value: count() }).from(messages).where(sql`${messages.createdAt} >= current_date`);
  res.json({ users: Number(allUsers.value), premiumUsers: Number(premium.value), messagesToday: Number(today.value), providerStatus: { ai: Boolean(process.env.OPENAI_API_KEY), research: Boolean(process.env.TAVILY_API_KEY), images: Boolean(process.env.IMAGE_API_KEY), payments: Boolean(process.env.STRIPE_SECRET_KEY) } });
}));
router.get("/admin/users", requireUser(async (_req, res, user) => {
  if (user.role !== "ADMIN") { res.status(403).json({ error: "Admin access required" }); return; }
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  res.json(rows.map(publicUser));
}));

export default router;