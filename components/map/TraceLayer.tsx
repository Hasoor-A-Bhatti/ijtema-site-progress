import type { MapPoint } from "@/types/site";

interface TraceLayerProps {
  points: MapPoint[];
  mode: "area" | "line";
}

export default function TraceLayer({
  points,
  mode,
}: TraceLayerProps) {
  if (points.length === 0) return null;

  const pointString = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <g pointerEvents="none">
      {/* AREA PREVIEW */}
      {mode === "area" && points.length >= 3 && (
        <polygon
          points={pointString}
          fill="#2563EB"
          fillOpacity="0.08"
          stroke="#2563EB"
          strokeWidth="2.5"
          strokeDasharray="8 6"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* LINE PREVIEW / INCOMPLETE AREA */}
      {(mode === "line" ||
        (mode === "area" && points.length < 3)) &&
        points.length >= 2 && (
          <polyline
            points={pointString}
            fill="none"
            stroke="#2563EB"
            strokeWidth={mode === "line" ? 2 : 2.5}
            strokeDasharray={
              mode === "line" ? undefined : "8 6"
            }
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

      {/* TRACE POINTS */}
      {points.map((point, index) => {
        /*
         * Line tracing uses extremely small points
         * for precise fencing/tracking work.
         *
         * Area tracing keeps the larger numbered
         * markers for easier polygon tracing.
         */
        if (mode === "line") {
          return (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#2563EB"
              stroke="white"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        }

        return (
          <g key={`${point.x}-${point.y}-${index}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="18"
              fill="white"
              stroke="#2563EB"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />

            <text
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#1E40AF"
              fontSize="20"
              fontWeight="700"
            >
              {index + 1}
            </text>
          </g>
        );
      })}
    </g>
  );
}