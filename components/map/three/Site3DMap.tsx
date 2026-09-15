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
  Stars,
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

export type SceneMode =
  | "day"
  | "night";

interface Site3DMapProps {
  sceneMode?: SceneMode;
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
  sceneMode = "day",
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

  const isNight =
    sceneMode === "night";

  const sceneBackground =
    isNight
      ? "#06111F"
      : "#F4F5E8";

  const groundColour =
    isNight
      ? "#172235"
      : "#EEF1D7";

  const gridCellColour =
    isNight
      ? "#24364D"
      : "#E1E5CB";

  const gridSectionColour =
    isNight
      ? "#35506B"
      : "#D2D8B7";

  return (
    <div
      className={`relative h-full min-h-[640px] w-full overflow-hidden ${
        isNight
          ? "bg-slate-950"
          : "bg-slate-100"
      }`}
    >
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
        <color
          attach="background"
          args={[sceneBackground]}
        />

        {isNight && (
          <Stars
            radius={115}
            depth={48}
            count={950}
            factor={2.2}
            saturation={0.08}
            fade
            speed={0.16}
          />
        )}

        <ambientLight
          intensity={
            isNight
              ? 0.34
              : 0.66
          }
          color={
            isNight
              ? "#A9C7FF"
              : "#FFFFFF"
          }
        />

        <hemisphereLight
          intensity={
            isNight
              ? 0.42
              : 0.58
          }
          color={
            isNight
              ? "#88AEEF"
              : "#FFFDF5"
          }
          groundColor={
            isNight
              ? "#101927"
              : "#DDE3C9"
          }
        />

        <directionalLight
          castShadow
          intensity={
            isNight
              ? 0.72
              : 1.48
          }
          color={
            isNight
              ? "#AFCBFF"
              : "#FFFFFF"
          }
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

        {isNight && (
          <>
            {/* Broad site illumination — warm flood lighting without
                flattening the night-time atmosphere. */}
            <pointLight
              position={[
                mapCentre.x - 14,
                12,
                mapCentre.z - 16,
              ]}
              intensity={78}
              distance={34}
              decay={2}
              color="#FFD58A"
            />

            <pointLight
              position={[
                mapCentre.x + 13,
                13,
                mapCentre.z - 2,
              ]}
              intensity={86}
              distance={36}
              decay={2}
              color="#FFE2A8"
            />

            <pointLight
              position={[
                mapCentre.x - 11,
                12,
                mapCentre.z + 17,
              ]}
              intensity={74}
              distance={33}
              decay={2}
              color="#FFD08A"
            />

            <pointLight
              position={[
                mapCentre.x + 14,
                12,
                mapCentre.z + 24,
              ]}
              intensity={72}
              distance={32}
              decay={2}
              color="#FFE0A0"
            />

            {/* A very soft cool fill keeps distant structures readable. */}
            <pointLight
              position={[
                mapCentre.x,
                28,
                mapCentre.z,
              ]}
              intensity={62}
              distance={72}
              decay={2}
              color="#6EA8FF"
            />
          </>
        )}

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
              color={groundColour}
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
            cellColor={gridCellColour}
            sectionColor={gridSectionColour}
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
            opacity={
              isNight
                ? 0.34
                : 0.22
            }
            scale={86}
            blur={2.6}
            far={22}
            resolution={1024}
            color={
              isNight
                ? "#020617"
                : "#334155"
            }
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
