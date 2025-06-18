// backend/src/index.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
const { PrismaClient } = require("@prisma/client");
const authRouter = require("./routes/auth");

const app = express();
app.set("trust proxy", 1); // Trust Heroku/Render/Vercel proxy

const server = http.createServer(app);
const prisma = new PrismaClient();
const { initSocket } = require("./socket");

// Allowed Origins
const allowedOrigins = [
	"http://localhost:3000",
	"https://sinkthatship.com",
	"https://www.sinkthatship.com",
];
// CORS Middleware
app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin) return callback(null, true);

			// Allow localhost, prod, and Vercel previews
			if (allowedOrigins.includes(origin) || /https:\/\/battleship-2646.*\.vercel\.app/.test(origin)) {
				return callback(null, true);
			} else {
				console.log("❌ Blocked CORS origin:", origin);
				return callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
	})
);

app.use(express.json());

// Session Middleware
app.use(
	session({
		secret: process.env.SESSION_SECRET || "keyboard cat",
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || process.env.RENDER === "TRUE",
			sameSite:
				process.env.NODE_ENV === "production" || process.env.VERCEL === "1" || process.env.RENDER === "TRUE"
					? "none"
					: "lax",
			// If you want to force cookies to your domain:
			// domain: process.env.NODE_ENV === "production" ? "sinkthatship.com" : undefined,
			maxAge: 1000 * 60 * 60 * 24,
		},
	})
);

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

// Start Socket server
initSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
