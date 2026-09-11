"use client";

import { GENERATOR_MARKER_SIZE } from "@/data/generators";
import type { SiteGenerator } from "@/types/generators";

interface GeneratorLayerProps {
  generators: SiteGenerator[];
  selectedGeneratorId: string | null;
  traceMode: boolean;
  onSelectGenerator: (generatorId: string) => void;
}

const GENERATOR_NAVY = "#0F2747";
const GENERATOR_NAVY_DARK = "#07182D";

const DOWN_BLUE = "#2563EB";
const DOWN_BLUE_BRIGHT = "#3B82F6";

export default function GeneratorLayer({
  generators,
  selectedGeneratorId,
  traceMode,
  onSelectGenerator,
}: GeneratorLayerProps) {
  const half = GENERATOR_MARKER_SIZE / 2;

  return (
    <>
      {generators.map((generator) => {
        const selected =
          selectedGeneratorId === generator.id;

        const isDown =
          generator.is_down;

        return (
          <g key={generator.id}>
            {/* GENERATOR DOWN WARNING */}
            {isDown && (
              <>
                {/* BLUE PULSING HALO */}
                <circle
                  cx={generator.x}
                  cy={generator.y}
                  r={
                    GENERATOR_MARKER_SIZE *
                    0.82
                  }
                  fill="none"
                  stroke={DOWN_BLUE_BRIGHT}
                  strokeWidth={6}
                  pointerEvents="none"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.95}
                >
                  <animate
                    attributeName="r"
                    values={`${GENERATOR_MARKER_SIZE * 0.68};${GENERATOR_MARKER_SIZE * 1.22};${GENERATOR_MARKER_SIZE * 0.68}`}
                    dur="1.35s"
                    repeatCount="indefinite"
                  />

                  <animate
                    attributeName="opacity"
                    values="1;0.12;1"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />

                  <animate
                    attributeName="stroke-width"
                    values="6;3;6"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* SECOND SOFTER BLUE PULSE */}
                <circle
                  cx={generator.x}
                  cy={generator.y}
                  r={
                    GENERATOR_MARKER_SIZE *
                    0.7
                  }
                  fill="none"
                  stroke={DOWN_BLUE}
                  strokeWidth={3}
                  pointerEvents="none"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.65}
                >
                  <animate
                    attributeName="r"
                    values={`${GENERATOR_MARKER_SIZE * 0.7};${GENERATOR_MARKER_SIZE * 1.4}`}
                    dur="1.35s"
                    repeatCount="indefinite"
                  />

                  <animate
                    attributeName="opacity"
                    values="0.7;0"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* EXCLAMATION BADGE */}
                <circle
                  cx={
                    generator.x +
                    half +
                    8
                  }
                  cy={
                    generator.y -
                    half -
                    8
                  }
                  r={9}
                  fill={DOWN_BLUE}
                  stroke="#FFFFFF"
                  strokeWidth={2.2}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />

                <text
                  x={
                    generator.x +
                    half +
                    8
                  }
                  y={
                    generator.y -
                    half -
                    4.8
                  }
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="12"
                  fontWeight="900"
                  pointerEvents="none"
                >
                  !
                </text>
              </>
            )}

            {/* LARGE INVISIBLE CLICK TARGET */}
            {!traceMode && (
              <rect
                x={
                  generator.x -
                  half -
                  12
                }
                y={
                  generator.y -
                  half -
                  12
                }
                width={
                  GENERATOR_MARKER_SIZE +
                  24
                }
                height={
                  GENERATOR_MARKER_SIZE +
                  24
                }
                fill="transparent"
                pointerEvents="all"
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();

                  onSelectGenerator(
                    generator.id
                  );
                }}
              />
            )}

            {/* GENERATOR MARKER */}
            <rect
              x={
                generator.x -
                half
              }
              y={
                generator.y -
                half
              }
              width={
                GENERATOR_MARKER_SIZE
              }
              height={
                GENERATOR_MARKER_SIZE
              }
              rx={2.2}
              fill={
                GENERATOR_NAVY
              }
              stroke={
                selected
                  ? "#FFFFFF"
                  : isDown
                    ? DOWN_BLUE_BRIGHT
                    : GENERATOR_NAVY_DARK
              }
              strokeWidth={
                selected
                  ? 4
                  : isDown
                    ? 3.5
                    : 2.4
              }
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />

            {/* GENERATOR NUMBER */}
            <text
              x={generator.x}
              y={
                generator.y +
                3.5
              }
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="800"
              pointerEvents="none"
            >
              {generator.name.replace(
                "G",
                ""
              )}
            </text>

            <title>
              {generator.name} ·{" "}
              {generator.kva} kVA
              {generator.is_down
                ? " · GENERATOR DOWN"
                : ""}
              {generator.description
                ? ` · ${generator.description}`
                : ""}
            </title>
          </g>
        );
      })}
    </>
  );
}