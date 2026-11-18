import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (): Socket => {
	if (!socket) {
		socket = io("https://api.sinkthatship.com", {
			withCredentials: true,
			transports: ["polling", "websocket"],
		});
	}
	return socket;
};

export const getSocket = (): Socket => {
	if (!socket) {
		throw new Error("Socket not initialized. Call initSocket() first.");
	}
	return socket;
};
