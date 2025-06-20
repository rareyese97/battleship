// src/app/hub/page.tsx
"use client";

import React, { useState, useEffect, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import "./water.css";
import { getSocket, initSocket } from "../lib/sockets";
import {
	DndContext,
	DragEndEvent,
	DragOverEvent,
	DragOverlay,
	useDroppable,
	useSensor,
	useSensors,
	PointerSensor,
	TouchSensor,
	pointerWithin,
} from "@dnd-kit/core";
import DraggableShip from "./DraggableShip";

interface User {
	id: number;
	username: string;
}
interface LeaderboardEntry {
	id: number;
	username: string;
	wins: number;
	losses: number;
}
interface ShipPlacement {
	row: number;
	col: number;
	size: number;
	direction: "horizontal" | "vertical";
}

const CELL = 32;

export default function HubPage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [fleet, setFleet] = useState<ShipPlacement[]>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("fleet");
			if (saved) return JSON.parse(saved);
		}
		return [
			{ row: 0, col: 0, size: 5, direction: "horizontal" },
			{ row: 2, col: 0, size: 4, direction: "horizontal" },
			{ row: 4, col: 0, size: 3, direction: "horizontal" },
			{ row: 6, col: 0, size: 3, direction: "horizontal" },
			{ row: 8, col: 0, size: 2, direction: "horizontal" },
		];
	});
	const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
	const [searching, setSearching] = useState(false);
	const [activeShip, setActiveShip] = useState<{ index: number; grabbedCellIndex: number } | null>(null);
	const [previewPos, setPreviewPos] = useState<{ row: number; col: number } | null>(null);
	const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

	// load session
	useEffect(() => {
		fetch(`${BACKEND}/api/session`, { credentials: "include" })
			.then((r) => r.json())
			.then((d) => {
				if (!d.user) return router.push("/");
				setUser(d.user);
			});
	}, [BACKEND, router]);

	// leaderboard
	useEffect(() => {
		fetch(`${BACKEND}/api/leaderboard?type=global`)
			.then((r) => r.json())
			.then(setLeaders);
	}, [BACKEND]);

	// persist fleet
	useEffect(() => {
		localStorage.setItem("fleet", JSON.stringify(fleet));
		fetch(`${BACKEND}/api/fleet`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ fleet }),
		});
	}, [fleet]);

	// matchmaking socket
	useEffect(() => {
		if (!user) return;
		const sock = initSocket(user.id);
		sock.on("match_found", ({ matchId }: { matchId: string }) => {
			router.push(`/game/${matchId}`);
		});
		return () => {
			sock.off("match_found");
		};
	}, [user, router]);

	const toggleSearch = () => {
		setSearching((s) => !s);
		if (!user) return;
		const sock = getSocket();
		searching
			? sock.emit("cancel_match", { userId: user.id })
			: sock.emit("find_match", { userId: user.id, username: user.username });
	};

	// validate
	const isValid = (s: ShipPlacement, i: number) => {
		for (let k = 0; k < s.size; k++) {
			const r = s.row + (s.direction === "vertical" ? k : 0);
			const c = s.col + (s.direction === "horizontal" ? k : 0);
			if (r < 0 || r >= 10 || c < 0 || c >= 10) return false;
			if (
				fleet.some((f, j) => {
					if (j === i) return false;
					for (let m = 0; m < f.size; m++) {
						const rr = f.row + (f.direction === "vertical" ? m : 0);
						const cc = f.col + (f.direction === "horizontal" ? m : 0);
						if (rr === r && cc === c) return true;
					}
					return false;
				})
			)
				return false;
		}
		return true;
	};

	// preview on dragOver
	const handleDragOver = (e: DragOverEvent) => {
		const over = e.over;
		if (over && typeof over.id === "string" && over.id.startsWith("cell-")) {
			const [r, c] = over.id.replace("cell-", "").split("-").map(Number);
			setPreviewPos({ r, c });
		} else {
			setPreviewPos(null);
		}
	};

	// drop
	const handleDragEnd = (e: DragEndEvent) => {
		const { active, over } = e;
		if (!activeShip || !over) {
			setActiveShip(null);
			setPreviewPos(null);
			return;
		}
		const { index, grabbedCellIndex } = activeShip;
		const [r, c] = (over.id as string).replace("cell-", "").split("-").map(Number);
		const ship = fleet[index];
		const newRow = ship.direction === "vertical" ? r - grabbedCellIndex : r;
		const newCol = ship.direction === "horizontal" ? c - grabbedCellIndex : c;
		const updated = { ...ship, row: newRow, col: newCol };
		if (isValid(updated, index)) {
			setFleet((f) => {
				const cp = [...f];
				cp[index] = updated;
				return cp;
			});
		}
		setActiveShip(null);
		setPreviewPos(null);
	};

	// rotate
	const rotateShip = (i: number) => {
		const s = fleet[i];
		const rot = { ...s, direction: s.direction === "horizontal" ? "vertical" : "horizontal" };
		if (isValid(rot, i)) {
			setFleet((f) => {
				const cp = [...f];
				cp[i] = rot;
				return cp;
			});
		}
	};

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 0 } }),
		useSensor(TouchSensor)
	);

	// droppable cell
	const GridCell = ({ r, c }: { r: number; c: number }) => {
		const { setNodeRef, isOver } = useDroppable({ id: `cell-${r}-${c}` });
		let hl = "";
		if (previewPos && activeShip) {
			const s = fleet[activeShip.index];
			const baseR = s.direction === "vertical" ? previewPos.r - activeShip.grabbedCellIndex : previewPos.r;
			const baseC = s.direction === "horizontal" ? previewPos.c - activeShip.grabbedCellIndex : previewPos.c;
			for (let k = 0; k < s.size; k++) {
				const rr = baseR + (s.direction === "vertical" ? k : 0);
				const cc = baseC + (s.direction === "horizontal" ? k : 0);
				if (rr === r && cc === c) {
					hl = "bg-yellow-400/40";
					break;
				}
			}
		}
		return (
			<td
				ref={setNodeRef}
				className={clsx("border border-white/30 water-effect p-0 m-0", isOver && "ring-2 ring-yellow-400", hl)}
				style={{ width: CELL, height: CELL }}
			/>
		);
	};

	// drag preview
	const renderOverlay = () => {
		if (!activeShip) return null;
		const s = fleet[activeShip.index];
		const style: CSSProperties = {
			display: "flex",
			flexDirection: s.direction === "horizontal" ? "row" : "column",
			width: s.direction === "horizontal" ? `${s.size * CELL}px` : `${CELL}px`,
			height: s.direction === "vertical" ? `${s.size * CELL}px` : `${CELL}px`,
			backgroundColor: "rgba(30,64,175,0.8)",
			boxShadow: "0 0 8px rgba(0,0,0,0.5)",
			pointerEvents: "none",
			zIndex: 1000,
		};
		return <div style={style} />;
	};

	if (!user) return null;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 bg-grid p-8 text-white">
			<div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
				{/* Board & Controls */}
				<div className="space-y-6">
					<h2 className="text-4xl font-semibold">Hello, {user.username}</h2>
					<p className="text-gray-300">Drag ships directly from the board. Double-click to rotate.</p>

					{/* outer full-width container */}
					<div className="w-full rounded-lg bg-gray-800 overflow-auto border border-white/10">
						{/* inner fixed-size relative wrapper */}
						<div className="relative mx-auto" style={{ width: CELL * 11, height: CELL * 11 }}>
							<DndContext
								sensors={sensors}
								collisionDetection={pointerWithin}
								onDragOver={handleDragOver}
								onDragEnd={handleDragEnd}
							>
								<table className="table-fixed border-collapse m-0 p-0" style={{ width: CELL * 11, height: CELL * 11 }}>
									<colgroup>
										<col style={{ width: CELL }} />
										{Array.from({ length: 10 }).map((_, i) => (
											<col key={i} style={{ width: CELL }} />
										))}
									</colgroup>
									<thead>
										<tr style={{ height: CELL }}>
											<th className="p-0 m-0" />
											{Array.from({ length: 10 }).map((_, i) => (
												<th key={i} className="p-0 m-0 text-gray-400 text-center text-sm" style={{ height: CELL }}>
													{String.fromCharCode(65 + i)}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{Array.from({ length: 10 }).map((_, r) => (
											<tr key={r} style={{ height: CELL }}>
												<td className="p-0 m-0 text-gray-400 text-center text-sm" style={{ width: CELL }}>
													{r + 1}
												</td>
												{Array.from({ length: 10 }).map((_, c) => (
													<GridCell key={c} r={r} c={c} />
												))}
											</tr>
										))}
									</tbody>
								</table>

								{/* ships */}
								{fleet.map((ship, i) => (
									<DraggableShip
										key={i}
										ship={ship}
										index={i}
										setActiveShipIndex={(gci) => setActiveShip(gci)}
										handleDoubleClick={rotateShip}
									/>
								))}

								<DragOverlay>{renderOverlay()}</DragOverlay>
							</DndContext>
						</div>
					</div>

					<div className="text-center mt-4">
						<button
							onClick={toggleSearch}
							className={clsx("px-6 py-2 rounded-full text-white", searching ? "bg-red-600" : "bg-green-600")}
						>
							{searching ? "Stop Searching" : "Find Opponent"}
						</button>
					</div>
				</div>

				{/* Leaderboard */}
				<div className="space-y-4 pb-24">
					<h3 className="text-2xl font-semibold mb-2">Global Leaderboard</h3>
					<div className="overflow-auto rounded-lg border border-white/10 max-h-96">
						<table className="w-full text-left">
							<thead className="bg-gray-800">
								<tr>
									<th className="px-4 py-2">#</th>
									<th className="px-4 py-2">Username</th>
									<th className="px-4 py-2">Wins</th>
									<th className="px-4 py-2">Losses</th>
									<th className="px-4 py-2">Ratio</th>
								</tr>
							</thead>
							<tbody>
								{leaders.map((u, i) => (
									<tr key={u.id} className="hover:bg-gray-700">
										<td className="px-4 py-2">{i + 1}</td>
										<td className="px-4 py-2">{u.username}</td>
										<td className="px-4 py-2">{u.wins}</td>
										<td className="px-4 py-2">{u.losses}</td>
										<td className="px-4 py-2">{u.losses === 0 ? u.wins.toFixed(2) : (u.wins / u.losses).toFixed(2)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
