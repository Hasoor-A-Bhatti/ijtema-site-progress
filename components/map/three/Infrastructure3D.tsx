"use client";

import { useMemo, useState } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";

import HoverLabel3D from "@/components/map/three/HoverLabel3D";

import { STATUS_CONFIG } from "@/config/statuses";

import type {
  InfrastructureType,
  SiteArea,
  SiteStatus,
} from "@/types/site";

interface Infrastructure3DProps {
  line: SiteArea;
  status: SiteStatus;
  selected?: boolean;
  urgentCount?: number;
  onSelect?: (areaId: string) => void;
}

interface Point2D {
  x: number;
  y: number;
}

const MAP_SCALE = 0.02;

const FENCE_POST_SPACING = 1.15;
const FENCE_POST_SIZE = 0.075;
const FENCE_TOP_RAIL_HEIGHT = 0.07;

const METAL_PANEL_LENGTH = 0.92;
const METAL_SEAM_WIDTH = 0.035;

const TYPE_CONFIG: Record<
  InfrastructureType,
  {
    width: number;
    height: number;
    y: number;
  }
> = {
  metal_tracking: {
    width: 0.72,
    height: 0.06,
    y: 0.03,
  },

  rubber_tracking: {
    width: 0.16,
    height: 0.045,
    y: 0.025,
  },

  fence: {
    width: 0.06,
    height: 1.0,
    y: 0.5,
  },
};

function isInfrastructureType(
  type: SiteArea["type"]
): type is InfrastructureType {
  return (
    type === "metal_tracking" ||
    type === "rubber_tracking" ||
    type === "fence"
  );
}

function parsePoints(
  points: string
): Point2D[] {
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

function getColour(
  type: InfrastructureType,
  status: SiteStatus
) {
  if (
    type === "fence" &&
    status === "not_started"
  ) {
    return "#4B5563";
  }

  return (
    STATUS_CONFIG[status]?.colour ??
    STATUS_CONFIG.not_started.colour
  );
}

function createSegmentTransform(
  start: Point2D,
  end: Point2D
) {
  const startX =
    start.x * MAP_SCALE;

  const startZ =
    -start.y * MAP_SCALE;

  const endX =
    end.x * MAP_SCALE;

  const endZ =
    -end.y * MAP_SCALE;

  const dx =
    endX - startX;

  const dz =
    endZ - startZ;

  const length =
    Math.hypot(
      dx,
      dz
    );

  return {
    length,

    start: {
      x: startX,
      z: startZ,
    },

    end: {
      x: endX,
      z: endZ,
    },

    position: [
      (startX + endX) / 2,
      0,
      (startZ + endZ) / 2,
    ] as [
      number,
      number,
      number,
    ],

    rotationY:
      -Math.atan2(
        dz,
        dx
      ),
  };
}

function getLineMidpoint(
  points: Point2D[]
): Point2D | null {
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
          (
            segment.end.x -
            segment.start.x
          ) *
            ratio,

        y:
          segment.start.y +
          (
            segment.end.y -
            segment.start.y
          ) *
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

export default function Infrastructure3D({
  line,
  status,
  selected = false,
  urgentCount = 0,
  onSelect,
}: Infrastructure3DProps) {
  const [
    hovered,
    setHovered,
  ] =
    useState(false);

  /*
   * IMPORTANT:
   * All hooks must be called before any conditional return.
   * This avoids the React "hook is called conditionally"
   * error you were seeing.
   */
  const points =
    useMemo(
      () =>
        parsePoints(
          line.points
        ),
      [line.points]
    );

  const midpoint =
    useMemo(
      () =>
        getLineMidpoint(
          points
        ),
      [points]
    );

  const segments =
    useMemo(
      () =>
        points
          .slice(1)
          .map(
            (
              point,
              index
            ) =>
              createSegmentTransform(
                points[
                  index
                ],
                point
              )
          )
          .filter(
            (segment) =>
              segment.length >
              0
          ),
      [points]
    );

  if (
    !isInfrastructureType(
      line.type
    )
  ) {
    return null;
  }

  const config =
    TYPE_CONFIG[
      line.type
    ];

  const colour =
    getColour(
      line.type,
      status
    );

  if (
    segments.length === 0
  ) {
    return null;
  }

  return (
    <group
      onClick={(
        event
      ) => {
        event.stopPropagation();

        onSelect?.(
          line.id
        );
      }}
      onPointerEnter={(
        event
      ) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={(
        event
      ) => {
        event.stopPropagation();
        setHovered(false);
      }}
    >
      {hovered &&
        midpoint && (
          <HoverLabel3D
            text={
              line.name
            }
            position={[
              midpoint.x *
                MAP_SCALE,
              line.type ===
              "fence"
                ? 1.65
                : 0.72,
              -midpoint.y *
                MAP_SCALE,
            ]}
          />
        )}
      {segments.map(
        (
          segment,
          index
        ) => {
          const detailWidth =
            selected
              ? config.width *
                1.45
              : config.width;

          const postCount =
            Math.max(
              2,
              Math.floor(
                segment.length /
                  FENCE_POST_SPACING
              ) + 1
            );

          const metalSeamCount =
            Math.max(
              1,
              Math.floor(
                segment.length /
                  METAL_PANEL_LENGTH
              )
            );

          const dx =
            segment.end.x -
            segment.start.x;

          const dz =
            segment.end.z -
            segment.start.z;

          return (
            <group
              key={`${line.id}-${index}`}
            >
              <mesh
                position={[
                  segment.position[
                    0
                  ],
                  config.y,
                  segment.position[
                    2
                  ],
                ]}
                rotation={[
                  0,
                  segment.rotationY,
                  0,
                ]}
                castShadow={
                  line.type ===
                  "fence"
                }
                receiveShadow
              >
                <boxGeometry
                  args={[
                    segment.length,
                    config.height,
                    detailWidth,
                  ]}
                />

                <meshPhysicalMaterial
                  color={colour}
                  roughness={
                    line.type ===
                    "metal_tracking"
                      ? 0.4
                      : line.type ===
                          "fence"
                        ? 0.58
                        : 0.7
                  }
                  metalness={
                    line.type ===
                    "metal_tracking"
                      ? 0.26
                      : line.type ===
                          "fence"
                        ? 0.18
                        : 0.02
                  }
                  clearcoat={
                    line.type ===
                    "metal_tracking"
                      ? 0.14
                      : 0.04
                  }
                  clearcoatRoughness={0.68}
                />

                <Edges
                  threshold={35}
                  color={
                    line.type ===
                    "fence"
                      ? "#374151"
                      : "#64748B"
                  }
                />
              </mesh>

              {/* FENCE POSTS */}
              {line.type ===
                "fence" &&
                Array.from({
                  length:
                    postCount,
                }).map(
                  (
                    _,
                    postIndex
                  ) => {
                    const t =
                      postCount <=
                      1
                        ? 0
                        : postIndex /
                          (postCount -
                            1);

                    return (
                      <mesh
                        key={`${line.id}-post-${index}-${postIndex}`}
                        position={[
                          segment
                            .start
                            .x +
                            dx *
                              t,
                          config.height /
                              2 +
                            0.07,
                          segment
                            .start
                            .z +
                            dz *
                              t,
                        ]}
                        castShadow
                      >
                        <boxGeometry
                          args={[
                            FENCE_POST_SIZE,
                            config.height +
                              0.14,
                            FENCE_POST_SIZE,
                          ]}
                        />
                        <meshPhysicalMaterial
                          color="#4B5563"
                          roughness={0.42}
                          metalness={0.46}
                        />
                      </mesh>
                    );
                  }
                )}

              {/* FENCE TOP RAIL */}
              {line.type ===
                "fence" && (
                <mesh
                  position={[
                    segment
                      .position[
                      0
                    ],
                    config.height +
                      FENCE_TOP_RAIL_HEIGHT /
                        2,
                    segment
                      .position[
                      2
                    ],
                  ]}
                  rotation={[
                    0,
                    segment.rotationY,
                    0,
                  ]}
                  castShadow
                >
                  <boxGeometry
                    args={[
                      segment.length,
                      FENCE_TOP_RAIL_HEIGHT,
                      0.055,
                    ]}
                  />
                  <meshPhysicalMaterial
                    color="#475569"
                    roughness={0.42}
                    metalness={0.42}
                  />
                </mesh>
              )}

              {/* METAL TRACK PANEL JOINTS */}
              {line.type ===
                "metal_tracking" &&
                Array.from({
                  length:
                    metalSeamCount,
                }).map(
                  (
                    _,
                    seamIndex
                  ) => {
                    const distance =
                      Math.min(
                        segment.length -
                          0.05,
                        (seamIndex +
                          1) *
                          METAL_PANEL_LENGTH
                      );

                    const t =
                      segment.length >
                      0
                        ? distance /
                          segment.length
                        : 0;

                    return (
                      <mesh
                        key={`${line.id}-seam-${index}-${seamIndex}`}
                        position={[
                          segment
                            .start
                            .x +
                            dx *
                              t,
                          config.height +
                            0.013,
                          segment
                            .start
                            .z +
                            dz *
                              t,
                        ]}
                        rotation={[
                          0,
                          segment.rotationY,
                          0,
                        ]}
                      >
                        <boxGeometry
                          args={[
                            METAL_SEAM_WIDTH,
                            0.018,
                            detailWidth *
                              0.92,
                          ]}
                        />
                        <meshStandardMaterial
                          color="#94A3B8"
                          roughness={0.42}
                          metalness={0.34}
                        />
                      </mesh>
                    );
                  }
                )}

              {/* RUBBER TRACK GROOVES */}
              {line.type ===
                "rubber_tracking" &&
                [-0.23, 0, 0.23].map(
                  (
                    lateral,
                    grooveIndex
                  ) => {
                    const perpendicularX =
                      -dz /
                      (segment.length ||
                        1);

                    const perpendicularZ =
                      dx /
                      (segment.length ||
                        1);

                    return (
                      <mesh
                        key={`${line.id}-groove-${index}-${grooveIndex}`}
                        position={[
                          segment
                            .position[
                            0
                          ] +
                            perpendicularX *
                              lateral *
                              detailWidth,
                          config.height +
                            0.012,
                          segment
                            .position[
                            2
                          ] +
                            perpendicularZ *
                              lateral *
                              detailWidth,
                        ]}
                        rotation={[
                          0,
                          segment.rotationY,
                          0,
                        ]}
                      >
                        <boxGeometry
                          args={[
                            segment.length *
                              0.97,
                            0.014,
                            0.015,
                          ]}
                        />
                        <meshStandardMaterial
                          color="#475569"
                          roughness={0.84}
                        />
                      </mesh>
                    );
                  }
                )}
            </group>
          );
        }
      )}

      {urgentCount >
        0 &&
        midpoint && (
          <group
            position={[
              midpoint.x *
                MAP_SCALE,
              line.type ===
              "fence"
                ? 1.45
                : 0.55,
              -midpoint.y *
                MAP_SCALE,
            ]}
          >
            <mesh>
              <sphereGeometry
                args={[
                  0.17,
                  20,
                  20,
                ]}
              />

              <meshBasicMaterial
                color="#DC2626"
              />
            </mesh>

            <mesh
              scale={[
                1.75,
                1.75,
                1.75,
              ]}
            >
              <ringGeometry
                args={[
                  0.15,
                  0.18,
                  32,
                ]}
              />

              <meshBasicMaterial
                color="#EF4444"
                side={
                  THREE.DoubleSide
                }
                transparent
                opacity={
                  0.7
                }
              />
            </mesh>
          </group>
        )}
    </group>
  );
}
