// lib/sockets.ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (userId: number): Socket => {
	if (!socket) {
		socket = io(process.env.NEXT_PUBLIC_BACKEND_URL!, {
			withCredentials: true,
			transports: ["websocket"],
			query: { userId },
		});
	}
	return socket;
};

export const getSocket = (): Socket => {
	if (!socket) {
		throw new Error("Socket not initialized. Call initSocket(userId) first.");
	}
	return socket;
};
