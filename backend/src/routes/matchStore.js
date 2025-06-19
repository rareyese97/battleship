// backend/src/routes/matchStore.js

const crypto = require("crypto");

const matches = {};
const queue = new Map();

function createMatch(id, player1, player2) {
	matches[id] = {
		id,
		players: {
			[player1.id]: {
				user: { id: player1.id, username: player1.username },
				socket: player1.socket,
				board: null,
			},
			[player2.id]: {
				user: { id: player2.id, username: player2.username },
				socket: player2.socket,
				board: null,
			},
		},
		turn: player1.id,
		status: "active",
	};
}

function broadcastOpponentInfo(match, io) {
	const players = Object.values(match.players);
	if (players.length !== 2) return;

	const [p1, p2] = players;
	p1.socket.emit("opponent_info", { id: p2.user.id, username: p2.user.username });
	p2.socket.emit("opponent_info", { id: p1.user.id, username: p1.user.username });
}

function getMatch(id) {
	return matches[id];
}

function removeMatch(id) {
	delete matches[id];
}

function queuePlayer(userId, username, socket, io) {
	queue.set(userId, { socket, username });
	tryMatch(io);
}

function removeFromQueue(userId) {
	queue.delete(userId);
}

function removeBySocket(socket) {
	// First check active matches
	for (const matchId in matches) {
		const match = matches[matchId];
		for (const playerId in match.players) {
			const player = match.players[playerId];
			if (player.socket.id === socket.id) {
				// Instead of immediately removing match → set a timeout

				console.log(`⚠️ Player ${player.user.username} disconnected — waiting for reconnect...`);

				player.disconnectedAt = Date.now();

				setTimeout(() => {
					// If player still disconnected after timeout, remove match
					const stillMatch = matches[matchId];
					if (!stillMatch) return;

					const stillPlayer = stillMatch.players[playerId];
					if (stillPlayer.socket.id === socket.id && stillPlayer.disconnectedAt) {
						console.log(`❌ Player ${player.user.username} did not reconnect — ending match ${matchId}`);

						// Notify opponent
						const opponent = Object.values(match.players).find((p) => p.user.id !== player.user.id);
						if (opponent?.socket) {
							opponent.socket.emit("game_over", { winner: null, reason: "disconnect" });
						}

						// Remove match
						delete matches[matchId];
					}
				}, 5000);

				return;
			}
		}
	}

	// Else, remove from queue
	for (let [userId, { socket: s }] of queue.entries()) {
		if (s.id === socket.id) {
			queue.delete(userId);
			console.log(`❌ Removed player ${userId} from queue due to disconnect`);
			return;
		}
	}
}


	// Else, remove from queue
	for (let [userId, { socket: s }] of queue.entries()) {
		if (s.id === socket.id) {
			queue.delete(userId);
			console.log(`❌ Removed player ${userId} from queue due to disconnect`);
			return;
		}
	}
}

function tryMatch(io) {
	if (queue.size < 2) return;

	const [id1, { socket: sock1, username: name1 }] = queue.entries().next().value;
	queue.delete(id1);

	const [id2, { socket: sock2, username: name2 }] = queue.entries().next().value;
	queue.delete(id2);

	const matchId = crypto.randomUUID();

	createMatch(matchId, { id: id1, username: name1, socket: sock1 }, { id: id2, username: name2, socket: sock2 });

	sock1.emit("match_found", { matchId, opponentId: id2 });
	sock2.emit("match_found", { matchId, opponentId: id1 });
}

module.exports = {
	matches,
	createMatch,
	getMatch,
	removeMatch,
	queuePlayer,
	removeFromQueue,
	removeBySocket,
	broadcastOpponentInfo,
};
