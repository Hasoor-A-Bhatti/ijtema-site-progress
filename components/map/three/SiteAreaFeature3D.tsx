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

interface SiteAreaFeature3DProps {
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

const PAD_IDS = new Set([
  "pad-1",
  "pad-2",
]);

const FLAT_COMPOUND_IDS = new Set([
  "central-site-area",
  "lajna-fun-fair",
  "lajna-toilets",
  "ansar-toilets",
  "ansar-toilets-2",
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
) {
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

function createShape(
  localPoints: Point3Plan[]
) {
  const shape = new THREE.Shape();

  ensureClockwise(localPoints).forEach(
    (point, index) => {
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

function createExtrudedGeometry(
  localPoints: Point3Plan[],
  height: number
) {
  const shape = createShape(localPoints);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  return geometry;
}

function createTopSlabGeometry(
  localPoints: Point3Plan[],
  y: number,
  thickness = 0.045
) {
  const shape = createShape(localPoints);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  geometry.computeVertexNormals();

  return geometry;
}

function getBounds(
  localPoints: Point3Plan[]
) {
  const xs = localPoints.map((point) => point.x);
  const zs = localPoints.map((point) => point.z);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}

export default function SiteAreaFeature3D({
  area,
  status,
  selected = false,
  urgentCount = 0,
  onSelect,
}: SiteAreaFeature3DProps) {
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

  const bounds = useMemo(
    () =>
      localPoints.length >= 3
        ? getBounds(localPoints)
        : null,
    [localPoints]
  );

  const featureName = area.name.trim().toLowerCase();

  const isWaterTank = featureName.includes("water tank");
  const isWaterWell = featureName.includes("water well");
  const isWaterMains = featureName.includes("water mains");
  const isPad = PAD_IDS.has(area.id);
  const isFlatCompound = FLAT_COMPOUND_IDS.has(area.id);
  const isToilet = featureName.includes("toilet");
  const isBazaar = featureName.includes("bazaar");
  const isFunFair = featureName.includes("fun fair");
  const isCabin = area.type === "cabin" && !isFlatCompound;
  const isServicePad = area.type === "service_pad";

  const structureHeight = isPad
    ? 0.08
    : isServicePad
      ? 0.08
      : isWaterMains
        ? 0.05
        : isFlatCompound || isToilet || isBazaar || isFunFair
          ? 0.16
          : isCabin
            ? 0.95
            : 0.34;

  const geometry = useMemo(
    () =>
      localPoints.length >= 3 &&
      !isWaterTank &&
      !isWaterWell
        ? createExtrudedGeometry(localPoints, structureHeight)
        : null,
    [localPoints, isWaterTank, isWaterWell, structureHeight]
  );

  const exactTopGeometry = useMemo(
    () =>
      localPoints.length >= 3 &&
      (
        isCabin ||
        isFlatCompound ||
        isToilet ||
        isBazaar ||
        isFunFair
      )
        ? createTopSlabGeometry(
            localPoints,
            structureHeight + 0.015
          )
        : null,
    [
      localPoints,
      isCabin,
      isFlatCompound,
      isToilet,
      isBazaar,
      isFunFair,
      structureHeight,
    ]
  );


  const padTopGeometry = useMemo(
    () =>
      localPoints.length >= 3 &&
      isPad
        ? createTopSlabGeometry(
            localPoints,
            structureHeight + 0.012,
            0.024
          )
        : null,
    [
      localPoints,
      isPad,
      structureHeight,
    ]
  );



  if (!centre || !bounds || points.length < 3) {
    return null;
  }

  const colour =
    STATUS_CONFIG[status]?.colour ??
    STATUS_CONFIG.not_started.colour;

  const worldX = centre.x * MAP_SCALE;
  const worldZ = -centre.y * MAP_SCALE;

  const tankRadius = Math.max(
    0.3,
    Math.min(bounds.width, bounds.depth) * 0.38
  );

  const wellRadius = Math.max(
    0.2,
    Math.min(bounds.width, bounds.depth) * 0.34
  );

  const highlightY = isWaterTank
    ? 1.95
    : isWaterWell
      ? 0.85
      : structureHeight + 0.35;

  const urgentY = isWaterTank
    ? 2.25
    : isWaterWell
      ? 1.05
      : structureHeight + 0.65;

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
            urgentY + 0.35,
            0,
          ]}
        />
      )}
      {isWaterTank && (
        <>
          <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[tankRadius, tankRadius, 1.55, 32]} />
            <meshPhysicalMaterial
              color={colour}
              roughness={0.36}
              metalness={0.28}
              clearcoat={0.28}
              clearcoatRoughness={0.52}
            />
          </mesh>

          <mesh position={[0, 1.58, 0]} castShadow>
            <cylinderGeometry args={[tankRadius * 0.96, tankRadius, 0.12, 32]} />
            <meshPhysicalMaterial
              color={colour}
              roughness={0.34}
              metalness={0.26}
              clearcoat={0.3}
              clearcoatRoughness={0.5}
            />
          </mesh>
        </>
      )}

      {isWaterWell && (
        <>
          <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[wellRadius, wellRadius, 0.44, 32]} />
            <meshPhysicalMaterial
              color={colour}
              roughness={0.62}
              clearcoat={0.12}
              clearcoatRoughness={0.78}
            />
          </mesh>

          <mesh position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[wellRadius * 0.55, wellRadius * 0.92, 32]} />
            <meshPhysicalMaterial
              color="#475569"
              roughness={0.46}
              metalness={0.22}
              clearcoat={0.18}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}

      {!isWaterTank && !isWaterWell && geometry && (
        <mesh geometry={geometry} castShadow={structureHeight > 0.1} receiveShadow>
          <meshPhysicalMaterial
            color={colour}
            roughness={
              isPad
                ? 0.42
                : isCabin
                  ? 0.5
                  : 0.72
            }
            metalness={
              isPad
                ? 0.2
                : isCabin
                  ? 0.06
                  : 0
            }
            clearcoat={
              isPad
                ? 0.18
                : isCabin
                  ? 0.16
                  : 0.08
            }
            clearcoatRoughness={0.72}
            opacity={status === "not_started" ? 0.75 : 0.96}
            transparent
          />

          {structureHeight > 0.1 && (
            <Edges
              threshold={28}
              color="#64748B"
            />
          )}
        </mesh>
      )}

      {isCabin &&
        exactTopGeometry && (
          <mesh
            geometry={exactTopGeometry}
            castShadow
            receiveShadow
          >
            <meshPhysicalMaterial
              color={
                area.id === "amoomi-command-centre"
                  ? colour
                  : "#E2E8F0"
              }
              roughness={0.54}
              metalness={0.02}
              clearcoat={0.14}
              clearcoatRoughness={0.78}
              side={THREE.DoubleSide}
            />

            <Edges
              threshold={28}
              color="#94A3B8"
            />
          </mesh>
        )}

      {isPad &&
        padTopGeometry && (
          <mesh
            geometry={padTopGeometry}
            receiveShadow
          >
            <meshPhysicalMaterial
              color={colour}
              roughness={0.36}
              metalness={0.24}
              clearcoat={0.18}
              clearcoatRoughness={0.62}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

      {(isFlatCompound ||
        isToilet ||
        isBazaar ||
        isFunFair) &&
        !isPad &&
        exactTopGeometry && (
          <mesh
            geometry={exactTopGeometry}
            receiveShadow
          >
            <meshPhysicalMaterial
              color={colour}
              roughness={0.72}
              clearcoat={0.06}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

      {selected && (
        <mesh position={[0, highlightY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.52, 32]} />
          <meshBasicMaterial color="#FFFFFF" side={THREE.DoubleSide} />
        </mesh>
      )}

      {urgentCount > 0 && (
        <group position={[0, urgentY, 0]}>
          <mesh>
            <sphereGeometry args={[0.18, 20, 20]} />
            <meshBasicMaterial color="#DC2626" />
          </mesh>

          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.7, 1.7, 1.7]}>
            <ringGeometry args={[0.17, 0.21, 32]} />
            <meshBasicMaterial color="#EF4444" transparent opacity={0.72} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}
