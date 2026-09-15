"use client";

import {
  Html,
} from "@react-three/drei";

import type {
  SiteGenerator,
} from "@/types/generators";

interface Generator3DProps {
  generator: SiteGenerator;
  selected?: boolean;
  onSelect?: (
    generatorId: string
  ) => void;
}

const MAP_SCALE = 0.02;

const GENERATOR_NAVY =
  "#6B1F2A";

const GENERATOR_NAVY_DARK =
  "#45131B";

const GENERATOR_METAL =
  "#374151";
const GENERATOR_VENT =
  "#111827";
const GENERATOR_TRIM =
  "#D6D3D1";

const DOWN_BLUE =
  "#2563EB";

export default function Generator3D({
  generator,
  selected = false,
  onSelect,
}: Generator3DProps) {
  const x =
    generator.x *
    MAP_SCALE;

  const z =
    -generator.y *
    MAP_SCALE;

  const isDown =
    Boolean(
      generator.is_down
    );

  return (
    <group
      position={[
        x,
        0,
        z,
      ]}
      onClick={(
        event
      ) => {
        event.stopPropagation();

        onSelect?.(
          generator.id
        );
      }}
    >
      {/* MAIN GENERATOR BODY */}
      <mesh
        position={[
          0,
          0.38,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            0.9,
            0.62,
            0.55,
          ]}
        />

        <meshStandardMaterial
          color={
            GENERATOR_NAVY
          }
          roughness={
            0.58
          }
          metalness={
            0.22
          }
        />
      </mesh>

      {/* FRONT PANEL */}
      <mesh
        position={[
          0.456,
          0.4,
          0,
        ]}
        rotation={[
          0,
          Math.PI / 2,
          0,
        ]}
      >
        <planeGeometry
          args={[
            0.38,
            0.38,
          ]}
        />

        <meshStandardMaterial
          color={
            GENERATOR_NAVY_DARK
          }
        />
      </mesh>

      {/* SMALL EXHAUST */}
      <mesh
        position={[
          -0.24,
          0.83,
          0.12,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            0.05,
            0.06,
            0.28,
            12,
          ]}
        />

        <meshStandardMaterial
          color="#334155"
          roughness={
            0.65
          }
          metalness={
            0.35
          }
        />
      </mesh>

      {/* SELECTED OUTLINE */}
      {selected && (
        <mesh
          position={[
            0,
            0.03,
            0,
          ]}
          rotation={[
            -Math.PI / 2,
            0,
            0,
          ]}
        >
          <ringGeometry
            args={[
              0.62,
              0.76,
              32,
            ]}
          />

          <meshBasicMaterial
            color="#FFFFFF"
          />
        </mesh>
      )}

      {/* GENERATOR DOWN WARNING */}
      {isDown && (
        <>
          {/*
           * Keep the generator itself navy.
           * The warning is blue, matching the current 2D behaviour.
           */}
          <mesh
            position={[
              0,
              1.18,
              0,
            ]}
          >
            <sphereGeometry
              args={[
                0.18,
                20,
                20,
              ]}
            />

            <meshBasicMaterial
              color={
                DOWN_BLUE
              }
            />
          </mesh>

          <mesh
            position={[
              0,
              0.06,
              0,
            ]}
            rotation={[
              -Math.PI / 2,
              0,
              0,
            ]}
          >
            <ringGeometry
              args={[
                0.78,
                0.91,
                40,
              ]}
            />

            <meshBasicMaterial
              color={
                DOWN_BLUE
              }
              transparent
              opacity={
                0.7
              }
            />
          </mesh>
        </>
      )}

      {/*
       * Drei Html keeps the generator name readable while
       * the actual object remains a proper Three.js model.
       */}
      <Html
        position={[
          0,
          1.02,
          0,
        ]}
        center
        distanceFactor={
          18
        }
        style={{
          pointerEvents:
            "none",
        }}
      >
        <div className="whitespace-nowrap rounded-md border border-slate-200 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-slate-800 shadow-sm">
          {generator.name}
          {" · "}
          {generator.kva}
          kVA
        </div>
      </Html>
    </group>
  );
}
