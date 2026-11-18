"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Socket } from "socket.io-client";

interface ChatBubbleProps {
	socket: Socket | null;
	user: { id: number; username: string };
	matchId: string;
}

export default function ChatBubble({ socket, user, matchId }: ChatBubbleProps) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<string[]>([]);
	const [newMessage, setNewMessage] = useState("");
	const [hasUnread, setHasUnread] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	function sendMessage() {
		const message = newMessage.trim();
		if (!message || !socket?.connected) return;
		socket.emit("chat_message", { matchId, message });
		setNewMessage("");
		setHasUnread(false);
	}

	useEffect(() => {
		if (!socket) return;
		const listener = (msg: string) => {
			const sender = msg.split(": ")[0];
			setMessages((prev) => [...prev, msg]);
			if (sender !== user.username && !open) setHasUnread(true);
		};
		socket.on("chat_message", listener);
		return () => {
			socket.off("chat_message", listener);
		};
	}, [socket, open, user.username]);

	useEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [messages, open]);

	if (!user || !socket) return null;

	return (
		<div className="fixed bottom-6 left-4 sm:left-[calc(50%+112px)] z-50">
			<motion.div
				className="relative overflow-hidden bg-white shadow-xl"
				initial={false}
				animate={{
					width: open ? "min(85vw, 360px)" : 48,
					height: open ? "min(35vh, 320px)" : 48,
					borderRadius: open ? 18 : 999,
				}}
				transition={{ type: "spring", stiffness: 240, damping: 30, mass: 0.85 }}
			>
				<AnimatePresence>
					{open ? (
						<motion.div
							key="chat-panel"
							className="flex h-full w-full flex-col p-3 pt-12"
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0, transition: { delay: 0.12, duration: 0.2 } }}
							exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
						>
							<button
								onClick={() => setOpen(false)}
								aria-label="Close chat"
								className="absolute right-2 top-2 z-10 rounded-full bg-gray-800 p-2 text-white transition-colors hover:bg-gray-700"
							>
								<X size={18} />
							</button>

							<div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 text-sm">
								{messages.length === 0 && (
									<p className="py-3 text-center text-xs text-gray-500">No messages yet. Say hello!</p>
								)}
								{messages.map((msg, idx) => {
									const [username, ...rest] = msg.split(": ");
									const isOwnMessage = username === user.username;
									return (
										<div key={idx} className="break-words rounded-md bg-gray-100 p-2 text-gray-800">
											<span className={isOwnMessage ? "font-bold" : "font-medium"}>{username}</span>:{" "}
											{rest.join(": ")}
										</div>
									);
								})}
							</div>

							<motion.div
								className="mt-3 flex shrink-0 items-center"
								initial={{ opacity: 0, y: 8 }}
								animate={{ opacity: 1, y: 0, transition: { delay: 0.18, duration: 0.2 } }}
							>
								<input
									type="text"
									value={newMessage}
									onChange={(e) => setNewMessage(e.target.value)}
									placeholder="Type a message..."
									maxLength={500}
									className="min-w-0 flex-1 rounded-l-md border border-gray-300 px-3 py-2 text-sm text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
									onKeyDown={(e) => e.key === "Enter" && sendMessage()}
								/>
								<button
									onClick={sendMessage}
									disabled={!socket.connected || !newMessage.trim()}
									aria-label="Send message"
									className="flex h-[38px] items-center justify-center rounded-r-md bg-gray-800 px-3 text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Send size={16} />
								</button>
							</motion.div>
						</motion.div>
					) : (
						<motion.button
							key="chat-toggle"
							onClick={() => {
								setOpen(true);
								setHasUnread(false);
							}}
							aria-label="Open chat"
							className="flex h-full w-full items-center justify-center"
							initial={{ opacity: 0, scale: 0.85 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.85 }}
							transition={{ duration: 0.16 }}
						>
							<span className="relative flex items-center justify-center rounded-full bg-gray-800 p-3 text-white transition-colors hover:bg-gray-700">
								<MessageCircle size={20} />
								{hasUnread && (
									<span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
								)}
							</span>
						</motion.button>
					)}
				</AnimatePresence>
			</motion.div>
		</div>
	);
}
