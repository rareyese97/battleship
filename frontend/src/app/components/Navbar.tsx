"use client";

import React, { useState, FormEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu as MenuIcon, X as XIcon, LogOut, Lock, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function Navbar() {
	const [open, setOpen] = useState(false);
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteError, setDeleteError] = useState("");
	const router = useRouter();
	const pathname = usePathname();
	const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

	// Hide navbar on landing page
	if (pathname === "/") return null;

	const handleSignOut = async () => {
		await fetch(`${backendUrl}/api/auth/logout`, {
			method: "POST",
			credentials: "include",
		});
		router.push("/");
	};

	const openDeleteModal = () => {
		setDeleteError("");
		setDeletePassword("");
		setDeleteModalOpen(true);
		setOpen(false);
	};

	const closeDeleteModal = () => {
		setDeleteModalOpen(false);
	};

	const handleDeleteAccount = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setDeleteError("");
		try {
			const res = await fetch(`${backendUrl}/api/auth/delete-account`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ password: deletePassword }),
			});
			const data = await res.json();
			if (!res.ok) {
				setDeleteError(data.error || "Incorrect password.");
				return;
			}
			router.push("/");
		} catch {
			setDeleteError("Network error. Please try again.");
		}
	};

	return (
		<>
			<div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
				<motion.div
					className={
						`bg-white shadow-lg overflow-hidden relative transform origin-bottom transition-all duration-300 ease-in-out ` +
						(open ? "w-52 h-44 sm:w-60 sm:h-48 rounded-2xl" : "w-30 h-12 rounded-full")
					}
				>
					{/* Close button */}
					<AnimatePresence>
						{open && (
							<motion.button
								key="close"
								onClick={() => setOpen(false)}
								className="absolute top-3 right-3 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors duration-200"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1, transition: { delay: 0.1 } }}
								exit={{ opacity: 0 }}
							>
								<XIcon size={20} />
							</motion.button>
						)}
					</AnimatePresence>

					{/* Menu content */}
					<div className="w-full h-full flex items-center justify-center px-4">
						<AnimatePresence mode="wait">
							{open ? (
								<motion.nav
									key="menu"
									className="flex flex-col space-y-4 text-gray-800 text-lg pt-6"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1, transition: { delay: 0.2 } }}
									exit={{ opacity: 0 }}
								>
									<button
										onClick={handleSignOut}
										className="flex items-center gap-2 hover:text-gray-600 cursor-pointer"
									>
										<LogOut size={20} />
										Sign Out
									</button>
									<button
										onClick={openDeleteModal}
										className="flex items-center gap-2 hover:text-gray-600 cursor-pointer"
									>
										<Trash2 size={20} />
										Delete Account
									</button>
								</motion.nav>
							) : (
								<motion.button
									key="button"
									onClick={() => setOpen(true)}
									className="flex items-center focus:outline-none p-4"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
								>
									<span className="text-gray-800 mr-2">Menu</span>
									<div className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors duration-200">
										<MenuIcon size={20} />
									</div>
								</motion.button>
							)}
						</AnimatePresence>
					</div>
				</motion.div>
			</div>

			{/* Delete Account Modal */}
			{deleteModalOpen && (
				<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
					<div className="bg-white rounded-2xl shadow-xl w-72 p-6 relative text-black">
						<button onClick={closeDeleteModal} className="absolute top-3 right-3 p-2">
							<XIcon size={20} />
						</button>
						<h3 className="text-xl mb-4">Delete Account</h3>
						<form onSubmit={handleDeleteAccount}>
							<div className="flex items-center border-b border-gray-300">
								<Lock className="mr-2" />
								<input
									type="password"
									placeholder="Password"
									className="w-full py-2 focus:outline-none"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
								/>
							</div>
							{deleteError && <p className="text-red-500 text-sm mt-2">{deleteError}</p>}
							<button
								type="submit"
								className="w-full mt-6 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition"
							>
								Delete Account
							</button>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
