"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Socket } from "socket.io-client";

interface ChatBubbleProps {
	socket: Socket | null;
	user: { id: number; username: string };
}

export default function ChatBubble({ socket, user }: ChatBubbleProps) {
	const [open, setOpen] = useState(false);
	const [messages, setMessages] = useState<string[]>([]);
	const [newMessage, setNewMessage] = useState("");
	const [hasUnread, setHasUnread] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	function sendMessage() {
		if (newMessage.trim() === "") return;
		const msg = `${user.username}: ${newMessage}`;
		socket?.emit("chat_message", msg);
		setNewMessage("");
		setHasUnread(false);
	}

	useEffect(() => {
		if (!socket) return;
		const listener = (msg: string) => {
			const sender = msg.split(": ")[0];
			setMessages((prev) => [...prev, msg]);
			if (sender !== user.username && !open) {
				setHasUnread(true);
			}
		};
		socket.on("chat_message", listener);
		return () => socket.off("chat_message", listener);
	}, [socket, open, user.username]);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, open]);

	if (!user || !socket) return null;

	return (
		<div className="fixed bottom-6 left-6 sm:left-[calc(50%+112px)] z-50 flex gap-2 sm:gap-4">
			<motion.div
				className={
					"bg-white shadow-lg overflow-hidden relative transform origin-bottom transition-all duration-300 ease-in-out " +
					(open ? "w-[85vw] sm:w-[24vw] h-[35vh] rounded-2xl" : "w-[44px] sm:w-30 h-12 rounded-full")
				}
			>
				<AnimatePresence>
					{open && (
						<motion.button
							key="close"
							onClick={() => setOpen(false)}
							className="absolute top-2 right-2 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors duration-200 z-50"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							<X size={20} />
						</motion.button>
					)}
				</AnimatePresence>

				<div className="w-full h-full flex items-center justify-center px-4">
					<AnimatePresence mode="wait">
						{open ? (
							<motion.div
								key="chat"
								className="w-full h-full flex flex-col pt-6"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
							>
								<div ref={scrollRef} className="flex-1 overflow-y-auto text-sm space-y-2 pr-1">
									{messages.map((msg, idx) => {
										const [username, ...rest] = msg.split(": ");
										const isOwnMessage = username === user.username;
										return (
											<div key={idx} className="bg-gray-200 rounded-md p-2 text-gray-800">
												<span className={isOwnMessage ? "font-bold" : "font-normal"}>{username}</span>:{" "}
												{rest.join(": ")}
											</div>
										);
									})}
								</div>
								<div className="flex items-center justify-center mt-2">
									<input
										type="text"
										value={newMessage}
										onChange={(e) => setNewMessage(e.target.value)}
										placeholder="Type a message..."
										className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-l-md text-black placeholder-gray-500 focus:outline-none"
										onKeyDown={(e) => e.key === "Enter" && sendMessage()}
									/>
									<button
										onClick={sendMessage}
										className="h-[38px] px-3 bg-gray-800 text-white rounded-r-md hover:bg-gray-700 flex items-center justify-center"
									>
										{" "}
										<Send size={16} />
									</button>
								</div>
							</motion.div>
						) : (
							<motion.button
								key="open"
								onClick={() => {
									setOpen(true);
									setHasUnread(false);
								}}
								className="w-full h-full flex items-center justify-center"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
							>
								<div className="flex items-center justify-center gap-2 text-gray-800 relative">
									<span className="hidden sm:inline">Chat</span>
									<div className="p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors duration-200">
										<MessageCircle size={20} />
									</div>
									{hasUnread && (
										<span className="absolute -top-1 right-0 w-2.5 h-2.5">
											<span className="absolute top-0 right-0 w-full h-full rounded-full bg-red-500 opacity-75 animate-ping"></span>
										</span>
									)}
								</div>
							</motion.button>
						)}
					</AnimatePresence>
				</div>
			</motion.div>
		</div>
	);
}
