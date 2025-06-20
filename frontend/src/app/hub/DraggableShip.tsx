// components/DraggableShip.tsx
"use client";

import React, { CSSProperties, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";

interface ShipPlacement {
	row: number;
	col: number;
	size: number;
	direction: "horizontal" | "vertical";
}

const CELL = 32;

export default function DraggableShip({
	ship,
	index,
	setActiveShipIndex,
	handleDoubleClick,
}: {
	ship: ShipPlacement;
	index: number;
	setActiveShipIndex: (info: { index: number; grabbedCellIndex: number } | null) => void;
	handleDoubleClick: (index: number) => void;
}) {
	const { attributes, listeners, setNodeRef, transform } = useDraggable({
		id: `ship-${index}`,
	});
	const ref = useRef<HTMLDivElement>(null);
	const lastTap = useRef<number>(0);

	const handlePointerDown: React.PointerEventHandler = (e) => {
		const rect = ref.current!.getBoundingClientRect();
		const offset = ship.direction === "horizontal" ? e.clientX - rect.left : e.clientY - rect.top;
		const grabbedCellIndex = Math.floor(offset / CELL);
		setActiveShipIndex({ index, grabbedCellIndex });

		// let dnd-kit start the drag
		(listeners as any).onPointerDown?.(e);
	};

	// detect a fast double-tap on touch devices
	const handleTouchEnd: React.TouchEventHandler = (e) => {
		const now = Date.now();
		if (now - lastTap.current < 300) {
			e.stopPropagation();
			handleDoubleClick(index);
		}
		lastTap.current = now;
	};

	const style: CSSProperties = {
		position: "absolute",
		top: `${CELL + ship.row * CELL}px`,
		left: `${CELL + ship.col * CELL}px`,
		display: "flex",
		flexDirection: ship.direction === "horizontal" ? "row" : "column",
		width: ship.direction === "horizontal" ? ship.size * CELL : CELL,
		height: ship.direction === "vertical" ? ship.size * CELL : CELL,
		transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
		boxShadow: "0 0 8px rgba(0,0,0,0.5)",
		touchAction: "none",
		cursor: "grab",
		zIndex: 50,
	};

	return (
		<div
			ref={(node) => {
				setNodeRef(node!);
				ref.current = node!;
			}}
			{...attributes}
			{...listeners}
			onPointerDown={handlePointerDown}
			onTouchEnd={handleTouchEnd}
			onDoubleClick={(e) => {
				e.stopPropagation();
				handleDoubleClick(index);
			}}
			style={style}
		>
			{Array.from({ length: ship.size }).map((_, i) => (
				<div
					key={i}
					style={{
						width: CELL,
						height: CELL,
						backgroundColor: "rgba(30, 64, 175, 0.8)",
					}}
				/>
			))}
		</div>
	);
}
