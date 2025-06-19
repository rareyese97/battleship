"use client";

import React, { useState, useEffect, CSSProperties } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import "./water.css";
import { getSocket, initSocket } from "../lib/sockets";
import {
	DndContext,
	DragEndEvent,
	DragOverlay,
	useDraggable,
	useDroppable,
	PointerSensor,
	TouchSensor,
	MouseSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";

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

const getInitialFleet = (): ShipPlacement[] => {
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
};

let socket: ReturnType<typeof getSocket>;

export default function HubPage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [fleet, setFleet] = useState<ShipPlacement[]>(getInitialFleet());
	const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
	const [searching, setSearching] = useState(false);
	const [activeShipIndex, setActiveShipIndex] = useState<number | null>(null); // for DragOverlay

	const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

	useEffect(() => {
		fetch(`${backendUrl}/api/session`, { credentials: "include" })
			.then((res) => res.json())
			.then((data) => {
				if (!data.user) return router.push("/");
				setUser(data.user);
			});
	}, [router]);

	useEffect(() => {
		fetch(`${backendUrl}/api/leaderboard?type=global`)
			.then((res) => res.json())
			.then((data) => setLeaders(data));
	}, []);

	useEffect(() => {
		localStorage.setItem("fleet", JSON.stringify(fleet));
		fetch(`${backendUrl}/api/fleet`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ fleet }),
		});
	}, [fleet]);

	useEffect(() => {
		if (!user) return;

		socket = initSocket(user.id);

		socket.on("match_found", ({ matchId }: { matchId: string }) => {
			router.push(`/game/${matchId}`);
		});

		return () => {
			socket?.off("match_found");
		};
	}, [user, router]);

	const handleFindOpponent = () => {
		const nextSearching = !searching;
		setSearching(nextSearching);

		if (!user?.id || !user?.username) {
			console.warn("❌ Missing user ID or username");
			return;
		}

		if (nextSearching) {
			socket.emit("find_match", { userId: user.id, username: user.username });
		} else {
			socket.emit("cancel_match", { userId: user.id });
		}
	};

	const isPlacementValid = (ship: ShipPlacement, index: number): boolean => {
		for (let i = 0; i < ship.size; i++) {
			const r = ship.row + (ship.direction === "vertical" ? i : 0);
			const c = ship.col + (ship.direction === "horizontal" ? i : 0);
			if (r < 0 || r >= 10 || c < 0 || c >= 10) return false;
			if (
				fleet.some((s, idx) => {
					if (idx === index) return false;
					for (let j = 0; j < s.size; j++) {
						const sr = s.row + (s.direction === "vertical" ? j : 0);
						const sc = s.col + (s.direction === "horizontal" ? j : 0);
						if (sr === r && sc === c) return true;
					}
					return false;
				})
			)
				return false;
		}
		return true;
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveShipIndex(null);

		if (!over) return;

		const shipIndex = parseInt(active.id.toString().replace("ship-", ""));
		const [r, c] = over.id.toString().replace("cell-", "").split("-").map(Number);

		const ship = fleet[shipIndex];
		const updated = { ...ship, row: r, col: c };

		if (!isPlacementValid(updated, shipIndex)) return;

		const copy = [...fleet];
		copy[shipIndex] = updated;
		setFleet(copy);
	};

	const handleDoubleClick = (index: number) => {
		const rotated: ShipPlacement = {
			...fleet[index],
			direction: (fleet[index].direction === "horizontal" ? "vertical" : "horizontal") as "horizontal" | "vertical",
		};
		if (!isPlacementValid(rotated, index)) return;
		const copy = [...fleet];
		copy[index] = rotated;
		setFleet(copy);
	};

	const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor), useSensor(PointerSensor));
	const GridCell = ({ r, c }: { r: number; c: number }) => {
		const { setNodeRef, isOver } = useDroppable({
			id: `cell-${r}-${c}`,
		});

		const isOccupied = fleet.some((ship) => {
			for (let j = 0; j < ship.size; j++) {
				const sr = ship.row + (ship.direction === "vertical" ? j : 0);
				const sc = ship.col + (ship.direction === "horizontal" ? j : 0);
				if (sr === r && sc === c) return true;
			}
			return false;
		});

		return (
			<td
				ref={setNodeRef}
				className={clsx(
					"w-8 h-8 border border-white/30 relative overflow-hidden water-effect",
					isOccupied ? "bg-blue-500" : "bg-transparent",
					isOver ? "ring-2 ring-yellow-400" : ""
				)}
			>
				{fleet.map((ship, index) => {
					const {
						attributes,
						listeners,
						setNodeRef: setDragRef,
						transform,
					} = useDraggable({
						id: `ship-${index}`,
					});

					const wrapperStyle: CSSProperties = {
						position: "absolute",
						top: 0,
						left: 0,
						width: ship.direction === "horizontal" ? `calc(${ship.size} * 2rem)` : "2rem",
						height: ship.direction === "vertical" ? `calc(${ship.size} * 2rem)` : "2rem",
						boxShadow: "0 0 8px rgba(0,0,0,0.5)",
						transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
						touchAction: "none",
					};

					const isShipStartHere = (sr: number, sc: number, j: number) => sr === r && sc === c && j === 0;

					for (let j = 0; j < ship.size; j++) {
						const sr = ship.row + (ship.direction === "vertical" ? j : 0);
						const sc = ship.col + (ship.direction === "horizontal" ? j : 0);

						if (isShipStartHere(sr, sc, j)) {
							return (
								<div
									key={index}
									ref={setDragRef}
									{...attributes}
									{...listeners}
									onDoubleClick={() => handleDoubleClick(index)}
									className="cursor-move hover:ring hover:ring-yellow-400"
									style={wrapperStyle}
									onMouseDown={() => setActiveShipIndex(index)}
									onTouchStart={() => setActiveShipIndex(index)}
								>
									{Array.from({ length: ship.size }).map((_, i) => {
										const cellStyle: CSSProperties = {
											position: "absolute",
											top: ship.direction === "vertical" ? `calc(${i} * 2rem)` : "0",
											left: ship.direction === "horizontal" ? `calc(${i} * 2rem)` : "0",
											width: "2rem",
											height: "2rem",
											backgroundColor: "rgba(30, 64, 175, 0.8)",
										};
										return <div key={i} style={cellStyle} />;
									})}
								</div>
							);
						}
					}
					return null;
				})}
			</td>
		);
	};

	const renderShipOverlay = () => {
		if (activeShipIndex === null) return null;
		const ship = fleet[activeShipIndex];
		const style: CSSProperties = {
			width: ship.direction === "horizontal" ? `calc(${ship.size} * 2rem)` : "2rem",
			height: ship.direction === "vertical" ? `calc(${ship.size} * 2rem)` : "2rem",
			display: "flex",
			flexDirection: ship.direction === "horizontal" ? "row" : "column",
		};
		return (
			<div style={style}>
				{Array.from({ length: ship.size }).map((_, i) => (
					<div
						key={i}
						style={{
							width: "2rem",
							height: "2rem",
							backgroundColor: "rgba(30, 64, 175, 0.8)",
							boxShadow: "0 0 8px rgba(0,0,0,0.5)",
						}}
					/>
				))}
			</div>
		);
	};

	if (!user) return null;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 bg-grid p-8 text-white">
			<div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
				<div className="space-y-6">
					<h2 className="text-4xl font-semibold">Hello, {user.username}</h2>
					<p className="text-gray-300">Drag ships directly from the board. Double-click a ship to rotate it.</p>

					<div className="overflow-auto rounded-lg border border-white/10 relative bg-gray-800">
						<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
									{Array.from({ length: 10 }).map((_, r) => (
										<tr key={r}>
											<td className="px-2 text-gray-400 text-sm">{r + 1}</td>
											{Array.from({ length: 10 }).map((_, c) => (
												<GridCell key={c} r={r} c={c} />
											))}
										</tr>
									))}
								</tbody>
							</table>
							<DragOverlay>{renderShipOverlay()}</DragOverlay>
						</DndContext>
					</div>

					<div className="flex justify-center">
						<button
							className={clsx(
								"px-6 py-2 rounded-full text-white cursor-pointer",
								searching ? "bg-red-600 animate-pulse" : "bg-green-600"
							)}
							onClick={handleFindOpponent}
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
								{leaders.map((entry, i) => (
									<tr key={entry.id} className="hover:bg-gray-700 ">
										<td className="px-4 py-2">{i + 1}</td>
										<td className="px-4 py-2">{entry.username}</td>
										<td className="px-4 py-2">{entry.wins}</td>
										<td className="px-4 py-2">{entry.losses}</td>
										<td className="px-4 py-2">
											{entry.losses === 0 ? entry.wins.toFixed(2) : (entry.wins / entry.losses).toFixed(2)}
										</td>
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
