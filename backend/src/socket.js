const { Server } = require("socket.io");
const matchStore = require("./routes/matchStore");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

let io;

function initSocket(server) {
	io = new Server(server, {
		cors: {
			origin: "http://localhost:3000",
			methods: ["GET", "POST"],
			credentials: true,
		},
	});

	async function recordMatchResult(winnerId, loserId) {
		try {
			"🛠 Updating winner:", winnerId;
			await prisma.user.update({
				where: { id: winnerId },
				data: { wins: { increment: 1 } },
			});
			"🛠 Updating loser:", loserId;
			await prisma.user.update({
				where: { id: loserId },
				data: { losses: { increment: 1 } },
			});
			`🏆 Match result: ${winnerId} +1 win, ${loserId} +1 loss`;
		} catch (err) {
			console.error("Failed to record match result:", err);
		}
	}

	io.on("connection", (socket) => {
		"🔌 New client connected:", socket.id;

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
			"📡 Received find_match from", userId;
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

			const attackerId = parseInt(Object.keys(match.players).find((id) => match.players[id].socket.id === socket.id));
			const defenderId = parseInt(Object.keys(match.players).find((id) => parseInt(id) !== attackerId));

			if (!attackerId || !defenderId || match.turn !== attackerId) return;

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
					// Get all coordinates of the sunk ship
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

			// Send bomb result with sunk ship coordinates
			match.players[attackerId].socket.emit("bomb_result", {
				row,
				col,
				hit,
				yourSide: "enemy",
				shipId,
				sunk,
				sunkShipCells: sunk ? sunkShipCells : [],
			});
			match.players[defenderId].socket.emit("bomb_result", {
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
				const winnerName = match.players[attackerId].user.username;
				match.players[attackerId].socket.emit("game_over", { winner: winnerName });
				match.players[defenderId].socket.emit("game_over", { winner: winnerName });
				recordMatchResult(attackerId, defenderId).catch(console.error);
				matchStore.removeMatch(matchId);
			} else if (!hit) {
				match.turn = defenderId;
				match.players[defenderId].socket.emit("your_turn");
			}
		});

		socket.on("chat_message", (msg) => {
			io.emit("chat_message", msg);
		});

		socket.on("disconnect", () => {
			matchStore.removeBySocket(socket);
		});
	});

	return io;
}

module.exports = { initSocket };
