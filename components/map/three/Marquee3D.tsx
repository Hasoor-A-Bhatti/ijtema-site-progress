"use client";

import { useMemo, useState } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";

import HoverLabel3D from "@/components/map/three/HoverLabel3D";

import { STATUS_CONFIG } from "@/config/statuses";

import type {
  SiteArea,
  SiteStatus,
} from "@/types/site";

interface Marquee3DProps {
  area: SiteArea;
  status: SiteStatus;
  selected?: boolean;
  urgentCount?: number;
  onSelect?: (areaId: string) => void;
}

interface Point2D {
  x: number;
  y: number;
}

interface Point3Plan {
  x: number;
  z: number;
}

const MAP_SCALE = 0.02;
const WALL_HEIGHT = 1.08;
const ROOF_HEIGHT = 0.74;
const FLAT_ROOF_THICKNESS = 0.08;
const OUTLINE_THICKNESS = 0.05;

const MARQUEE_EDGE =
  "#475569";

/*
 * Carpeting Completed is deliberately forced to a strong pink in 3D.
 *
 * This avoids the lighter physical-material / scene-lighting combination
 * washing the status out towards white.
 */
const CARPETING_COMPLETED_PINK =
  "#EC4899";

function polishedColour(
  input: string,
  lightnessOffset = 0
) {
  return new THREE.Color(input)
    .clone()
    .offsetHSL(
      0,
      -0.04,
      lightnessOffset
    );
}

/*
 * These areas should be readable site structures,
 * but not "house-like" marquee tents.
 */
const FLAT_ROOF_IDS = new Set([
  "lajna-bazaar",
  "ansar-bazaar",
  "lajna-ff-entrance",
  "ansar-overflow-canopy",
]);

const OPEN_SIDED_CANOPY_IDS = new Set([
  "ansar-overflow-canopy",
]);

function parsePoints(
  points: string
): Point2D[] {
  return points
    .trim()
    .split(/\s+/)
    .map((point) => {
      const [x, y] = point.split(",").map(Number);

      return {
        x,
        y,
      };
    })
    .filter(
      (point) =>
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
    );
}

function getCentre(
  points: Point2D[]
): Point2D {
  const total = points.reduce(
    (result, point) => ({
      x: result.x + point.x,
      y: result.y + point.y,
    }),
    {
      x: 0,
      y: 0,
    }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function toLocalPoint(
  point: Point2D,
  centre: Point2D
): Point3Plan {
  return {
    x: (point.x - centre.x) * MAP_SCALE,
    z: -(point.y - centre.y) * MAP_SCALE,
  };
}

function getBounds(
  points: Point3Plan[]
) {
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}

function polygonArea(
  points: Point3Plan[]
) {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    area +=
      current.x * next.z -
      next.x * current.z;
  }

  return area / 2;
}

function ensureClockwise(
  points: Point3Plan[]
) {
  return polygonArea(points) > 0
    ? [...points].reverse()
    : points;
}

function createFootprintShape(
  localPoints: Point3Plan[]
) {
  const shape = new THREE.Shape();

  ensureClockwise(localPoints).forEach(
    (point, index) => {
      /*
       * Shape/ExtrudeGeometry uses local XY.
       * Geometry is then rotated -90deg around X,
       * so the plan Z must be negated here.
       */
      const shapeY = -point.z;

      if (index === 0) {
        shape.moveTo(point.x, shapeY);
      } else {
        shape.lineTo(point.x, shapeY);
      }
    }
  );

  shape.closePath();

  return shape;
}

function createWallGeometry(
  localPoints: Point3Plan[],
  height: number,
  openSided: boolean
) {
  const shape = createFootprintShape(localPoints);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: openSided ? OUTLINE_THICKNESS : height,
    bevelEnabled: false,
  });

  geometry.rotateX(-Math.PI / 2);

  if (openSided) {
    geometry.translate(0, height - OUTLINE_THICKNESS, 0);
  }

  geometry.computeVertexNormals();

  return geometry;
}

function distance(
  a: Point3Plan,
  b: Point3Plan
) {
  return Math.hypot(
    b.x - a.x,
    b.z - a.z
  );
}

function midpoint(
  a: Point3Plan,
  b: Point3Plan
): Point3Plan {
  return {
    x: (a.x + b.x) / 2,
    z: (a.z + b.z) / 2,
  };
}

function angleAt(
  previous: Point3Plan,
  current: Point3Plan,
  next: Point3Plan
) {
  const ax = previous.x - current.x;
  const az = previous.z - current.z;
  const bx = next.x - current.x;
  const bz = next.z - current.z;

  const magA = Math.hypot(ax, az);
  const magB = Math.hypot(bx, bz);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  const dot = ax * bx + az * bz;
  const cosine = THREE.MathUtils.clamp(
    dot / (magA * magB),
    -1,
    1
  );

  return THREE.MathUtils.radToDeg(
    Math.acos(cosine)
  );
}

function isLikelyRectangular(
  localPoints: Point3Plan[]
) {
  if (localPoints.length !== 4) {
    return false;
  }

  const edges = localPoints.map(
    (point, index) =>
      distance(
        point,
        localPoints[
          (index + 1) % localPoints.length
        ]
      )
  );

  const minEdge = Math.min(...edges);
  const maxEdge = Math.max(...edges);

  if (minEdge === 0 || maxEdge / minEdge > 4.5) {
    return false;
  }

  const angles = localPoints.map(
    (point, index) =>
      angleAt(
        localPoints[
          (index - 1 + localPoints.length) % localPoints.length
        ],
        point,
        localPoints[
          (index + 1) % localPoints.length
        ]
      )
  );

  return angles.every(
    (angle) => angle >= 55 && angle <= 125
  );
}

function createGableRoofGeometry(
  localPoints: Point3Plan[],
  wallHeight: number,
  roofHeight: number
) {
  if (!isLikelyRectangular(localPoints)) {
    return null;
  }

  const [p0, p1, p2, p3] = ensureClockwise(localPoints);

  const side01 = distance(p0, p1);
  const side12 = distance(p1, p2);

  let ridgeA: Point3Plan;
  let ridgeB: Point3Plan;
  let vertices: number[];

  if (side01 >= side12) {
    ridgeA = midpoint(p0, p3);
    ridgeB = midpoint(p1, p2);

    vertices = [
      p0.x, wallHeight, p0.z,
      p1.x, wallHeight, p1.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,

      p0.x, wallHeight, p0.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,
      ridgeA.x, wallHeight + roofHeight, ridgeA.z,

      p3.x, wallHeight, p3.z,
      ridgeA.x, wallHeight + roofHeight, ridgeA.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,

      p3.x, wallHeight, p3.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,
      p2.x, wallHeight, p2.z,

      p0.x, wallHeight, p0.z,
      ridgeA.x, wallHeight + roofHeight, ridgeA.z,
      p3.x, wallHeight, p3.z,

      p1.x, wallHeight, p1.z,
      p2.x, wallHeight, p2.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,
    ];
  } else {
    ridgeA = midpoint(p0, p1);
    ridgeB = midpoint(p3, p2);

    vertices = [
      p0.x, wallHeight, p0.z,
      ridgeA.x, wallHeight + roofHeight, ridgeA.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,

      p0.x, wallHeight, p0.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,
      p3.x, wallHeight, p3.z,

      p1.x, wallHeight, p1.z,
      p2.x, wallHeight, p2.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,

      p1.x, wallHeight, p1.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,
      ridgeA.x, wallHeight + roofHeight, ridgeA.z,

      p0.x, wallHeight, p0.z,
      p1.x, wallHeight, p1.z,
      ridgeA.x, wallHeight + roofHeight, ridgeA.z,

      p3.x, wallHeight, p3.z,
      ridgeB.x, wallHeight + roofHeight, ridgeB.z,
      p2.x, wallHeight, p2.z,
    ];
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );

  geometry.computeVertexNormals();

  return geometry;
}

function createFlatRoofGeometry(
  localPoints: Point3Plan[],
  y: number
) {
  const shape = createFootprintShape(localPoints);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: FLAT_ROOF_THICKNESS,
    bevelEnabled: false,
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  geometry.computeVertexNormals();

  return geometry;
}

function createPostPositions(
  localPoints: Point3Plan[]
) {
  const bounds = getBounds(localPoints);

  return ensureClockwise(localPoints).map((point) => {
    const insetX = point.x > 0 ? -0.08 : 0.08;
    const insetZ = point.z > 0 ? -0.08 : 0.08;

    return {
      x: THREE.MathUtils.clamp(
        point.x + insetX,
        bounds.minX + 0.08,
        bounds.maxX - 0.08
      ),
      z: THREE.MathUtils.clamp(
        point.z + insetZ,
        bounds.minZ + 0.08,
        bounds.maxZ - 0.08
      ),
    };
  });
}

export default function Marquee3D({
  area,
  status,
  selected = false,
  urgentCount = 0,
  onSelect,
}: Marquee3DProps) {
  const [
    hovered,
    setHovered,
  ] =
    useState(false);

  const points = useMemo(
    () => parsePoints(area.points),
    [area.points]
  );

  const centre = useMemo(
    () =>
      points.length >= 3
        ? getCentre(points)
        : null,
    [points]
  );

  const localPoints = useMemo(
    () =>
      centre
        ? points.map((point) =>
            toLocalPoint(point, centre)
          )
        : [],
    [centre, points]
  );

  const featureName = area.name.trim().toLowerCase();

  const isFlatOnly =
    FLAT_ROOF_IDS.has(area.id) ||
    featureName.includes("bazaar") ||
    featureName.includes("toilet") ||
    featureName.includes("fun fair") ||
    featureName.includes("central site");

  const isOpenSidedCanopy = OPEN_SIDED_CANOPY_IDS.has(area.id);

  const wallGeometry = useMemo(() => {
    if (!centre || localPoints.length < 3) {
      return null;
    }

    return createWallGeometry(
      localPoints,
      WALL_HEIGHT,
      isOpenSidedCanopy
    );
  }, [centre, localPoints, isOpenSidedCanopy]);

  const roofGeometry = useMemo(() => {
    if (!centre || localPoints.length < 3) {
      return null;
    }

    if (isFlatOnly || isOpenSidedCanopy) {
      return createFlatRoofGeometry(
        localPoints,
        isOpenSidedCanopy
          ? WALL_HEIGHT + 0.02
          : WALL_HEIGHT
      );
    }

    return (
      createGableRoofGeometry(
        localPoints,
        WALL_HEIGHT,
        ROOF_HEIGHT
      ) ?? createFlatRoofGeometry(localPoints, WALL_HEIGHT)
    );
  }, [centre, localPoints, isFlatOnly, isOpenSidedCanopy]);

  const postPositions = useMemo(
    () =>
      isOpenSidedCanopy
        ? createPostPositions(localPoints)
        : [],
    [isOpenSidedCanopy, localPoints]
  );

  if (!centre || !wallGeometry || !roofGeometry) {
    return null;
  }

  const colour =
    status ===
    "carpeting_completed"
      ? CARPETING_COMPLETED_PINK
      : STATUS_CONFIG[
          status
        ]?.colour ??
        STATUS_CONFIG
          .not_started
          .colour;

  const wallColour =
    new THREE.Color(
      colour
    ).getStyle();

  const roofColour =
    status ===
    "carpeting_completed"
      ? CARPETING_COMPLETED_PINK
      : new THREE.Color(
          colour
        )
          .clone()
          .offsetHSL(
            0,
            0.01,
            -0.025
          )
          .getStyle();

  const edgeColour =
    new THREE.Color(
      MARQUEE_EDGE
    )
      .lerp(
        new THREE.Color(
          colour
        ),
        0.22
      )
      .getStyle();

  const worldX = centre.x * MAP_SCALE;
  const worldZ = -centre.y * MAP_SCALE;

  const topY = isFlatOnly || isOpenSidedCanopy
    ? WALL_HEIGHT + FLAT_ROOF_THICKNESS + 0.02
    : WALL_HEIGHT + ROOF_HEIGHT;

  return (
    <group
      position={[worldX, 0, worldZ]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(area.id);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHovered(true);
      }}
      onPointerLeave={(event) => {
        event.stopPropagation();
        setHovered(false);
      }}
    >
      {hovered && (
        <HoverLabel3D
          text={area.name}
          position={[
            0,
            topY + 0.95,
            0,
          ]}
        />
      )}
      <mesh geometry={wallGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={wallColour}
          roughness={
            status ===
            "carpeting_completed"
              ? 0.58
              : 0.68
          }
          metalness={0.02}
          clearcoat={
            status ===
            "carpeting_completed"
              ? 0.04
              : 0.16
          }
          clearcoatRoughness={0.82}
          emissive={
            status ===
            "carpeting_completed"
              ? "#831843"
              : "#000000"
          }
          emissiveIntensity={
            status ===
            "carpeting_completed"
              ? 0.12
              : 0
          }
          opacity={status === "not_started" ? 0.72 : 0.96}
          transparent
          side={THREE.DoubleSide}
        />

        <Edges
          threshold={28}
          color={edgeColour}
        />
      </mesh>

      <mesh geometry={roofGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={roofColour}
          roughness={
            status ===
            "carpeting_completed"
              ? 0.54
              : 0.5
          }
          metalness={0}
          clearcoat={
            status ===
            "carpeting_completed"
              ? 0.03
              : 0.22
          }
          clearcoatRoughness={0.7}
          sheen={
            status ===
            "carpeting_completed"
              ? 0
              : 0.12
          }
          sheenRoughness={0.82}
          emissive={
            status ===
            "carpeting_completed"
              ? "#831843"
              : "#000000"
          }
          emissiveIntensity={
            status ===
            "carpeting_completed"
              ? 0.1
              : 0
          }
          side={THREE.DoubleSide}
        />

        <Edges
          threshold={24}
          color={edgeColour}
        />
      </mesh>

      {isOpenSidedCanopy &&
        postPositions.map((post, index) => (
          <mesh
            key={`${area.id}-post-${index}`}
            position={[post.x, WALL_HEIGHT / 2, post.z]}
            castShadow
          >
            <boxGeometry args={[0.07, WALL_HEIGHT, 0.07]} />
            <meshPhysicalMaterial
              color="#72531B"
              roughness={0.62}
              metalness={0.08}
              clearcoat={0.12}
            />
          </mesh>
        ))}

      {selected && (
        <mesh
          position={[0, topY + 0.2, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.62, 0.8, 32]} />
          <meshBasicMaterial color="#FFFFFF" side={THREE.DoubleSide} />
        </mesh>
      )}

      {urgentCount > 0 && (
        <group position={[0, topY + 0.55, 0]}>
          <mesh>
            <sphereGeometry args={[0.18, 20, 20]} />
            <meshBasicMaterial color="#DC2626" />
          </mesh>

          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.75, 1.75, 1.75]}>
            <ringGeometry args={[0.15, 0.2, 32]} />
            <meshBasicMaterial
              color="#EF4444"
              side={THREE.DoubleSide}
              transparent
              opacity={0.72}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
