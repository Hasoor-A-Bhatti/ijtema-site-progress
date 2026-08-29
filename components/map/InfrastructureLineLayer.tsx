import type {
  InfrastructureType,
  SiteArea,
  SiteStatus,
} from "@/types/site";

interface InfrastructureLineLayerProps {
  lines: SiteArea[];
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

/*
 * VISUAL + CLICK WIDTHS
 *
 * Fence hit target is intentionally very narrow
 * because fence lines often run immediately beside
 * metal / rubber tracking.
 */
const LINE_CONFIG: Record<
  InfrastructureType,
  {
    lineWidth: number;
    hitWidth: number;
  }
> = {
  metal_tracking: {
    lineWidth: 6.72,
    hitWidth: 32,
  },

  rubber_tracking: {
    lineWidth: 3.024,
    hitWidth: 28,
  },

  fence: {
    lineWidth: 1.512,
    hitWidth: 8,
  },
};

/*
 * Render fences first so that in ALL view
 * tracking is placed above fencing.
 *
 * If lines overlap, tracking therefore gets
 * click priority.
 *
 * Fence view still renders only fences.
 */
const RENDER_PRIORITY: Record<
  InfrastructureType,
  number
> = {
  fence: 0,
  metal_tracking: 1,
  rubber_tracking: 2,
};

const INFRASTRUCTURE_STATUS_COLOURS: Record<
  InfrastructureType,
  Record<
    SiteStatus,
    string
  >
> = {
  metal_tracking: {
    not_started:
      "#CBD5E1",
    laid:
      "#FDE68A",
    preparing:
      "#FED7AA",
    ready_for_inspection:
      "#93C5FD",
    completed:
      "#86EFAC",
  },

  rubber_tracking: {
    not_started:
      "#D6D3D1",
    laid:
      "#FEF3A3",
    preparing:
      "#FED7AA",
    ready_for_inspection:
      "#A7CDFB",
    completed:
      "#A7F3C0",
  },

  fence: {
    not_started:
      "#FECACA",
    laid:
      "#FEF3A3",
    preparing:
      "#FED7AA",
    ready_for_inspection:
      "#A7CDFB",
    completed:
      "#A7F3C0",
  },
};

function isInfrastructureType(
  type: SiteArea["type"]
): type is InfrastructureType {
  return (
    type === "fence" ||
    type ===
      "rubber_tracking" ||
    type ===
      "metal_tracking"
  );
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

function getLineMidpoint(
  points: Point[]
): Point | null {
  if (
    points.length === 0
  ) {
    return null;
  }

  if (
    points.length === 1
  ) {
    return points[0];
  }

  const segments =
    points
      .slice(1)
      .map(
        (
          point,
          index
        ) => {
          const start =
            points[index];

          return {
            start,
            end: point,
            length:
              Math.hypot(
                point.x -
                  start.x,
                point.y -
                  start.y
              ),
          };
        }
      );

  const totalLength =
    segments.reduce(
      (
        total,
        segment
      ) =>
        total +
        segment.length,
      0
    );

  if (
    totalLength === 0
  ) {
    return points[0];
  }

  const halfway =
    totalLength / 2;

  let travelled = 0;

  for (
    const segment
    of segments
  ) {
    if (
      travelled +
        segment.length >=
      halfway
    ) {
      const remaining =
        halfway -
        travelled;

      const ratio =
        segment.length > 0
          ? remaining /
            segment.length
          : 0;

      return {
        x:
          segment.start.x +
          (segment.end.x -
            segment.start.x) *
            ratio,

        y:
          segment.start.y +
          (segment.end.y -
            segment.start.y) *
            ratio,
      };
    }

    travelled +=
      segment.length;
  }

  return (
    points.at(-1) ??
    null
  );
}

export default function InfrastructureLineLayer({
  lines,
  statuses,
  urgentTaskCounts,
  selectedAreaId,
  traceMode,
  onSelectArea,
}: InfrastructureLineLayerProps) {
  /*
   * Sort without modifying the original array.
   *
   * Fences render first.
   * Tracking renders afterwards.
   */
  const orderedLines = [
    ...lines,
  ].sort(
    (a, b) => {
      if (
        !isInfrastructureType(
          a.type
        ) ||
        !isInfrastructureType(
          b.type
        )
      ) {
        return 0;
      }

      return (
        RENDER_PRIORITY[
          a.type
        ] -
        RENDER_PRIORITY[
          b.type
        ]
      );
    }
  );

  return (
    <>
      {orderedLines.map(
        (line) => {
          if (
            !isInfrastructureType(
              line.type
            )
          ) {
            return null;
          }

          const status =
            statuses[
              line.id
            ] ??
            line.status;

          const selected =
            selectedAreaId ===
            line.id;

          const urgentCount =
            urgentTaskCounts[
              line.id
            ] ?? 0;

          const lineConfig =
            LINE_CONFIG[
              line.type
            ];

          const lineColour =
            INFRASTRUCTURE_STATUS_COLOURS[
              line.type
            ][status];

          const lineOpacity =
            status ===
            "not_started"
              ? selected
                ? 0.82
                : 0.54
              : selected
                ? 0.9
                : 0.7;

          const midpoint =
            getLineMidpoint(
              parsePoints(
                line.points
              )
            );

          return (
            <g key={line.id}>
              {/* INVISIBLE CLICK TARGET */}
              {!traceMode && (
                <polyline
                  points={
                    line.points
                  }
                  fill="none"
                  stroke="transparent"
                  strokeWidth={
                    lineConfig.hitWidth
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="stroke"
                  className="cursor-pointer"
                  onClick={(
                    event
                  ) => {
                    event.stopPropagation();

                    onSelectArea(
                      line.id
                    );
                  }}
                />
              )}

              {/* VISIBLE LINE */}
              <polyline
                points={
                  line.points
                }
                fill="none"
                stroke={
                  lineColour
                }
                strokeWidth={
                  selected
                    ? lineConfig.lineWidth +
                      0.8
                    : lineConfig.lineWidth
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={
                  lineOpacity
                }
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />

              {/* URGENT ISSUE */}
              {urgentCount >
                0 &&
                midpoint &&
                !traceMode && (
                  <g
                    className="cursor-pointer"
                    onClick={(
                      event
                    ) => {
                      event.stopPropagation();

                      onSelectArea(
                        line.id
                      );
                    }}
                  >
                    <circle
                      cx={
                        midpoint.x
                      }
                      cy={
                        midpoint.y
                      }
                      r="36"
                      fill="transparent"
                      pointerEvents="all"
                    />

                    <circle
                      cx={
                        midpoint.x
                      }
                      cy={
                        midpoint.y
                      }
                      r="24"
                      fill="#DC2626"
                      stroke="white"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />

                    <text
                      x={
                        midpoint.x
                      }
                      y={
                        midpoint.y
                      }
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="white"
                      fontSize="25"
                      fontWeight="700"
                      pointerEvents="none"
                    >
                      {
                        urgentCount
                      }
                    </text>
                  </g>
                )}
            </g>
          );
        }
      )}
    </>
  );
}