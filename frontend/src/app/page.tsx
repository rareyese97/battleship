// src/app/page.tsx
"use client";
import { backendUrl } from "./lib/config";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle, Mail, Lock, User, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import shipImage from "../../public/ship.png";
import { Suspense } from "react";

export default function HomePage() {
	const router = useRouter();
	const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

	useEffect(() => {
		async function checkSession() {
			try {
				const res = await fetch(`${backendUrl}/api/session`, { credentials: "include" });
				const data = await res.json();
				if (data.user) {
					router.push("/hub");
				}
			} catch (err) {
				console.error("Failed to check session:", err);
			}
		}

		checkSession();
	}, []);

	const [showToast, setShowToast] = useState(false);
	const [modal, setModal] = useState<"login" | "signup" | "forgot" | "verify" | null>(null);
	const [forgotStep, setForgotStep] = useState<"email" | "code" | "reset">("email");

	// Common form state
	const [email, setEmail] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [code, setCode] = useState("");
	const [error, setError] = useState("");
	const [info, setInfo] = useState("");

	const emailRegex = /^\S+@\S+\.\S+$/;
	const passwordRegex = /^(?=.*\d).{8,}$/;

	function VerifiedToast() {
		const searchParams = useSearchParams();
		const verifiedParam = searchParams.get("verified");
		const [showToast, setShowToast] = useState(false);

		useEffect(() => {
			if (verifiedParam === "true") {
				setShowToast(true);
				window.history.replaceState({}, "", window.location.pathname);
				setTimeout(() => setShowToast(false), 5000);
			}
		}, [verifiedParam]);

		return (
			<AnimatePresence>
				{showToast && (
					<motion.div
						key="toast"
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						transition={{ duration: 0.3 }}
						className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
					>
						Email verified! Log in now!
					</motion.div>
				)}
			</AnimatePresence>
		);
	}

	const resetModals = () => {
		setError("");
		setInfo("");
		setPassword("");
		setConfirm("");
		setCode("");
	};
	const closeModal = () => {
		setModal(null);
		resetModals();
	};
	const openLogin = () => {
		resetModals();
		setModal("login");
	};
	const openSignup = () => {
		resetModals();
		setModal("signup");
	};
	const openForgot = () => {
		resetModals();
		setModal("forgot");
		setForgotStep("email");
	};
	const openVerify = (prefillEmail = "") => {
		resetModals();
		setEmail(prefillEmail);
		setModal("verify");
	};

	// Sign up
	const handleSignup = async () => {
		setError("");
		if (!emailRegex.test(email)) {
			setError("Please enter a valid email.");
			return;
		}
		if (!username) {
			setError("Username cannot be empty.");
			return;
		}
		if (!passwordRegex.test(password)) {
			setError("Password must be at least 8 characters and include a number.");
			return;
		}
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		try {
			const res = await fetch(`${backendUrl}/api/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, username, password }),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.error || "Registration failed.");
				return;
			}
			openVerify(email);
		} catch {
			setError("Network error. Please try again.");
		}
	};

	// Login
	const handleLogin = async () => {
		setError("");
		const res = await fetch(`${backendUrl}/api/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
			credentials: "include",
		});
		const data = await res.json();
		if (!res.ok) {
			if (data.error === "unverified") {
				openVerify(email);
				return;
			}
			setError(data.error || "Login failed.");
			return;
		}
		router.push("/hub");
	};

	// Verify code fallback
	const handleVerify = async () => {
		setError("");
		const res = await fetch(`${backendUrl}/api/auth/verify`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, code }),
		});
		const data = await res.json();
		if (!res.ok) {
			setError(data.error || "Invalid code.");
			return;
		}
		router.push("/hub");
	};

	// Resend verification
	const handleResend = async () => {
		setInfo("");
		await fetch(`${backendUrl}/api/auth/resend`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email }),
		});
		setInfo("Verification email sent");
	};

	//
	const handleForgotSubmit = async () => {
		setError("");
		const res = await fetch(`${backendUrl}/api/auth/forgot-password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email }),
		});
		const data = await res.json();
		if (!res.ok) {
			setError(data.error || "Error sending reset code.");
			return;
		}
		setForgotStep("code");
	};

	const handleForgotCode = async () => {
		setError("");
		const res = await fetch(`${backendUrl}/api/auth/verify-reset-code`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, code }),
		});
		const data = await res.json();
		if (!res.ok) {
			setError(data.error || "Invalid reset code.");
			return;
		}
		setForgotStep("reset");
	};

	const handleResetPassword = async () => {
		setError("");
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		if (!passwordRegex.test(password)) {
			setError("Password must be at least 8 characters and include a number.");
			return;
		}
		const res = await fetch(`${backendUrl}/api/auth/reset-password`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, code, newPassword: password }),
		});
		const data = await res.json();
		if (!res.ok) {
			setError(data.error || "Reset failed.");
			return;
		}
		setInfo("Password reset successful. You can now log in.");
		setModal("login");
	};

	return (
		<>
			{/* Animated Toast */}
			<Suspense fallback={null}>
				<VerifiedToast />
			</Suspense>

			<div className="min-h-screen flex items-center justify-center bg-gray-900  bg-grid p-8">
				<div className="max-w-5xl w-full space-y-12">
					<h1 className="text-6xl text-white">Sink That Ship</h1>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
						<div className="space-y-6">
							<h2 className="text-3xl text-white">Challenge & Conquer in Battleship</h2>
							<p className="text-lg text-gray-300">
								Dive into intense naval combat where strategy meets skill. Engage with foes from around the world,
								deploy your fleet, and outmaneuver opponents in real time.
							</p>
							<ul className="space-y-4">
								{[
									"Real-time multiplayer battles",
									"Customizable fleet formations",
									"Live game chatting",
									"Global leaderboard",
								].map((f) => (
									<li key={f} className="flex items-center text-gray-200">
										<CheckCircle className="mr-2 text-green-400" />
										{f}
									</li>
								))}
							</ul>
							<div className="mt-6 flex space-x-4">
								<button
									onClick={openLogin}
									className="px-6 py-3 border border-white text-white rounded-full hover:bg-white hover:text-gray-900 transition"
								>
									Login
								</button>
								<button
									onClick={openSignup}
									className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
								>
									Sign Up
								</button>
							</div>
						</div>
						<div className="flex justify-center">
							<div className="relative w-96 h-80 md:w-[600px] md:h-[450px]">
								<Image src={shipImage} alt="Battleship" fill className="object-contain" />
							</div>
						</div>
					</div>
				</div>

				<AnimatePresence>
					{(modal === "login" || modal === "signup" || modal === "forgot" || modal === "verify") && (
						<motion.div
							className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
						>
							<motion.div
								className="bg-white rounded-2xl shadow-xl w-11/12 max-w-md p-6 relative text-black"
								initial={{ scale: 0.8, opacity: 0 }}
								animate={{ scale: 1, opacity: 1 }}
								exit={{ scale: 0.8, opacity: 0 }}
								transition={{ type: "spring", stiffness: 300, damping: 25 }}
							>
								<button onClick={closeModal} className="absolute top-4 right-4 p-2">
									<X size={20} />
								</button>

								{/* Login */}
								{modal === "login" && (
									<>
										<h3 className="text-xl mb-4">Login</h3>
										<div className="flex items-center border-b border-gray-300">
											<Mail className="mr-2" />
											<input
												type="email"
												placeholder="Email"
												className="w-full py-2 focus:outline-none"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
											/>
										</div>
										<div className="flex items-center border-b border-gray-300 mt-4">
											<Lock className="mr-2" />
											<input
												type="password"
												placeholder="Password"
												className="w-full py-2 focus:outline-none"
												value={password}
												onChange={(e) => setPassword(e.target.value)}
											/>
										</div>
										<button
											onClick={handleLogin}
											className="w-full mt-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition cursor-pointer"
										>
											Login
										</button>
										<div className="text-sm text-center mt-2">
											<button onClick={openForgot} className="underline cursor-pointer">
												Forgot your password?
											</button>
										</div>
										<div className="text-sm text-center mt-2">
											Don&apos;t have an account?{" "}
											<button onClick={openSignup} className="underline cursor-pointer">
												Sign up here
											</button>
										</div>
										{error && (
											<motion.p
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 10 }}
												className="text-red-500 text-sm mt-2 text-center"
											>
												{error}
											</motion.p>
										)}
										{info && (
											<motion.p
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 10 }}
												className="text-green-500 text-sm mt-2 text-center"
											>
												{info}
											</motion.p>
										)}
									</>
								)}

								{/* Sign Up */}
								{modal === "signup" && (
									<>
										<h3 className="text-xl mb-4">Sign Up</h3>
										<div className="flex items-center border-b border-gray-300">
											<Mail className="mr-2" />
											<input
												type="email"
												placeholder="Email"
												className="w-full py-2 focus:outline-none"
												value={email}
												onChange={(e) => setEmail(e.target.value)}
											/>
										</div>
										<div className="flex items-center border-b border-gray-300 mt-4">
											<User className="mr-2" />
											<input
												type="text"
												placeholder="Username"
												className="w-full py-2 focus:outline-none"
												value={username}
												onChange={(e) => setUsername(e.target.value)}
											/>
										</div>
										<div className="flex items-center border-b border-gray-300 mt-4">
											<Lock className="mr-2" />
											<input
												type="password"
												placeholder="Password"
												className="w-full py-2 focus:outline-none"
												value={password}
												onChange={(e) => setPassword(e.target.value)}
											/>
										</div>
										<p className="text-sm text-gray-500 mt-1">
											Password must be at least 8 characters and include a number.
										</p>
										<div className="flex items-center border-b border-gray-300 mt-4">
											<Lock className="mr-2" />
											<input
												type="password"
												placeholder="Confirm Password"
												className="w-full py-2 focus:outline-none"
												value={confirm}
												onChange={(e) => setConfirm(e.target.value)}
											/>
										</div>
										<button
											onClick={handleSignup}
											className="w-full mt-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition cursor-pointer"
										>
											Sign Up
										</button>
										{error && (
											<motion.p
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 10 }}
												className="text-red-500 text-sm mt-2 text-center"
											>
												{error}
											</motion.p>
										)}
										<div className="text-sm text-center mt-4">
											Already have an account?{" "}
											<button onClick={openLogin} className="underline cursor-pointer">
												Login here
											</button>
										</div>
									</>
								)}

								{/* Forgot Password */}
								{modal === "forgot" && (
									<>
										{forgotStep === "email" && (
											<>
												<h3 className="text-xl mb-4">Forgot Password</h3>
												<div className="flex items-center border-b border-gray-300">
													<Mail className="mr-2" />
													<input
														type="email"
														placeholder="Email"
														className="w-full py-2 focus:outline-none"
														value={email}
														onChange={(e) => setEmail(e.target.value)}
													/>
												</div>
												<button
													onClick={handleForgotSubmit}
													className="w-full mt-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition cursor-pointer"
												>
													Submit
												</button>
												{error && (
													<motion.p
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: 10 }}
														className="text-red-500 text-sm mt-2 text-center"
													>
														{error}
													</motion.p>
												)}
											</>
										)}
										{forgotStep === "code" && (
											<>
												<h3 className="text-xl mb-4">Enter Code</h3>
												<div className="flex items-center	border-b border-gray-300">
													<Lock className="mr-2" />
													<input
														type="text"
														placeholder="Reset Code"
														className="w-full py-2 focus:outline-none"
														value={code}
														onChange={(e) => setCode(e.target.value)}
													/>
												</div>
												<button
													onClick={handleForgotCode}
													className="w-full mt-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition cursor-pointer"
												>
													Submit Code
												</button>
												{error && (
													<motion.p
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: 10 }}
														className="text-red-500 text-sm mt-2 text-center"
													>
														{error}
													</motion.p>
												)}
											</>
										)}
										{forgotStep === "reset" && (
											<>
												<h3 className="text-xl mb-4">Reset Password</h3>
												<div className="flex items-center border-b border-gray-300">
													<Lock className="mr-2" />
													<input
														type="password"
														placeholder="New Password"
														className="w-full py-2 focus:outline-none"
														value={password}
														onChange={(e) => setPassword(e.target.value)}
													/>
												</div>
												<p className="text-sm text-gray-500 mt-1">
													Password must be at least 8 characters and include a number.
												</p>
												<div className="flex items-center	border-b border-gray-300 mt-4">
													<Lock className="mr-2" />
													<input
														type="password"
														placeholder="Confirm Password"
														className="w-full py-2 focus:outline-none"
														value={confirm}
														onChange={(e) => setConfirm(e.target.value)}
													/>
												</div>
												<button
													onClick={handleResetPassword}
													className="w-full mt-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition cursor-pointer"
												>
													Reset Password
												</button>
												{error && (
													<motion.p
														initial={{ opacity: 0, y: 10 }}
														animate={{ opacity: 1, y: 0 }}
														exit={{ opacity: 0, y: 10 }}
														className="text-red-500 text-sm mt-2 text-center"
													>
														{error}
													</motion.p>
												)}
											</>
										)}
									</>
								)}

								{/* Verify Email */}
								{modal === "verify" && (
									<>
										<h3 className="text-xl mb-4">Verify Email</h3>
										<p className="text-sm text-gray-700 mb-4">
											Check your email and spam for a verification link and code.
										</p>
										<div className="flex items-center border-b border-gray-300">
											<Lock className="mr-2" />
											<input
												placeholder="Verification Code"
												className="w-full py-2 focus:outline-none"
												value={code}
												onChange={(e) => setCode(e.target.value)}
											/>
										</div>
										<button
											onClick={handleVerify}
											className="w-full mt-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition"
										>
											Submit Code
										</button>
										<button
											onClick={handleResend}
											className="w-full mt-4 py-2 text-black hover:underline cursor-pointer"
										>
											Resend verification email
										</button>
										{error && (
											<motion.p
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 10 }}
												className="text-red-500 text-sm mt-2 text-center"
											>
												{error}
											</motion.p>
										)}
										{info && (
											<motion.p
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, y: 10 }}
												className="text-green-500 text-sm mt-2 text-center"
											>
												{info}
											</motion.p>
										)}
									</>
								)}
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</>
	);
}
