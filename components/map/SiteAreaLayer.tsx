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

interface Point {
  x: number;
  y: number;
}

function parsePoints(points: string): Point[] {
  return points
    .trim()
    .split(/\s+/)
    .map((point) => {
      const [x, y] = point.split(",").map(Number);

      return { x, y };
    })
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
    );
}

function getAreaCentre(points: Point[]): Point | null {
  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
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

        const areaCentre = getAreaCentre(
          parsePoints(area.points)
        );

        /*
         * Marquee dark-grey outlines are 20% thinner.
         *
         * Existing standard:
         * 2 normal / 3 selected
         *
         * Marquee:
         * 1.6 normal / 2.4 selected
         */
        const strokeWidth =
          area.type === "marquee"
            ? selected
              ? 2.4
              : 1.6
            : selected
              ? 3
              : 2;

        return (
          <g key={area.id}>
            <polygon
              points={area.points}
              fill={config.colour}
              fillOpacity={selected ? 0.62 : 0.5}
              stroke="#475569"
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              pointerEvents={traceMode ? "none" : "all"}
              className={
                traceMode
                  ? undefined
                  : "cursor-pointer"
              }
              onClick={(event) => {
                if (traceMode) return;

                event.stopPropagation();
                onSelectArea(area.id);
              }}
            />

            {/* URGENT ISSUE BADGE */}
            {urgentCount > 0 &&
              areaCentre &&
              !traceMode && (
                <g
                  className="cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectArea(area.id);
                  }}
                >
                  <circle
                    cx={areaCentre.x}
                    cy={areaCentre.y}
                    r="36"
                    fill="transparent"
                    pointerEvents="all"
                  />

                  <circle
                    cx={areaCentre.x}
                    cy={areaCentre.y}
                    r="27"
                    fill="#DC2626"
                    stroke="white"
                    strokeWidth="4"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />

                  <text
                    x={areaCentre.x}
                    y={areaCentre.y}
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