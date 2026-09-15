"use client";

import {
  Suspense,
  useMemo,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import {
  ContactShadows,
  Grid,
  OrbitControls,
} from "@react-three/drei";

import Generator3D from "@/components/map/three/Generator3D";
import Infrastructure3D from "@/components/map/three/Infrastructure3D";
import Marquee3D from "@/components/map/three/Marquee3D";
import SiteAreaFeature3D from "@/components/map/three/SiteAreaFeature3D";
import SiteEntranceDecor3D from "@/components/map/three/SiteEntranceDecor3D";
import TowerLight3D from "@/components/map/three/TowerLight3D";

import { infrastructureLines } from "@/data/infrastructureLines";
import { siteAreas } from "@/data/siteAreas";

import type { SiteGenerator } from "@/types/generators";
import type { SiteStatus } from "@/types/site";
import type { SiteTowerLight } from "@/types/towerLights";

const MAP_WIDTH = 2384;
const MAP_HEIGHT = 3370;
const MAP_SCALE = 0.02;

type NavigationMode = "rotate" | "pan";

interface Site3DMapProps {
  statuses?: Record<string, SiteStatus>;
  urgentTaskCounts?: Record<string, number>;
  generators?: SiteGenerator[];
  lights?: SiteTowerLight[];
  selectedAreaId?: string | null;
  selectedGeneratorId?: string | null;
  selectedLightId?: string | null;
  onSelectArea?: (areaId: string) => void;
  onSelectGenerator?: (generatorId: string) => void;
  onSelectLight?: (lightId: string) => void;
}

const MARQUEES = siteAreas.filter(
  (area) => area.type === "marquee"
);

const OTHER_SITE_AREAS = siteAreas.filter(
  (area) =>
    area.type !== "marquee" &&
    area.type !== "metal_tracking" &&
    area.type !== "rubber_tracking" &&
    area.type !== "fence"
);


/*
 * Polygon-based tracking areas such as Pad 1 and Pad 2.
 *
 * They live in siteAreas.ts rather than infrastructureLines.ts,
 * so they need their own render pass in the 3D scene.
 */
const TRACKING_POLYGON_AREAS = siteAreas.filter(
  (area) =>
    area.type === "metal_tracking" ||
    area.type === "rubber_tracking"
);

export default function Site3DMap({
  statuses,
  urgentTaskCounts,
  generators = [],
  lights = [],
  selectedAreaId: controlledSelectedAreaId,
  selectedGeneratorId: controlledSelectedGeneratorId,
  selectedLightId: controlledSelectedLightId,
  onSelectArea,
  onSelectGenerator,
  onSelectLight,
}: Site3DMapProps) {
  const [
    navigationMode,
    setNavigationMode,
  ] = useState<NavigationMode>("rotate");

  const [internalSelectedAreaId, setInternalSelectedAreaId] =
    useState<string | null>(null);

  const [
    internalSelectedGeneratorId,
    setInternalSelectedGeneratorId,
  ] = useState<string | null>(null);

  const [internalSelectedLightId, setInternalSelectedLightId] =
    useState<string | null>(null);

  const selectedAreaId =
    controlledSelectedAreaId !== undefined
      ? controlledSelectedAreaId
      : internalSelectedAreaId;

  const selectedGeneratorId =
    controlledSelectedGeneratorId !== undefined
      ? controlledSelectedGeneratorId
      : internalSelectedGeneratorId;

  const selectedLightId =
    controlledSelectedLightId !== undefined
      ? controlledSelectedLightId
      : internalSelectedLightId;

  const worldWidth = MAP_WIDTH * MAP_SCALE;
  const worldHeight = MAP_HEIGHT * MAP_SCALE;

  const mapCentre = useMemo(
    () => ({
      x: worldWidth / 2,
      z: -worldHeight / 2,
    }),
    [worldWidth, worldHeight]
  );

  function handleSelectArea(areaId: string) {
    if (controlledSelectedAreaId === undefined) {
      setInternalSelectedAreaId(areaId);
    }

    if (controlledSelectedGeneratorId === undefined) {
      setInternalSelectedGeneratorId(null);
    }

    if (controlledSelectedLightId === undefined) {
      setInternalSelectedLightId(null);
    }

    onSelectArea?.(areaId);
  }

  function handleSelectGenerator(generatorId: string) {
    if (controlledSelectedGeneratorId === undefined) {
      setInternalSelectedGeneratorId(generatorId);
    }

    if (controlledSelectedAreaId === undefined) {
      setInternalSelectedAreaId(null);
    }

    if (controlledSelectedLightId === undefined) {
      setInternalSelectedLightId(null);
    }

    onSelectGenerator?.(generatorId);
  }

  function handleSelectLight(lightId: string) {
    if (controlledSelectedLightId === undefined) {
      setInternalSelectedLightId(lightId);
    }

    if (controlledSelectedAreaId === undefined) {
      setInternalSelectedAreaId(null);
    }

    if (controlledSelectedGeneratorId === undefined) {
      setInternalSelectedGeneratorId(null);
    }

    onSelectLight?.(lightId);
  }

  function clearSelection() {
    if (controlledSelectedAreaId === undefined) {
      setInternalSelectedAreaId(null);
    }

    if (controlledSelectedGeneratorId === undefined) {
      setInternalSelectedGeneratorId(null);
    }

    if (controlledSelectedLightId === undefined) {
      setInternalSelectedLightId(null);
    }
  }

  return (
    <div className="relative h-full min-h-[640px] w-full overflow-hidden bg-slate-100">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{
          position: [
            mapCentre.x + 18,
            42,
            mapCentre.z + 48,
          ],
          fov: 42,
          near: 0.1,
          far: 500,
        }}
        onPointerMissed={clearSelection}
      >
        {/* very very light green/yellow overall background */}
        <color
          attach="background"
          args={["#F4F5E8"]}
        />

        <ambientLight intensity={0.66} />

        <hemisphereLight
          intensity={0.58}
          color="#FFFDF5"
          groundColor="#DDE3C9"
        />

        <directionalLight
          castShadow
          intensity={1.48}
          position={[
            mapCentre.x - 18,
            62,
            mapCentre.z + 20,
          ]}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={180}
          shadow-camera-left={-70}
          shadow-camera-right={70}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />

        <Suspense fallback={null}>
          {/* clean flat plane - no texture */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[mapCentre.x, -0.04, mapCentre.z]}
            receiveShadow
          >
            <planeGeometry
              args={[worldWidth, worldHeight]}
            />
            <meshPhysicalMaterial
              color="#EEF1D7"
              roughness={0.94}
              metalness={0}
              clearcoat={0.02}
            />
          </mesh>

          <Grid
            position={[mapCentre.x, 0, mapCentre.z]}
            args={[worldWidth, worldHeight]}
            cellSize={1}
            cellThickness={0.24}
            sectionSize={5}
            sectionThickness={0.48}
            cellColor="#E1E5CB"
            sectionColor="#D2D8B7"
            fadeDistance={88}
            fadeStrength={1}
            infiniteGrid={false}
          />

          <ContactShadows
            position={[
              mapCentre.x,
              0.015,
              mapCentre.z,
            ]}
            opacity={0.22}
            scale={86}
            blur={2.6}
            far={22}
            resolution={1024}
            color="#334155"
          />

          {/* horizontal mirror so 3D matches 2D map orientation */}
          <group
            position={[worldWidth, 0, 0]}
            scale={[-1, 1, 1]}
          >
            {MARQUEES.map((area) => {
              const status =
                statuses?.[area.id] ?? area.status;

              return (
                <Marquee3D
                  key={area.id}
                  area={area}
                  status={status}
                  selected={selectedAreaId === area.id}
                  urgentCount={
                    urgentTaskCounts?.[area.id] ?? 0
                  }
                  onSelect={handleSelectArea}
                />
              );
            })}

            {OTHER_SITE_AREAS.map((area) => {
              const status =
                statuses?.[area.id] ?? area.status;

              return (
                <SiteAreaFeature3D
                  key={area.id}
                  area={area}
                  status={status}
                  selected={selectedAreaId === area.id}
                  urgentCount={
                    urgentTaskCounts?.[area.id] ?? 0
                  }
                  onSelect={handleSelectArea}
                />
              );
            })}

            {TRACKING_POLYGON_AREAS.map((area) => {
              const status =
                statuses?.[area.id] ?? area.status;

              return (
                <SiteAreaFeature3D
                  key={area.id}
                  area={area}
                  status={status}
                  selected={selectedAreaId === area.id}
                  urgentCount={
                    urgentTaskCounts?.[area.id] ?? 0
                  }
                  onSelect={handleSelectArea}
                />
              );
            })}

            {infrastructureLines.map((line) => {
              const status =
                statuses?.[line.id] ?? line.status;

              return (
                <Infrastructure3D
                  key={line.id}
                  line={line}
                  status={status}
                  selected={selectedAreaId === line.id}
                  urgentCount={
                    urgentTaskCounts?.[line.id] ?? 0
                  }
                  onSelect={handleSelectArea}
                />
              );
            })}

            {generators.map((generator) => (
              <Generator3D
                key={generator.id}
                generator={generator}
                selected={
                  selectedGeneratorId === generator.id
                }
                onSelect={handleSelectGenerator}
              />
            ))}

            {lights.map((light) => (
              <TowerLight3D
                key={light.id}
                light={light}
                selected={selectedLightId === light.id}
                onSelect={handleSelectLight}
              />
            ))}

            {/* decorative site entrance + public road */}
            <SiteEntranceDecor3D />
          </group>
        </Suspense>

        <OrbitControls
          makeDefault
          target={[mapCentre.x, 0, mapCentre.z]}
          enableDamping
          dampingFactor={0.08}
          enableRotate={
            navigationMode === "rotate"
          }
          enablePan
          screenSpacePanning
          mouseButtons={{
            LEFT:
              navigationMode === "rotate"
                ? THREE.MOUSE.ROTATE
                : THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE:
              navigationMode === "rotate"
                ? THREE.TOUCH.ROTATE
                : THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
          minDistance={18}
          maxDistance={95}
          minPolarAngle={Math.PI * 0.16}
          maxPolarAngle={Math.PI * 0.47}
        />
      </Canvas>

      <div className="absolute bottom-3 right-3 z-40 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setNavigationMode("rotate")
            }
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              navigationMode === "rotate"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            aria-pressed={
              navigationMode === "rotate"
            }
          >
            Rotate
          </button>

          <button
            type="button"
            onClick={() =>
              setNavigationMode("pan")
            }
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              navigationMode === "pan"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            aria-pressed={
              navigationMode === "pan"
            }
          >
            Move
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-white/80 bg-white/88 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
        {navigationMode === "rotate"
          ? "Left-drag to rotate · Right-drag to move · Scroll/pinch to zoom"
          : "Left-drag to move · Scroll/pinch to zoom"}
      </div>
    </div>
  );
}
