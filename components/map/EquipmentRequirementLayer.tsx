"use client";

import type {
  MouseEvent,
} from "react";

import type {
  SiteArea,
} from "@/types/site";

interface EquipmentRequirementLayerProps {
  areas: SiteArea[];
  outstandingCounts:
    Record<
      string,
      number
    >;
  urgentTaskCounts:
    Record<
      string,
      number
    >;
  selectedAreaId:
    | string
    | null;
  traceMode: boolean;
  onSelectArea:
    (areaId: string) =>
      void;
}

interface Point {
  x: number;
  y: number;
}

const BADGE_SIZE = 34;
const BADGE_BLUE =
  "#2563EB";
const BADGE_BLUE_SELECTED =
  "#1D4ED8";

function parsePoints(
  points: string
): Point[] {
  return points
    .trim()
    .split(/\s+/)
    .map(
      (point) => {
        const [
          x,
          y,
        ] =
          point
            .split(",")
            .map(Number);

        return {
          x,
          y,
        };
      }
    )
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

/*
 * Polygon centroid.
 *
 * Falls back to a simple average for very small or
 * degenerate polygons. This keeps the EQ badge tied
 * to the actual marquee overlay rather than requiring
 * another hard-coded coordinate list.
 */
function getPolygonCentroid(
  points: Point[]
): Point | null {
  if (
    points.length ===
    0
  ) {
    return null;
  }

  if (
    points.length <
    3
  ) {
    const total =
      points.reduce(
        (
          sum,
          point
        ) => ({
          x:
            sum.x +
            point.x,
          y:
            sum.y +
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

  let twiceArea =
    0;

  let centroidX =
    0;

  let centroidY =
    0;

  for (
    let index = 0;
    index <
    points.length;
    index += 1
  ) {
    const current =
      points[index];

    const next =
      points[
        (index + 1) %
          points.length
      ];

    const cross =
      current.x *
        next.y -
      next.x *
        current.y;

    twiceArea +=
      cross;

    centroidX +=
      (current.x +
        next.x) *
      cross;

    centroidY +=
      (current.y +
        next.y) *
      cross;
  }

  if (
    Math.abs(
      twiceArea
    ) <
    0.0001
  ) {
    const total =
      points.reduce(
        (
          sum,
          point
        ) => ({
          x:
            sum.x +
            point.x,
          y:
            sum.y +
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

  return {
    x:
      centroidX /
      (3 *
        twiceArea),
    y:
      centroidY /
      (3 *
        twiceArea),
  };
}

function getBadgePosition(
  area: SiteArea,
  hasUrgentTask: boolean
): Point | null {
  const points =
    parsePoints(
      area.points
    );

  const centre =
    getPolygonCentroid(
      points
    );

  if (!centre) {
    return null;
  }

  /*
   * The existing urgent-task marker is centred on the
   * marquee. When both exist, move EQ to the right and
   * slightly down so both indicators remain readable.
   *
   * On marquees with no urgent task, EQ can sit neatly
   * in the centre.
   */
  if (
    hasUrgentTask
  ) {
    return {
      x:
        centre.x + 52,
      y:
        centre.y + 34,
    };
  }

  return centre;
}

function stopAndSelect(
  event:
    MouseEvent<SVGGElement>,
  areaId: string,
  onSelectArea:
    (areaId: string) =>
      void
) {
  event.stopPropagation();

  onSelectArea(
    areaId
  );
}

export default function EquipmentRequirementLayer({
  areas,
  outstandingCounts,
  urgentTaskCounts,
  selectedAreaId,
  traceMode,
  onSelectArea,
}: EquipmentRequirementLayerProps) {
  return (
    <>
      {areas.map(
        (area) => {
          /*
           * User requested this indicator for marquees.
           * Other polygon area types keep their existing
           * equipment UI but do not receive an EQ badge.
           */
          if (
            area.type !==
            "marquee"
          ) {
            return null;
          }

          const outstandingCount =
            outstandingCounts[
              area.id
            ] ?? 0;

          if (
            outstandingCount <=
              0 ||
            traceMode
          ) {
            return null;
          }

          const position =
            getBadgePosition(
              area,
              (urgentTaskCounts[
                area.id
              ] ??
                0) >
                0
            );

          if (!position) {
            return null;
          }

          const selected =
            selectedAreaId ===
            area.id;

          const size =
            selected
              ? BADGE_SIZE +
                4
              : BADGE_SIZE;

          const x =
            position.x -
            size / 2;

          const y =
            position.y -
            size / 2;

          return (
            <g
              key={`equipment-${area.id}`}
              className="cursor-pointer"
              role="button"
              aria-label={`${area.name}: ${outstandingCount} outstanding equipment requirement${
                outstandingCount ===
                1
                  ? ""
                  : "s"
              }`}
              onClick={(
                event
              ) =>
                stopAndSelect(
                  event,
                  area.id,
                  onSelectArea
                )
              }
            >
              {/*
               * Slightly larger transparent hit area for
               * reliable mobile interaction.
               */}
              <rect
                x={
                  position.x -
                  24
                }
                y={
                  position.y -
                  24
                }
                width="48"
                height="48"
                rx="10"
                fill="transparent"
                pointerEvents="all"
              />

              <rect
                x={x}
                y={y}
                width={size}
                height={size}
                rx="5"
                fill={
                  selected
                    ? BADGE_BLUE_SELECTED
                    : BADGE_BLUE
                }
                stroke="white"
                strokeWidth={
                  selected
                    ? 3.5
                    : 3
                }
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />

              <text
                x={
                  position.x
                }
                y={
                  position.y
                }
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize={
                  selected
                    ? 13
                    : 12
                }
                fontWeight="900"
                letterSpacing="0.3"
                pointerEvents="none"
              >
                EQ
              </text>

              {/*
               * Tiny requirement count.
               *
               * It is intentionally subtle so the blue
               * EQ identity remains the main visual.
               */}
              {outstandingCount >
                1 && (
                <>
                  <circle
                    cx={
                      x +
                      size -
                      1
                    }
                    cy={
                      y +
                      1
                    }
                    r="8"
                    fill="#1E3A8A"
                    stroke="white"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />

                  <text
                    x={
                      x +
                      size -
                      1
                    }
                    y={
                      y +
                      1
                    }
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize="8"
                    fontWeight="900"
                    pointerEvents="none"
                  >
                    {outstandingCount >
                    9
                      ? "9+"
                      : outstandingCount}
                  </text>
                </>
              )}
            </g>
          );
        }
      )}
    </>
  );
}
