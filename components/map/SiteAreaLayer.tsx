"use client";

import {
  STATUS_CONFIG,
} from "@/config/statuses";

import type {
  SiteArea,
  SiteStatus,
} from "@/types/site";

interface SiteAreaLayerProps {
  areas: SiteArea[];
  statuses: Record<
    string,
    SiteStatus
  >;
  urgentTaskCounts: Record<
    string,
    number
  >;
  selectedAreaId:
    | string
    | null;
  traceMode: boolean;
  onSelectArea: (
    areaId: string
  ) => void;
}

interface Point {
  x: number;
  y: number;
}

function parsePoints(
  points: string
): Point[] {
  return points
    .trim()
    .split(/\s+/)
    .map((point) => {
      const [x, y] =
        point
          .split(",")
          .map(Number);

      return {
        x,
        y,
      };
    })
    .filter(
      (point) =>
        Number.isFinite(
          point.x
        ) &&
        Number.isFinite(
          point.y
        )
    );
}

function getCentroid(
  points: Point[]
): Point | null {
  if (
    points.length === 0
  ) {
    return null;
  }

  const total =
    points.reduce(
      (
        result,
        point
      ) => ({
        x:
          result.x +
          point.x,
        y:
          result.y +
          point.y,
      }),
      {
        x: 0,
        y: 0,
      }
    );

  return {
    x:
      total.x /
      points.length,
    y:
      total.y /
      points.length,
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
      {areas.map(
        (area) => {
          const status =
            statuses[
              area.id
            ] ??
            area.status;

          const selected =
            selectedAreaId ===
            area.id;

          const urgentCount =
            urgentTaskCounts[
              area.id
            ] ?? 0;

          /*
           * Only marquees pulse.
           *
           * Tracking polygons such as
           * Pad 1 / Pad 2 are not
           * affected by this marquee
           * warning animation.
           */
          const hasUrgentIssue =
  urgentCount > 0;

          const colour =
            STATUS_CONFIG[
              status
            ]?.colour ??
            STATUS_CONFIG
              .not_started
              .colour;

          const points =
            parsePoints(
              area.points
            );

          const centroid =
            getCentroid(
              points
            );

          return (
            <g
              key={area.id}
            >
              {/* RED URGENCY GLOW */}
              {hasUrgentIssue &&
                !traceMode && (
                  <>
                    <polygon
                      points={
                        area.points
                      }
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="7"
                      strokeLinejoin="round"
                      pointerEvents="none"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.9"
                    >
                      <animate
                        attributeName="opacity"
                        values="1;0.15;1"
                        dur="1.35s"
                        repeatCount="indefinite"
                      />

                      <animate
                        attributeName="stroke-width"
                        values="7;13;7"
                        dur="1.35s"
                        repeatCount="indefinite"
                      />
                    </polygon>

                    <polygon
                      points={
                        area.points
                      }
                      fill="none"
                      stroke="#DC2626"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      pointerEvents="none"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.75"
                    >
                      <animate
                        attributeName="opacity"
                        values="0.8;0.1;0.8"
                        dur="1.35s"
                        repeatCount="indefinite"
                      />
                    </polygon>
                  </>
                )}

              {/* MAIN AREA POLYGON */}
              <polygon
                points={
                  area.points
                }
                fill={
                  colour
                }
                fillOpacity={
                  selected
                    ? 0.62
                    : 0.46
                }
                stroke={
                  selected
                    ? "#0F172A"
                    : colour
                }
                strokeWidth={
                  selected
                    ? 4
                    : 2
                }
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pointerEvents={
                  traceMode
                    ? "none"
                    : "all"
                }
                className={
                  traceMode
                    ? ""
                    : "cursor-pointer"
                }
                onClick={(
                  event
                ) => {
                  if (
                    traceMode
                  ) {
                    return;
                  }

                  event.stopPropagation();

                  onSelectArea(
                    area.id
                  );
                }}
              />

              {/* EXISTING URGENT COUNT INDICATOR */}
              {urgentCount >
                0 &&
                centroid &&
                !traceMode && (
                  <g
                    className="cursor-pointer"
                    onClick={(
                      event
                    ) => {
                      event.stopPropagation();

                      onSelectArea(
                        area.id
                      );
                    }}
                  >
                    <circle
                      cx={
                        centroid.x
                      }
                      cy={
                        centroid.y
                      }
                      r="25"
                      fill="transparent"
                      pointerEvents="all"
                    />

                    <circle
                      cx={
                        centroid.x
                      }
                      cy={
                        centroid.y
                      }
                      r="17"
                      fill="#DC2626"
                      stroke="#FFFFFF"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />

                    <text
                      x={
                        centroid.x
                      }
                      y={
                        centroid.y
                      }
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#FFFFFF"
                      fontSize="18"
                      fontWeight="800"
                      pointerEvents="none"
                    >
                      {
                        urgentCount
                      }
                    </text>
                  </g>
                )}

              <title>
                {area.name}
                {urgentCount >
                0
                  ? ` · ${urgentCount} urgent issue${
                      urgentCount ===
                      1
                        ? ""
                        : "s"
                    }`
                  : ""}
              </title>
            </g>
          );
        }
      )}
    </>
  );
}