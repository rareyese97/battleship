const { Server } = require("socket.io");
const matchStore = require("./routes/matchStore");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const allowedOrigins = [
	"http://localhost:3000",
	"https://sinkthatship.com",
	"https://www.sinkthatship.com",
	"https://api.sinkthatship.com",
];

function initSocket(server) {
	const io = new Server(server, {
		cors: {
			origin: allowedOrigins,
			credentials: true,
		},
		path: "/socket.io", // Required for correct proxying (Render/Vercel/Nginx)
	});

	async function recordMatchResult(winnerId, loserId) {
		try {
			await prisma.user.update({
				where: { id: winnerId },
				data: { wins: { increment: 1 } },
			});
			await prisma.user.update({
				where: { id: loserId },
				data: { losses: { increment: 1 } },
			});
		} catch (err) {
			console.error("Failed to record match result:", err);
		}
	}

	io.on("connection", (socket) => {
		console.log("🔌 New client connected:", socket.id);

		const userId = parseInt(socket.handshake.query.userId, 10);
		if (!userId) {
			console.warn("No userId in socket handshake, disconnecting.");
			return socket.disconnect();
		}

		socket.on("find_match", ({ userId, username }) => {
			if (!userId || !username) {
				console.warn("find_match missing userId or username");
				return;
			}
			matchStore.queuePlayer(userId, username, socket, io);
		});

		socket.on("cancel_match", ({ userId }) => {
			if (!userId) return console.warn("cancel_match missing userId");
			matchStore.removeFromQueue(userId);
		});

		socket.on("join_match", ({ matchId, userId, board }) => {
			userId = parseInt(userId, 10);
			if (!userId || !matchId || !board) return console.warn("join_match missing data");

			const match = matchStore.getMatch(matchId);
			if (!match || !match.players[userId]) return;

			match.players[userId].socket = socket;
			match.players[userId].board = board;

			const players = Object.values(match.players);
			if (players.length === 2 && players[0].socket && players[1].socket && players[0].board && players[1].board) {
				const [p1, p2] = players;
				p1.socket.emit("opponent_info", { id: p2.user.id, username: p2.user.username });
				p2.socket.emit("opponent_info", { id: p1.user.id, username: p1.user.username });

				p1.socket.emit("start_game", { yourTurn: match.turn === p1.user.id });
				p2.socket.emit("start_game", { yourTurn: match.turn === p2.user.id });
			}
		});

		socket.on("place_ships", ({ matchId, userId, board }) => {
			userId = parseInt(userId, 10);
			const match = matchStore.getMatch(matchId);
			if (!match || !match.players[userId]) return;
			match.players[userId].board = board;
		});

		socket.on("leave_match", ({ matchId, userId }) => {
			userId = parseInt(userId, 10);
			if (!userId || !matchId) {
				console.warn(`leave_match missing userId or matchId`);
				return;
			}

			const match = matchStore.getMatch(matchId);
			if (match) {
				const opponentEntry = Object.values(match.players).find((p) => p.user.id !== userId);
				const quitterEntry = match.players[userId];

				if (opponentEntry?.socket) {
					opponentEntry.socket.emit("game_over", { winner: null, reason: "disconnect" });
				}

				if (quitterEntry?.user?.id) {
					prisma.user
						.update({
							where: { id: quitterEntry.user.id },
							data: { losses: { increment: 1 } },
						})
						.catch(console.error);
				}

				matchStore.removeMatch(matchId);
			}
		});

		socket.on("bomb", ({ matchId, row, col }) => {
			const match = matchStore.getMatch(matchId);
			if (!match || match.status !== "active") return;

			const attackerEntry = Object.values(match.players).find((p) => p.socket.id === socket.id);
			const defenderEntry = Object.values(match.players).find((p) => p.socket.id !== socket.id);

			if (!attackerEntry || !defenderEntry || match.turn !== attackerEntry.user.id) return;

			const attackerId = attackerEntry.user.id;
			const defenderId = defenderEntry.user.id;
			const defenderBoard = match.players[defenderId].board;
			const cell = defenderBoard[row]?.[col];

			const hit = cell?.status === "ship";
			if (cell) {
				cell.status = hit ? "hit" : "miss";
			}

			let sunk = false;
			let shipId = null;
			let sunkShipCells = [];

			if (hit && cell.shipId !== undefined) {
				shipId = cell.shipId;
				const shipCells = defenderBoard.flat().filter((c) => c.shipId === shipId);
				sunk = shipCells.length > 0 && shipCells.every((c) => c.status === "hit");

				if (sunk) {
					sunkShipCells = [];
					for (let r = 0; r < defenderBoard.length; r++) {
						for (let c = 0; c < defenderBoard[r].length; c++) {
							if (defenderBoard[r][c].shipId === shipId) {
								sunkShipCells.push({ row: r, col: c });
							}
						}
					}
				}
			}

			attackerEntry.socket.emit("bomb_result", {
				row,
				col,
				hit,
				yourSide: "enemy",
				shipId,
				sunk,
				sunkShipCells: sunk ? sunkShipCells : [],
			});
			defenderEntry.socket.emit("bomb_result", {
				row,
				col,
				hit,
				yourSide: "own",
				shipId,
				sunk,
				sunkShipCells: sunk ? sunkShipCells : [],
			});

			const allSunk = defenderBoard.flat().every((cell) => cell.status !== "ship");
			if (allSunk) {
				const winnerName = attackerEntry.user.username;
				attackerEntry.socket.emit("game_over", { winner: winnerName });
				defenderEntry.socket.emit("game_over", { winner: winnerName });
				recordMatchResult(attackerId, defenderId).catch(console.error);
				matchStore.removeMatch(matchId);
			} else if (!hit) {
				match.turn = defenderId;
				defenderEntry.socket.emit("your_turn");
			}
		});

		socket.on("chat_message", (msg) => {
			io.emit("chat_message", msg);
		});

		// socket.on("disconnect", () => {
		// 	matchStore.removeBySocket(socket);
		// });
	});

	console.log("✅ Socket.IO initialized");
	return io;
}

module.exports = { initSocket };
