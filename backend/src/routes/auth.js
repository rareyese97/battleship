// backend/src/routes/auth.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const router = express.Router();
const prisma = new PrismaClient();

// Configure SendGrid mail transporter
const transporter = nodemailer.createTransport({
	host: "smtp.sendgrid.net",
	port: 587,
	secure: false,
	auth: {
		user: "apikey",
		pass: process.env.SENDGRID_API_KEY,
	},
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
	const { email, username, password } = req.body;
	try {
		// 1) Check duplicates
		const exists = await prisma.user.findFirst({
			where: { OR: [{ email }, { username }] },
		});
		if (exists) {
			return res.status(400).json({ error: "Email or username already in use." });
		}

		// 2) Hash password
		const hashed = await bcrypt.hash(password, 10);

		// 3) Generate verification token
		const verifyToken = crypto.randomBytes(32).toString("hex");
		const verifySentAt = new Date();

		// 4) Create user (emailVerified defaults to false)
		await prisma.user.create({
			data: { email, username, password: hashed, verifyToken, verifySentAt },
		});

		// 5) Build one-click verification URL (pointing at this same server)
		const verifyUrl =
			`http://localhost:4000/api/auth/verify-email` + `?email=${encodeURIComponent(email)}` + `&token=${verifyToken}`;

		// 6) Send the email
		await transporter.sendMail({
			from: process.env.SMTP_FROM,
			to: email,
			subject: "Verify your Battleship Online account",
			html: `
        <p>Hey ${username},</p>
        <p>Click below to verify your email:</p>
        <p><a href="${verifyUrl}">Verify my email</a></p>
        <p>If that link doesn’t work, copy this code into the app:</p>
        <p><strong>${verifyToken}</strong></p>
      `,
		});

		return res.status(201).json({ message: "Registered! Check your email to verify." });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "Internal server error." });
	}
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
	const { email, password } = req.body;

	try {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(400).json({ error: "Invalid credentials." });

		const match = await bcrypt.compare(password, user.password);
		if (!match) return res.status(400).json({ error: "Invalid credentials." });

		if (!user.emailVerified) return res.status(400).json({ error: "unverified" });

		// Store user data in the session
		req.session.user = {
			id: user.id,
			username: user.username,
			email: user.email,
		};

		return res.json({ message: "Login successful." });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "Internal server error." });
	}
});

router.post("/logout", (req, res) => {
	try {
		req.session.destroy((err) => {
			if (err) {
				console.error("Logout error:", err);
				return res.status(500).json({ error: "Logout failed" });
			}
			res.clearCookie("connect.sid"); // optional but good practice
			return res.status(200).json({ message: "Logged out successfully" });
		});
	} catch (err) {
		console.error("Logout server error:", err);
		res.status(500).json({ error: "Server error" });
	}
});

// POST /api/auth/verify (fallback for manual code entry)
router.post("/verify", async (req, res) => {
	const { email, code } = req.body;
	try {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || user.verifyToken !== code) {
			return res.status(400).json({ error: "Invalid verification code." });
		}

		// Check 24-hour expiry
		const ageMs = Date.now() - new Date(user.verifySentAt).getTime();
		if (ageMs > 1000 * 60 * 60 * 24) {
			return res.status(400).json({ error: "Verification code expired." });
		}

		await prisma.user.update({
			where: { email },
			data: { emailVerified: true, verifyToken: null, verifySentAt: null },
		});

		return res.json({ message: "Email verified." });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "Internal server error." });
	}
});

// POST /api/auth/resend
router.post("/resend", async (req, res) => {
	const { email } = req.body;
	try {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(400).json({ error: "User not found." });

		const verifyToken = crypto.randomBytes(32).toString("hex");
		const verifySentAt = new Date();

		await prisma.user.update({
			where: { email },
			data: { verifyToken, verifySentAt },
		});

		await transporter.sendMail({
			from: process.env.SMTP_FROM,
			to: email,
			subject: "Battleship Online: Verify Your Email Again",
			html: `
        <p>Your new verification code is:</p>
        <p><strong>${verifyToken}</strong></p>
      `,
		});

		return res.json({ message: "Verification email resent." });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ error: "Internal server error." });
	}
});

// GET /api/auth/verify-email (one-click link)
router.get("/verify-email", async (req, res) => {
	const { email, token } = req.query;
	if (!email || !token) {
		return res.status(400).send("Missing email or token");
	}

	try {
		const user = await prisma.user.findUnique({
			where: { email: String(email) },
		});
		if (!user || user.verifyToken !== String(token)) {
			return res.status(400).send("Invalid or expired verification link");
		}

		// Enforce 24-hour expiry
		const ageMs = Date.now() - new Date(user.verifySentAt).getTime();
		if (ageMs > 1000 * 60 * 60 * 24) {
			return res.status(400).send("Verification link has expired");
		}

		// Mark as verified
		await prisma.user.update({
			where: { email: String(email) },
			data: {
				emailVerified: true,
				verifyToken: null,
				verifySentAt: null,
			},
		});

		// Redirect back to local front-end
		return res.redirect(`http://localhost:3000/?verified=true&email=${encodeURIComponent(email)}`);
	} catch (err) {
		console.error(err);
		return res.status(500).send("Server error");
	}
});

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
	const { email } = req.body;
	try {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(404).json({ error: "Please enter a valid email address." });

		const resetToken = crypto.randomBytes(32).toString("hex");
		const resetSentAt = new Date();

		await prisma.user.update({
			where: { email },
			data: { resetToken, resetSentAt },
		});

		// send reset link or code
		await transporter.sendMail({
			from: process.env.SMTP_FROM,
			to: email,
			subject: "Password reset request",
			html: `
        <p>Your reset code is:</p>
        <p><strong>${resetToken}</strong></p>
      `,
		});

		res.json({ message: "Password reset email sent." });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error." });
	}
});

// POST /api/auth/verify-reset-code
router.post("/verify-reset-code", async (req, res) => {
	const { email, code } = req.body;
	try {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || user.resetToken !== code) {
			return res.status(400).json({ error: "Invalid reset code." });
		}
		// optional: expire after 1h
		const age = Date.now() - new Date(user.resetSentAt).getTime();
		if (age > 1000 * 60 * 60) {
			return res.status(400).json({ error: "Reset code expired." });
		}
		res.json({ message: "Reset code valid." });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error." });
	}
});

// POST /api/auth/reset-password
router.post("/reset-password", async (req, res) => {
	const { email, code, newPassword } = req.body;
	try {
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || user.resetToken !== code) {
			return res.status(400).json({ error: "Invalid reset code." });
		}
		// (re-use expiry check if you like)
		if (await bcrypt.compare(newPassword, user.password)) {
			return res.status(400).json({ error: "New password must be different from the old password." });
		}
		const hashed = await bcrypt.hash(newPassword, 10);
		await prisma.user.update({
			where: { email },
			data: {
				password: hashed,
				resetToken: null,
				resetSentAt: null,
			},
		});
		res.json({ message: "Password has been reset." });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error." });
	}
});

module.exports = router;
