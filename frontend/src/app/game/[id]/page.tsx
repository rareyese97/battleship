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
	yourSide: "own" | "enemy";
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
	const [gameSocket, setGameSocket] = useState<Socket | null>(null);
	const [opponent, setOpponent] = useState<any>(null);
	const [yourBoard, setYourBoard] = useState<BoardState>(createEmptyBoard());
	const [enemyBoard, setEnemyBoard] = useState<BoardState>(createEmptyBoard());
	const [isYourTurn, setIsYourTurn] = useState(false);
	const [gameOver, setGameOver] = useState(false);
	const [result, setResult] = useState<"win" | "lose" | "disconnect" | null>(null);
	const [toastMsg, setToastMsg] = useState<string | null>(null);
	const [sunkEffects, setSunkEffects] = useState<Record<"own" | "enemy", { id: number; cells: { row: number; col: number }[] } | null>>({ own: null, enemy: null });

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
		});

		socketRef.current = socket;
		setGameSocket(socket);

		socket.on("connect", () => {
			socket.emit("join_match", { matchId, board: yourBoard });
		});

		socket.on("opponent_info", (o: any) => {
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
			if (sunk && sunkShipCells.length > 0) {
				setSunkEffects((prev) => ({ ...prev, [yourSide]: { id: Date.now(), cells: sunkShipCells } }));
			}

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
								status: "hit",
								revealed: true,
								shipId: shipId !== undefined ? shipId : newCell.shipId,
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

		return () => {
			if (socketRef.current) {
				socketRef.current.emit("leave_match", { matchId });
				socketRef.current.disconnect();
				socketRef.current = null;
			}
			setGameSocket(null);
		};
	}, [user, matchId]);

	const clickEnemyCell = (r: number, c: number) => {
		if (!isYourTurn || gameOver) return;
		if (enemyBoard[r][c]?.revealed) return;
		socketRef.current?.emit("bomb", { matchId, row: r, col: c });
	};

	const handleExit = () => {
		socketRef.current?.emit("leave_match", { matchId });
		router.push("/hub");
	};

	const showToast = (msg: string) => {
		setToastMsg(msg);
		setTimeout(() => setToastMsg(null), 3000);
	};

	const renderBoard = (board: BoardState, clickable: boolean) => {
		const side = clickable ? "enemy" : "own";
		const effect = sunkEffects[side];
		let impactStyle: React.CSSProperties | undefined;
		if (effect?.cells.length) {
			const rows = effect.cells.map((cell) => cell.row);
			const cols = effect.cells.map((cell) => cell.col);
			const centerRow = (Math.min(...rows) + Math.max(...rows)) / 2;
			const centerCol = (Math.min(...cols) + Math.max(...cols)) / 2;
			impactStyle = {
				left: `${((centerCol + 1.5) / 11) * 100}%`,
				top: `${((centerRow + 1.5) / 11) * 100}%`,
				"--ship-length": effect.cells.length,
			} as React.CSSProperties;
		}

		return (
			<div className="relative mx-auto w-full max-w-[min(92vw,360px)] overflow-visible">
				<table className="w-full table-fixed border-collapse mx-auto">
					<thead>
						<tr>
							<th></th>
							{Array.from({ length: 10 }, (_, i) => (
								<th key={i} className="px-0 text-[10px] sm:text-xs text-gray-400">
									{String.fromCharCode(65 + i)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{board.map((row, ri) => (
							<tr key={ri}>
								<td className="w-6 px-0 text-center text-[10px] sm:text-xs text-gray-400">{ri + 1}</td>
								{row.map((cell, ci) => {
									const isVisible = cell.revealed || cell.sunk || !clickable;
									const cellClasses = cell.sunk
										? "aspect-square relative sunk-cell cursor-default"
										: "aspect-square border border-white/30 relative water-effect " +
										  (cell.status === "hit"
											? "bg-red-600"
											: cell.status === "miss"
												? "bg-white"
												: cell.status === "ship" && isVisible
													? (clickable ? "bg-blue-500" : "bg-emerald-500")
													: clickable ? "bg-blue-950/70" : "bg-emerald-950/70") +
										  (clickable ? " cursor-pointer" : " cursor-default");

									return (
										<td key={ci} className={cellClasses} onClick={() => clickable && clickEnemyCell(ri, ci)} />
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
				{effect && impactStyle && (
					<div key={effect.id} className="sunk-impact" style={impactStyle} aria-live="polite">
						<span className="sunk-impact-ring" />
						<span className="sunk-label">SHIP SUNK!</span>
					</div>
				)}
			</div>
		);
	};

	if (!user) return null;

	return (
		<div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-900 bg-grid px-2 py-5 sm:p-8 text-white">
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

			<div className="grid w-full max-w-4xl grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 mb-6 px-1">
				<div>
					<h3 className="mb-2 text-center text-lg font-medium text-sky-300">Enemy Waters</h3>
					<div className="w-full rounded-lg border border-sky-400/30 relative bg-sky-950/40 p-1 sm:p-2">
						{renderBoard(enemyBoard, true)}
					</div>
				</div>
				<div>
					<h3 className="mb-2 text-center text-lg font-medium text-emerald-300">Your Fleet</h3>
					<div className="w-full rounded-lg border border-emerald-400/30 relative bg-emerald-950/40 p-1 sm:p-2">
						{renderBoard(yourBoard, false)}
					</div>
				</div>
			</div>

			<div className="text-center mt-4 pb-24">
				<button onClick={handleExit} className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 cursor-pointer">
					Exit Match
				</button>
			</div>

			{user && <ChatBubble socket={gameSocket} user={user} matchId={String(matchId)} />}
		</div>
	);
}
