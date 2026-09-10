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

        return (
          <g key={generator.id}>
            {!traceMode && (
              <rect
                x={generator.x - half - 8}
                y={generator.y - half - 8}
                width={GENERATOR_MARKER_SIZE + 16}
                height={GENERATOR_MARKER_SIZE + 16}
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
              fill="#dc2626"
              stroke={selected ? "#ffffff" : "#7f1d1d"}
              strokeWidth={selected ? 4 : 2.4}
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
              {generator.description ? ` · ${generator.description}` : ""}
            </title>
          </g>
        );
      })}
    </>
  );
}
