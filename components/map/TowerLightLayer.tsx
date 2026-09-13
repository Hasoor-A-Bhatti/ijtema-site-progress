"use client";

import type {
  MouseEvent,
} from "react";

import type {
  SiteTowerLight,
} from "@/types/towerLights";

interface TowerLightLayerProps {
  lights: SiteTowerLight[];
  selectedLightId:
    | string
    | null;
  traceMode: boolean;
  onSelectLight:
    (lightId: string) =>
      void;
}

const LIGHT_YELLOW =
  "#FACC15";

const LIGHT_YELLOW_OFF =
  "#FDE68A";

const LIGHT_BORDER =
  "#A16207";

const LIGHT_SELECTED_BORDER =
  "#78350F";

const DOWN_RED =
  "#EF4444";

const MARKER_RADIUS = 15;

/*
 * Deliberately smaller than the generator click
 * target. The visible tower light still has an easy
 * mobile target, but nearby marquee space remains
 * clickable and opens the marquee card.
 */
const CLICK_RADIUS = 25;

function stopAndSelect(
  event:
    MouseEvent<SVGGElement>,
  lightId: string,
  onSelectLight:
    (lightId: string) =>
      void
) {
  event.stopPropagation();
  onSelectLight(lightId);
}

export default function TowerLightLayer({
  lights,
  selectedLightId,
  traceMode,
  onSelectLight,
}: TowerLightLayerProps) {
  return (
    <>
      {lights.map(
        (light) => {
          const x =
            Number(light.x);

          const y =
            Number(light.y);

          if (
            !Number.isFinite(
              x
            ) ||
            !Number.isFinite(
              y
            )
          ) {
            return null;
          }

          const selected =
            selectedLightId ===
            light.id;

          const isOn =
            light.status ===
            "on";

          const isDown =
            light.status ===
            "down";

          return (
            <g
              key={
                light.id
              }
              className={
                traceMode
                  ? "pointer-events-none"
                  : "cursor-pointer"
              }
              onClick={
                traceMode
                  ? undefined
                  : (
                      event
                    ) =>
                      stopAndSelect(
                        event,
                        light.id,
                        onSelectLight
                      )
              }
              role={
                traceMode
                  ? undefined
                  : "button"
              }
              aria-label={
                traceMode
                  ? undefined
                  : `${light.name}, ${
                      isDown
                        ? "down"
                        : isOn
                          ? "on"
                          : "off"
                    }`
              }
            >
              {!traceMode && (
                <circle
                  cx={x}
                  cy={y}
                  r={
                    CLICK_RADIUS
                  }
                  fill="transparent"
                  pointerEvents="all"
                />
              )}

              {/*
               * ON
               *
               * Two staggered yellow rings create a
               * smooth radiant light effect.
               */}
              {isOn && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={18}
                    fill="none"
                    stroke={
                      LIGHT_YELLOW
                    }
                    strokeWidth={
                      7
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="18;38"
                      dur="1.45s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="0.95;0"
                      dur="1.45s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="stroke-width"
                      values="7;1.5"
                      dur="1.45s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <circle
                    cx={x}
                    cy={y}
                    r={17}
                    fill="none"
                    stroke="#FDE047"
                    strokeWidth={
                      5
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="17;31"
                      dur="1.45s"
                      begin="0.55s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="0.8;0"
                      dur="1.45s"
                      begin="0.55s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}

              {/*
               * DOWN
               *
               * A stronger/faster red pulse immediately
               * separates a fault from a normal OFF light.
               */}
              {isDown && (
                <>
                  <circle
                    cx={x}
                    cy={y}
                    r={18}
                    fill="none"
                    stroke={
                      DOWN_RED
                    }
                    strokeWidth={
                      7
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="18;39"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="1;0"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="stroke-width"
                      values="7;1.5"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <circle
                    cx={x}
                    cy={y}
                    r={17}
                    fill="none"
                    stroke="#F87171"
                    strokeWidth={
                      5
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="17;31"
                      dur="1.15s"
                      begin="0.42s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="0.85;0"
                      dur="1.15s"
                      begin="0.42s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}

              {selected && (
                <circle
                  cx={x}
                  cy={y}
                  r={
                    MARKER_RADIUS +
                    5
                  }
                  fill="none"
                  stroke="white"
                  strokeWidth={
                    3
                  }
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}

              <circle
                cx={x}
                cy={y}
                r={
                  MARKER_RADIUS
                }
                fill={
                  isDown
                    ? "#FCA5A5"
                    : isOn
                      ? LIGHT_YELLOW
                      : LIGHT_YELLOW_OFF
                }
                stroke={
                  selected
                    ? LIGHT_SELECTED_BORDER
                    : isDown
                      ? "#B91C1C"
                      : LIGHT_BORDER
                }
                strokeWidth={
                  selected
                    ? 4
                    : 3
                }
                vectorEffect="non-scaling-stroke"
              />

              {/*
               * Simple centre lens.
               *
               * Keeps the marker looking like a light rather
               * than a generic map dot, without adding text.
               */}
              <circle
                cx={x}
                cy={y}
                r={5}
                fill={
                  isDown
                    ? "#DC2626"
                    : isOn
                      ? "#FFF7AE"
                      : "#FFFBEB"
                }
                opacity={
                  isDown
                    ? 1
                    : 0.95
                }
                pointerEvents="none"
              />
            </g>
          );
        }
      )}
    </>
  );
}
