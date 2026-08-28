import type { MapPoint } from "@/types/site";

interface TraceLayerProps {
  points: MapPoint[];
}

export default function TraceLayer({
  points,
}: TraceLayerProps) {
  const polygonPoints = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <>
      {points.length >= 2 && (
        <polyline
          points={polygonPoints}
          fill={
            points.length >= 3
              ? "rgba(59, 130, 246, 0.25)"
              : "none"
          }
          stroke="#2563EB"
          strokeWidth="4"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {points.map((point, index) => (
        <g
          key={`${point.x}-${point.y}-${index}`}
          pointerEvents="none"
        >
          <circle
            cx={point.x}
            cy={point.y}
            r="16"
            fill="#2563EB"
            stroke="white"
            strokeWidth="5"
            vectorEffect="non-scaling-stroke"
          />

          <text
            x={point.x + 24}
            y={point.y - 18}
            fontSize="32"
            fontWeight="700"
            fill="#1E3A8A"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </>
  );
}