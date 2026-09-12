"use client";

import type { MouseEvent } from "react";

import type { SiteGenerator } from "@/types/generators";

interface GeneratorLayerProps {
  generators: SiteGenerator[];
  selectedGeneratorId: string | null;
  traceMode: boolean;
  onSelectGenerator: (generatorId: string) => void;
}

const GENERATOR_RED = "#DC2626";
const GENERATOR_RED_SELECTED = "#B91C1C";
const GENERATOR_BORDER_MAROON = "#7F1D1D";

const INACTIVE_BLUE = "#3B82F6";

const MARKER_SIZE = 27;

function stopAndSelect(
  event: MouseEvent<SVGGElement>,
  generatorId: string,
  onSelectGenerator: (generatorId: string) => void
) {
  event.stopPropagation();
  onSelectGenerator(generatorId);
}

export default function GeneratorLayer({
  generators,
  selectedGeneratorId,
  traceMode,
  onSelectGenerator,
}: GeneratorLayerProps) {
  return (
    <>
      {generators.map((generator) => {
        const selected =
          selectedGeneratorId === generator.id;

        const x = Number(generator.x);
        const y = Number(generator.y);

        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y)
        ) {
          return null;
        }

        /*
         * Existing generator status:
         * is_down = true  -> inactive
         * is_down = false -> active / operational
         */
        const active = !generator.is_down;
        const isDown = Boolean(generator.is_down);

        const markerSize = selected
          ? MARKER_SIZE + 4
          : MARKER_SIZE;

        const markerX =
          x - markerSize / 2;

        const markerY =
          y - markerSize / 2;

        return (
          <g
            key={generator.id}
            className={
              traceMode
                ? "pointer-events-none"
                : "cursor-pointer"
            }
            onClick={
              traceMode
                ? undefined
                : (event) =>
                    stopAndSelect(
                      event,
                      generator.id,
                      onSelectGenerator
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
                : `${generator.name}, ${generator.kva} kVA, ${
                    active
                      ? "active"
                      : "inactive"
                  }`
            }
          >
            {/*
             * INVISIBLE CLICK TARGET
             *
             * Keeps the small square easy to tap on phones.
             */}
            {!traceMode && (
              <circle
                cx={x}
                cy={y}
                r={42}
                fill="transparent"
                pointerEvents="all"
              />
            )}

            {/*
             * STATUS PULSE
             *
             * Green pulse = active / operational
             * Blue pulse  = inactive / down
             */}
            {isDown && (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={20}
                  fill="none"
                  stroke={INACTIVE_BLUE}
                  strokeWidth={7}
                  opacity={0}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="r"
                    values="20;40"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke-width"
                    values="7;2"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                </circle>

                <circle
                  cx={x}
                  cy={y}
                  r={19}
                  fill="none"
                  stroke={INACTIVE_BLUE}
                  strokeWidth={5.5}
                  opacity={0}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="r"
                    values="19;35"
                    dur="1.35s"
                    begin="0.55s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.9;0"
                    dur="1.35s"
                    begin="0.55s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="stroke-width"
                    values="5.5;1.5"
                    dur="1.35s"
                    begin="0.55s"
                    repeatCount="indefinite"
                  />
                </circle>
              </>
            )}

            {selected && (
              <rect
                x={markerX - 4}
                y={markerY - 4}
                width={markerSize + 8}
                height={markerSize + 8}
                rx={5}
                fill="none"
                stroke="white"
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}

            {/*
             * SIMPLE RED GENERATOR SQUARE
             *
             * Restores the original plain-map-marker look.
             */}
            <rect
              x={markerX}
              y={markerY}
              width={markerSize}
              height={markerSize}
              rx={3}
              fill={
                selected
                  ? GENERATOR_RED_SELECTED
                  : GENERATOR_RED
              }
              stroke={GENERATOR_BORDER_MAROON}
              strokeWidth={
                selected
                  ? 3
                  : 2.5
              }
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />

            {/*
             * GENERATOR NAME
             */}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={
                selected
                  ? 13
                  : 11.5
              }
              fontWeight="800"
              pointerEvents="none"
            >
              {generator.name}
            </text>

            {/*
             * kVA LABEL
             */}
            <text
              x={x}
              y={markerY + markerSize + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#7F1D1D"
              fontSize={11}
              fontWeight="800"
              pointerEvents="none"
              style={{
                paintOrder: "stroke",
                stroke: "white",
                strokeWidth: 4,
                strokeLinejoin:
                  "round",
              }}
            >
              {generator.kva} kVA
            </text>

            {/*
             * SMALL STATUS DOT
             *
             * Matches the pulse:
             * green = active
             * blue  = inactive
             */}
            {isDown && (
              <circle
                cx={
                  markerX +
                  markerSize -
                  3
                }
                cy={markerY + 3}
                r={3.4}
                fill={INACTIVE_BLUE}
                stroke="white"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </>
  );
}
