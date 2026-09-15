"use client";

import { Html } from "@react-three/drei";

interface HoverLabel3DProps {
  text: string;
  position?: [
    number,
    number,
    number
  ];
}

export default function HoverLabel3D({
  text,
  position = [
    0,
    0,
    0,
  ],
}: HoverLabel3DProps) {
  return (
    <Html
      position={position}
      center
      distanceFactor={18}
      zIndexRange={[
        100,
        0,
      ]}
      style={{
        pointerEvents:
          "none",
      }}
    >
      <div className="whitespace-nowrap rounded-xl border border-white/50 bg-slate-950/88 px-3 py-1.5 text-xs font-semibold tracking-[0.01em] text-white shadow-[0_10px_30px_rgba(15,23,42,0.28)] backdrop-blur-md">
        {text}
      </div>
    </Html>
  );
}
