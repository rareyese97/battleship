"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import "./water.css";
import { getSocket, initSocket } from "../lib/sockets";

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
	const [draggedShipIndex, setDraggedShipIndex] = useState<number | null>(null);
	const [searching, setSearching] = useState(false);
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

		socket.on("match_found", ({ matchId, opponentId }: { matchId: string; opponentId: number }) => {
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

	const handleDrop = (r: number, c: number) => {
		if (draggedShipIndex === null) return;
		const ship = fleet[draggedShipIndex];
		const updated = { ...ship, row: r, col: c };
		if (!isPlacementValid(updated, draggedShipIndex)) return;
		const copy = [...fleet];
		copy[draggedShipIndex] = updated;
		setFleet(copy);
		setDraggedShipIndex(null);
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

	const renderGrid = () => {
		return Array.from({ length: 10 }).map((_, r) => (
			<tr key={r}>
				<td className="px-2 text-gray-400 text-sm">{r + 1}</td>
				{Array.from({ length: 10 }).map((_, c) => {
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
							key={c}
							onDrop={(e) => {
								e.preventDefault();
								handleDrop(r, c);
							}}
							onDragOver={(e) => e.preventDefault()}
							className={clsx(
								"w-8 h-8 border border-white/30 relative water-effect",
								isOccupied ? "bg-blue-500" : "bg-transparent"
							)}
						>
							{fleet.map((ship, index) => {
								for (let j = 0; j < ship.size; j++) {
									const sr = ship.row + (ship.direction === "vertical" ? j : 0);
									const sc = ship.col + (ship.direction === "horizontal" ? j : 0);
									if (sr === r && sc === c && j === 0) {
										const style = {
											width: ship.direction === "horizontal" ? `calc(${ship.size} * 2rem)` : "2rem",
											height: ship.direction === "vertical" ? `calc(${ship.size} * 2rem)` : "2rem",
											display: "flex",
											flexDirection: ship.direction === "horizontal" ? "row" : "column",
											boxShadow: "0 0 8px rgba(0,0,0,0.5)",
										};
										return (
											<div
												key={index}
												draggable
												onDragStart={() => setDraggedShipIndex(index)}
												onDoubleClick={() => handleDoubleClick(index)}
												className="absolute top-0 left-0 cursor-move hover:ring hover:ring-yellow-400"
												style={style}
											>
												{Array.from({ length: ship.size }).map((_, i) => (
													<div key={i} className="w-8 h-8" style={{ backgroundColor: "rgba(30, 64, 175, 0.8)" }} />
												))}
											</div>
										);
									}
								}
								return null;
							})}
						</td>
					);
				})}
			</tr>
		));
	};

	if (!user) return null;

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 bg-grid p-8 text-white">
			<div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
				<div className="space-y-6">
					<h2 className="text-4xl font-semibold">Hello, {user.username}</h2>
					<p className="text-gray-300">Drag ships directly from the board. Double-click a ship to rotate it.</p>

					<div className="overflow-auto rounded-lg border border-white/10 relative bg-gray-800">
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
							<tbody>{renderGrid()}</tbody>
						</table>
					</div>

					<div className="flex justify-center">
						<button
							className={clsx(
								"px-6 py-2 rounded-full  text-white cursor-pointer",
								searching ? "bg-red-600 animate-pulse" : "bg-green-600"
							)}
							onClick={handleFindOpponent}
						>
							{searching ? "Stop Searching" : "Find Opponent"}
						</button>
					</div>
				</div>

				<div className="space-y-4">
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
