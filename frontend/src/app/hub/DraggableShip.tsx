"use client";

import React, { CSSProperties } from "react";
import {
    useDraggable,
} from "@dnd-kit/core";

interface ShipPlacement {
    row: number;
    col: number;
    size: number;
    direction: "horizontal" | "vertical";
}

export default function DraggableShip({
    index,
    ship,
    setActiveShipIndex,
    handleDoubleClick,
}: {
    index: number;
    ship: ShipPlacement;
    setActiveShipIndex: (idx: number | null) => void;
    handleDoubleClick: (idx: number) => void;
}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `ship-${index}`,
    });

    const wrapperStyle: CSSProperties = {
        position: "absolute",
        top: 0,
        left: 0,
        width: ship.direction === "horizontal" ? `${ship.size * 32}px` : "32px",
        height: ship.direction === "vertical" ? `${ship.size * 32}px` : "32px",
        boxShadow: "0 0 8px rgba(0,0,0,0.5)",
        transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        touchAction: "none",
    };

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onDoubleClick={() => handleDoubleClick(index)}
            onMouseDown={() => setActiveShipIndex(index)}
            onTouchStart={() => setActiveShipIndex(index)}
            className="cursor-move hover:ring hover:ring-yellow-400"
            style={wrapperStyle}
        >
            {Array.from({ length: ship.size }).map((_, i) => {
                const cellStyle: CSSProperties = {
                    position: "absolute",
                    top: ship.direction === "vertical" ? `${i * 32}px` : "0",
                    left: ship.direction === "horizontal" ? `${i * 32}px` : "0",
                    width: "32px",
                    height: "32px",
                    backgroundColor: "rgba(30, 64, 175, 0.8)",
                };
                return <div key={i} style={cellStyle} />;
            })}
        </div>
    );
}
