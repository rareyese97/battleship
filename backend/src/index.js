// backend/src/index.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const { Pool } = require("pg");
const { PrismaClient } = require("@prisma/client");
const authRouter = require("./routes/auth");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
app.set("trust proxy", 1); // Trust the single reverse proxy used by the host.

if (isProduction && !process.env.SESSION_SECRET) {
	throw new Error("SESSION_SECRET must be configured in production.");
}
if (isProduction && !process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL must be configured in production for persistent sessions.");
}

const server = http.createServer(app);
const prisma = new PrismaClient();
const sessionPool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 10,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 10_000,
});
sessionPool.on("error", (err) => {
	console.error("PostgreSQL session pool error:", err);
});

const PgSessionStore = connectPgSimple(session);
const { initSocket } = require("./socket");

// Allowed Origins
const allowedOrigins = [
	"http://localhost:3000",
	"https://sinkthatship.com",
	"https://www.sinkthatship.com",
	"https://api.sinkthatship.com",
];

// CORS Middleware
app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin) return callback(null, true);

			// Allow localhost, production, and Vercel previews.
			if (allowedOrigins.includes(origin) || /^https:\/\/battleship-2646-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
				return callback(null, true);
			}
			return callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	})
);

app.use(express.json({ limit: "20kb" }));

// Persist sessions in PostgreSQL so logins survive restarts and work across instances.
const sessionMiddleware = session({
	store: new PgSessionStore({
		pool: sessionPool,
		tableName: "user_sessions",
		createTableIfMissing: true,
		pruneSessionInterval: 15 * 60,
	}),
	secret: process.env.SESSION_SECRET || "keyboard cat",
	resave: false,
	saveUninitialized: false,
	cookie: {
		httpOnly: true,
		secure: isProduction,
		sameSite: isProduction ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24,
	},
});
app.use(sessionMiddleware);

// Auth Routes
app.use("/api/auth", authRouter);

// Session Route
app.get("/api/session", (req, res) => {
	if (req.session.user) {
		return res.json({ user: req.session.user });
	}
	res.json({});
});

// Leaderboard Route
app.get("/api/leaderboard", async (req, res) => {
	const type = req.query.type || "global";
	try {
		let users;
		if (type === "friends" && req.session.user) {
			const userWithFriends = await prisma.user.findUnique({
				where: { id: req.session.user.id },
				include: { friends: true },
			});
			const friendIds = userWithFriends.friends.map((f) => f.id).concat(req.session.user.id);
			users = await prisma.user.findMany({
				where: { id: { in: friendIds } },
				orderBy: { wins: "desc" },
				take: 15,
			});
		} else {
			users = await prisma.user.findMany({
				orderBy: { wins: "desc" },
				take: 15,
			});
		}
		const data = users.map((u) => ({
			id: u.id,
			username: u.username,
			wins: u.wins,
			losses: u.losses,
		}));
		res.json(data);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error." });
	}
});

// Placeholder for saving fleet
app.post("/api/fleet", async (req, res) => {
	res.json({ ok: true });
});

// Root route
app.get("/", (req, res) => {
	res.send("Backend is running!");
});

// Share the authenticated Express session with Socket.IO.
const io = initSocket(server);
io.engine.use(sessionMiddleware);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

server.on("close", async () => {
	await sessionPool.end();
	await prisma.$disconnect();
});
