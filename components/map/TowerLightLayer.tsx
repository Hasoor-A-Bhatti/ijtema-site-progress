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

const BULB_ON_FILL =
  "#FACC15";

const BULB_OFF_FILL =
  "#FEF3C7";

const BULB_DOWN_FILL =
  "#FCA5A5";

const BULB_GLASS_STROKE =
  "#A16207";

const BULB_GLASS_SELECTED_STROKE =
  "#78350F";

const BULB_DOWN_STROKE =
  "#B91C1C";

const BULB_BASE_FILL =
  "#6B7280";

const BULB_BASE_STROKE =
  "#374151";

const RAY_ON_COLOR =
  "#FDE047";

const DOWN_RED =
  "#EF4444";

/*
 * Overall visual scale for the mini lightbulb.
 * This keeps it similar in footprint to the
 * current tower-light map marker.
 */
const BULB_SCALE = 1.05;

/*
 * Transparent click target. Kept tight enough so
 * nearby marquee clicks still work naturally.
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

          const bulbFill =
            isDown
              ? BULB_DOWN_FILL
              : isOn
                ? BULB_ON_FILL
                : BULB_OFF_FILL;

          const bulbStroke =
            selected
              ? BULB_GLASS_SELECTED_STROKE
              : isDown
                ? BULB_DOWN_STROKE
                : BULB_GLASS_STROKE;

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

              {/* ON: warm radiant pulse */}
              {isOn && (
                <>
                  <circle
                    cx={x}
                    cy={y - 8}
                    r={16}
                    fill="none"
                    stroke={
                      RAY_ON_COLOR
                    }
                    strokeWidth={
                      6
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="16;34"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="0.8;0"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="stroke-width"
                      values="6;1.5"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <circle
                    cx={x}
                    cy={y - 8}
                    r={15}
                    fill="none"
                    stroke="#FFF7AE"
                    strokeWidth={
                      4
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="15;27"
                      dur="1.4s"
                      begin="0.5s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="0.75;0"
                      dur="1.4s"
                      begin="0.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}

              {/* DOWN: red fault pulse */}
              {isDown && (
                <>
                  <circle
                    cx={x}
                    cy={y - 8}
                    r={16}
                    fill="none"
                    stroke={
                      DOWN_RED
                    }
                    strokeWidth={
                      6
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="16;35"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="0.95;0"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="stroke-width"
                      values="6;1.5"
                      dur="1.15s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <circle
                    cx={x}
                    cy={y - 8}
                    r={15}
                    fill="none"
                    stroke="#F87171"
                    strokeWidth={
                      4
                    }
                    opacity={
                      0
                    }
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values="15;28"
                      dur="1.15s"
                      begin="0.4s"
                      repeatCount="indefinite"
                    />

                    <animate
                      attributeName="opacity"
                      values="0.8;0"
                      dur="1.15s"
                      begin="0.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </>
              )}

              <g
                transform={`translate(${x} ${y}) scale(${BULB_SCALE})`}
                pointerEvents="none"
              >
                {/* ON: visible rays coming out of the bulb */}
                {isOn && (
                  <g
                    stroke={
                      RAY_ON_COLOR
                    }
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    opacity="0.95"
                    vectorEffect="non-scaling-stroke"
                  >
                    <line
                      x1="0"
                      y1="-28"
                      x2="0"
                      y2="-37"
                    />
                    <line
                      x1="-13"
                      y1="-24"
                      x2="-19"
                      y2="-31"
                    />
                    <line
                      x1="13"
                      y1="-24"
                      x2="19"
                      y2="-31"
                    />
                    <line
                      x1="-18"
                      y1="-10"
                      x2="-27"
                      y2="-10"
                    />
                    <line
                      x1="18"
                      y1="-10"
                      x2="27"
                      y2="-10"
                    />
                    <line
                      x1="-11"
                      y1="2"
                      x2="-17"
                      y2="8"
                    />
                    <line
                      x1="11"
                      y1="2"
                      x2="17"
                      y2="8"
                    />
                  </g>
                )}

                {/* selected outline */}
                {selected && (
                  <path
                    d="M 0 -25
                       C 10 -25 17 -17 17 -8
                       C 17 -2 14 3 10 7
                       L 10 10
                       C 10 12 8 14 6 14
                       L -6 14
                       C -8 14 -10 12 -10 10
                       L -10 7
                       C -14 3 -17 -2 -17 -8
                       C -17 -17 -10 -25 0 -25 Z"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* bulb glass */}
                <path
                  d="M 0 -22
                     C 9 -22 15 -15 15 -7
                     C 15 -2 13 2 10 6
                     C 8 8 7 10 7 12
                     L -7 12
                     C -7 10 -8 8 -10 6
                     C -13 2 -15 -2 -15 -7
                     C -15 -15 -9 -22 0 -22 Z"
                  fill={
                    bulbFill
                  }
                  stroke={
                    bulbStroke
                  }
                  strokeWidth={
                    selected
                      ? 3.6
                      : 3
                  }
                  vectorEffect="non-scaling-stroke"
                />

                {/* subtle filament */}
                <path
                  d="M -5 -1
                     C -3 -5 -1 -3 0 -1
                     C 1 -3 3 -5 5 -1"
                  fill="none"
                  stroke={
                    isDown
                      ? "#991B1B"
                      : isOn
                        ? "#FFFFFF"
                        : "#CA8A04"
                  }
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={
                    isOn
                      ? 0.95
                      : 0.8
                  }
                  vectorEffect="non-scaling-stroke"
                />

                {/* glass highlight */}
                {!isDown && (
                  <path
                    d="M -7 -15
                       C -11 -12 -12 -6 -10 -1"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity={
                      isOn
                        ? 0.55
                        : 0.4
                    }
                    vectorEffect="non-scaling-stroke"
                  />
                )}

                {/* bulb neck */}
                <rect
                  x="-6"
                  y="12"
                  width="12"
                  height="5"
                  rx="2"
                  fill="#9CA3AF"
                  stroke={
                    BULB_BASE_STROKE
                  }
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />

                {/* bulb base */}
                <rect
                  x="-8"
                  y="17"
                  width="16"
                  height="9"
                  rx="2.5"
                  fill={
                    BULB_BASE_FILL
                  }
                  stroke={
                    BULB_BASE_STROKE
                  }
                  strokeWidth="2.2"
                  vectorEffect="non-scaling-stroke"
                />

                {/* base ridges */}
                <line
                  x1="-5"
                  y1="19.5"
                  x2="5"
                  y2="19.5"
                  stroke="#D1D5DB"
                  strokeWidth="1.4"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1="-5"
                  y1="22.5"
                  x2="5"
                  y2="22.5"
                  stroke="#D1D5DB"
                  strokeWidth="1.4"
                  vectorEffect="non-scaling-stroke"
                />

                {/* down cross accent */}
                {isDown && (
                  <g
                    stroke="#991B1B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  >
                    <line
                      x1="-8"
                      y1="-16"
                      x2="8"
                      y2="0"
                    />
                    <line
                      x1="8"
                      y1="-16"
                      x2="-8"
                      y2="0"
                    />
                  </g>
                )}
              </g>
            </g>
          );
        }
      )}
    </>
  );
}
