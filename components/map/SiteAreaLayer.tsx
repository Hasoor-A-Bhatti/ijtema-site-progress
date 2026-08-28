import { STATUS_CONFIG } from "@/config/statuses";

import type {
  SiteArea,
  SiteStatus,
} from "@/types/site";

interface SiteAreaLayerProps {
  areas: SiteArea[];
  statuses: Record<string, SiteStatus>;
  urgentTaskCounts: Record<string, number>;
  selectedAreaId: string | null;
  traceMode: boolean;
  onSelectArea: (areaId: string) => void;
}

export default function SiteAreaLayer({
  areas,
  statuses,
  urgentTaskCounts,
  selectedAreaId,
  traceMode,
  onSelectArea,
}: SiteAreaLayerProps) {
  return (
    <>
      {areas.map((area) => {
        const status = statuses[area.id] ?? area.status;
        const config = STATUS_CONFIG[status];
        const selected = selectedAreaId === area.id;
        const urgentCount = urgentTaskCounts[area.id] ?? 0;

        const coordinates = area.points
          .trim()
          .split(/\s+/)
          .map((point) => {
            const [x, y] = point.split(",").map(Number);

            return { x, y };
          });

        const badgeX =
          coordinates.reduce((total, point) => total + point.x, 0) /
          coordinates.length;

        const badgeY =
          coordinates.reduce((total, point) => total + point.y, 0) /
          coordinates.length;

        return (
          <g key={area.id}>
            {/* AREA POLYGON */}
            <polygon
              points={area.points}
              fill={config.colour}
              fillOpacity={selected ? 0.55 : 0.35}
              stroke={config.colour}
              strokeWidth={selected ? 4 : 2}
              vectorEffect="non-scaling-stroke"
              className={traceMode ? "" : "cursor-pointer transition-all"}
              onClick={(event) => {
                if (traceMode) return;

                event.stopPropagation();
                onSelectArea(area.id);
              }}
            />

            {/* URGENT TASK BADGE */}
            {urgentCount > 0 && !traceMode && (
              <g
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectArea(area.id);
                }}
              >
                <circle
                  cx={badgeX}
                  cy={badgeY}
                  r="28"
                  fill="#DC2626"
                  stroke="white"
                  strokeWidth="4"
                  vectorEffect="non-scaling-stroke"
                />

                <text
                  x={badgeX}
                  y={badgeY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="28"
                  fontWeight="700"
                  pointerEvents="none"
                >
                  {urgentCount}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}