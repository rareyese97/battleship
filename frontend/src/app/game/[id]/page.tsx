"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ChatBubble from "../../components/ChatBubble";
import "../../hub/water.css";
import "../../globals.css";
import { io, Socket } from "socket.io-client";

interface CellState {
	status: "empty" | "miss" | "hit" | "ship";
	revealed?: boolean;
	shipId?: number;
	sunk?: boolean;
}
type BoardState = CellState[][];

interface ShipPlacement {
	row: number;
	col: number;
	size: number;
	direction: "horizontal" | "vertical";
}

interface BombResultPayload {
	row: number;
	col: number;
	hit: boolean;
	yourSide: "your" | "enemy";
	shipId?: number;
	sunk?: boolean;
}

const createEmptyBoard = (): BoardState =>
	Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => ({ status: "empty", revealed: false })));

export default function GamePage() {
	const { id: matchId } = useParams();
	const router = useRouter();
	const socketRef = useRef<Socket | null>(null);
	const [user, setUser] = useState<any>(null);
	const [opponent, setOpponent] = useState<any>(null);
	const [yourBoard, setYourBoard] = useState<BoardState>(createEmptyBoard());
	const [enemyBoard, setEnemyBoard] = useState<BoardState>(createEmptyBoard());
	const [isYourTurn, setIsYourTurn] = useState(false);
	const [gameOver, setGameOver] = useState(false);
	const [result, setResult] = useState<"win" | "lose" | "disconnect" | null>(null);
	const [toastMsg, setToastMsg] = useState<string | null>(null);

	const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

	useEffect(() => {
		fetch(`${backendUrl}/api/session`, { credentials: "include" })
			.then((r) => r.json())
			.then((data) => {
				if (!data.user) return router.push("/");
				setUser(data.user);

				const savedFleet = localStorage.getItem("fleet");
				if (savedFleet) {
					const fleet: ShipPlacement[] = JSON.parse(savedFleet);
					const board = createEmptyBoard();
					for (let s = 0; s < fleet.length; s++) {
						const ship = fleet[s];
						for (let i = 0; i < ship.size; i++) {
							const r = ship.row + (ship.direction === "vertical" ? i : 0);
							const c = ship.col + (ship.direction === "horizontal" ? i : 0);
							board[r][c] = { status: "ship", revealed: true, shipId: s };
						}
					}
					setYourBoard(board);
				}
			});
	}, [router]);

	useEffect(() => {
		if (!user || !matchId) return;

		const socket = io("https://api.sinkthatship.com", {
			withCredentials: true,
			transports: ["websocket"],
			query: { userId: user.id },
		});

		socketRef.current = socket;

		socket.on("connect", () => {
			console.log("🟢 Socket connected:", socket.id);
			socket.emit("join_match", { matchId, userId: user.id, board: yourBoard });
		});

		socket.on("opponent_info", (o: any) => {
			console.log("🟢 Opponent info received:", o);
			setOpponent(o);
		});

		socket.on("disconnect", () => {
			showToast("Disconnected from match.");
			setGameOver(true);
			setResult("disconnect");
		});

		socket.on("start_game", ({ yourTurn }: { yourTurn: boolean }) => {
			setIsYourTurn(yourTurn);
			showToast((yourTurn ? "Your" : "Opponent's") + " turn!");
		});

		socket.on("your_turn", () => {
			setIsYourTurn(true);
			showToast("Your turn!");
		});

		socket.on("bomb_result", (payload: BombResultPayload & { sunkShipCells?: { row: number; col: number }[] }) => {
			const { row, col, hit, yourSide, shipId, sunk, sunkShipCells = [] } = payload;

			const updateBoard = (board: BoardState) =>
				board.map((rArr, i) =>
					rArr.map((c, j) => {
						let newCell = c;

						// Update this bombed cell
						if (i === row && j === col) {
							newCell = {
								...c,
								status: hit ? "hit" : "miss",
								revealed: true,
								shipId: shipId !== undefined ? shipId : c.shipId,
								sunk: sunk ?? c.sunk,
							};
						}

						// If ship is sunk — update ALL its cells
						if (sunk && sunkShipCells.some((pos) => pos.row === i && pos.col === j)) {
							newCell = {
								...newCell,
								sunk: true,
								status: "hit", // ensure sunk cells stay red
								revealed: true,
							};
						}

						return newCell;
					})
				);

			if (yourSide === "enemy") {
				setEnemyBoard((prev) => updateBoard(prev));
				if (!hit) setIsYourTurn(false);
			} else {
				setYourBoard((prev) => updateBoard(prev));
			}
		});

		socket.on("game_over", ({ winner, reason }) => {
			setGameOver(true);
			if (reason === "disconnect") {
				setResult("disconnect");
				showToast("Opponent disconnected — match ended.");
			} else {
				const outcome = winner === user.username ? "win" : "lose";
				setResult(outcome);
				showToast(outcome === "win" ? "You win!" : "You lose.");
			}
		});

		// Place ships right after join
		socket.emit("place_ships", { matchId, userId: user.id, board: yourBoard });

		return () => {
			if (socketRef.current) {
				socketRef.current.emit("leave_match", { matchId, userId: user.id });
				socketRef.current.disconnect();
			}
		};
	}, [user, matchId]);

	const clickEnemyCell = (r: number, c: number) => {
		if (!isYourTurn || gameOver) return;
		if (enemyBoard[r][c]?.revealed) return;
		socketRef.current?.emit("bomb", { matchId, row: r, col: c });
	};

	const handleExit = () => {
		socketRef.current?.emit("leave_match", { matchId, userId: user.id });
		router.push("/hub");
	};

	const showToast = (msg: string) => {
		setToastMsg(msg);
		setTimeout(() => setToastMsg(null), 3000);
	};

	const renderBoard = (board: BoardState, clickable: boolean) => (
		<table className="border-collapse mx-auto">
			<thead>
				<tr>
					<th></th>
					{Array.from({ length: 10 }, (_, i) => (
						<th key={i} className="px-2 text-sm text-gray-400">
							{String.fromCharCode(65 + i)}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{board.map((row, ri) => (
					<tr key={ri}>
						<td className="px-2 text-gray-400 text-sm">{ri + 1}</td>
						{row.map((cell, ci) => {
							const isVisible = cell.revealed || cell.sunk || !clickable;
							const cellClasses = cell.sunk
								? "bg-red-600 animate-strong-pulse transition duration-150"
								: cell.status === "hit"
								? "bg-red-600"
								: cell.status === "miss"
								? "bg-white"
								: cell.status === "ship" && isVisible
								? "bg-blue-500"
								: "bg-transparent";
							return (
								<td
									key={ci}
									className={`w-8 h-8 border border-white/30 relative water-effect ${cellClasses} ${
										clickable ? "cursor-pointer" : "cursor-default"
									}`}
									onClick={() => clickable && clickEnemyCell(ri, ci)}
								>
									{cell.sunk && <div className="sunk-label">SUNK!</div>}
								</td>
							);
						})}
					</tr>
				))}
			</tbody>
		</table>
	);

	if (!user) return null;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 bg-grid p-8 text-white">
			<AnimatePresence>
				{toastMsg && (
					<motion.div
						key="toast"
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -20 }}
						transition={{ duration: 0.3 }}
						className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
					>
						{toastMsg}
					</motion.div>
				)}
			</AnimatePresence>

			<div className="text-center text-2xl font-semibold mb-6">
				{user.username} vs {opponent?.username ? opponent.username : "..."}
			</div>
			<div className="text-center text-sm text-gray-400">
				{gameOver ? "Game over" : isYourTurn ? "Your turn" : "Opponent's turn..."}
			</div>

			{gameOver && result && (
				<div className="text-center text-xl p-4 rounded bg-gray-800">
					{result === "disconnect"
						? "Opponent disconnected — match ended."
						: result === "win"
						? "🎉 You win!"
						: "💥 You lose :("}
				</div>
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-6">
				<div>
					<h3 className="mb-2 text-lg font-medium">Enemy Waters</h3>
					<div className="overflow-auto rounded-lg border border-white/10 relative bg-gray-800">
						{renderBoard(enemyBoard, true)}
					</div>
				</div>
				<div>
					<h3 className="mb-2 text-lg font-medium">Your Fleet</h3>
					<div className="overflow-auto rounded-lg border border-white/10 relative bg-gray-800">
						{renderBoard(yourBoard, false)}
					</div>
				</div>
			</div>

			<div className="text-center mt-4">
				<button onClick={handleExit} className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 cursor-pointer">
					Exit Match
				</button>
			</div>
			<br />
			<br />

			{user && <ChatBubble socket={socketRef.current} user={user} />}
		</div>
	);
}
