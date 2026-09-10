"use client";

import { GENERATOR_MARKER_SIZE } from "@/data/generators";
import type { SiteGenerator } from "@/types/generators";

interface GeneratorLayerProps {
  generators: SiteGenerator[];
  selectedGeneratorId: string | null;
  traceMode: boolean;
  onSelectGenerator: (generatorId: string) => void;
}

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
        const selected = selectedGeneratorId === generator.id;
        const isDown = generator.is_down;

        return (
          <g key={generator.id}>
            {isDown && (
              <>
                {/* Pulsing warning halo around a generator marked down. */}
                <circle
                  cx={generator.x}
                  cy={generator.y}
                  r={GENERATOR_MARKER_SIZE * 0.82}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={6}
                  pointerEvents="none"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.9}
                >
                  <animate
                    attributeName="r"
                    values={`${GENERATOR_MARKER_SIZE * 0.68};${GENERATOR_MARKER_SIZE * 1.15};${GENERATOR_MARKER_SIZE * 0.68}`}
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.95;0.12;0.95"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Always-visible exclamation marker, even between pulse cycles. */}
                <circle
                  cx={generator.x + half + 8}
                  cy={generator.y - half - 8}
                  r={9}
                  fill="#dc2626"
                  stroke="#ffffff"
                  strokeWidth={2.2}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                <text
                  x={generator.x + half + 8}
                  y={generator.y - half - 4.8}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="900"
                  pointerEvents="none"
                >
                  !
                </text>
              </>
            )}

            {!traceMode && (
              <rect
                x={generator.x - half - 12}
                y={generator.y - half - 12}
                width={GENERATOR_MARKER_SIZE + 24}
                height={GENERATOR_MARKER_SIZE + 24}
                fill="transparent"
                pointerEvents="all"
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectGenerator(generator.id);
                }}
              />
            )}

            <rect
              x={generator.x - half}
              y={generator.y - half}
              width={GENERATOR_MARKER_SIZE}
              height={GENERATOR_MARKER_SIZE}
              rx={2.2}
              fill={isDown ? "#991b1b" : "#dc2626"}
              stroke={
                selected
                  ? "#ffffff"
                  : isDown
                    ? "#450a0a"
                    : "#7f1d1d"
              }
              strokeWidth={selected ? 4 : isDown ? 3.2 : 2.4}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />

            <text
              x={generator.x}
              y={generator.y + 3.5}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10"
              fontWeight="800"
              pointerEvents="none"
            >
              {generator.name.replace("G", "")}
            </text>

            <title>
              {generator.name} · {generator.kva} kVA
              {generator.is_down ? " · GENERATOR DOWN" : ""}
              {generator.description ? ` · ${generator.description}` : ""}
            </title>
          </g>
        );
      })}
    </>
  );
}
