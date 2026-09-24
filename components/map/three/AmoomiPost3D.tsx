"use client";

import {
  Html,
} from "@react-three/drei";
import {
  useFrame,
} from "@react-three/fiber";
import {
  useRef,
} from "react";
import * as THREE from "three";

import type {
  AmoomiPost,
} from "@/components/map/AmoomiLayer";

interface AmoomiPost3DProps {
  post: AmoomiPost;
  selected?: boolean;
  hideLabels?: boolean;
  onSelect?: (
    postId: string
  ) => void;
}

const MAP_SCALE = 0.02;

const GOLD = "#D4AF37";
const GOLD_DARK = "#8A6A12";
const BLACK = "#111111";
const BLACK_DARK = "#050505";
const BREACH_RED = "#7F1D1D";

function getMarkerLabel(
  name: string
) {
  const trimmed =
    name.trim();

  const gate =
    trimmed.match(
      /^Gate\s+(\d+)/i
    );

  if (gate) {
    return `G${gate[1]}`;
  }

  const post =
    trimmed.match(
      /^Post\s+(\d+)/i
    );

  if (post) {
    return `P${post[1]}`;
  }

  const response =
    trimmed.match(
      /^Response\s+(\d+)/i
    );

  if (response) {
    return `R${response[1]}`;
  }

  return trimmed
    .slice(0, 3)
    .toUpperCase();
}


function SecurityBreachPulse3D() {
  const ringRef =
    useRef<THREE.Mesh>(
      null
    );

  const glowRef =
    useRef<THREE.Mesh>(
      null
    );

  useFrame(
    ({ clock }) => {
      const t =
        clock.getElapsedTime();

      const pulse =
        (Math.sin(
          t * 7
        ) +
          1) /
        2;

      if (
        ringRef.current
      ) {
        const scale =
          0.95 +
          pulse * 0.65;

        ringRef.current.scale.set(
          scale,
          scale,
          scale
        );

        const material =
          ringRef.current
            .material as
            THREE.MeshBasicMaterial;

        material.opacity =
          0.92 -
          pulse * 0.58;
      }

      if (
        glowRef.current
      ) {
        const scale =
          0.85 +
          pulse * 0.48;

        glowRef.current.scale.set(
          scale,
          scale,
          scale
        );

        const material =
          glowRef.current
            .material as
            THREE.MeshBasicMaterial;

        material.opacity =
          0.48 -
          pulse * 0.22;
      }
    }
  );

  return (
    <>
      <mesh
        ref={glowRef}
        position={[
          0,
          0.025,
          0,
        ]}
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
      >
        <circleGeometry
          args={[
            1.08,
            48,
          ]}
        />

        <meshBasicMaterial
          color="#450A0A"
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>

      <mesh
        ref={ringRef}
        position={[
          0,
          0.035,
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
            0.76,
            1.12,
            48,
          ]}
        />

        <meshBasicMaterial
          color="#7F1D1D"
          transparent
          opacity={0.86}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

export default function AmoomiPost3D({
  post,
  selected = false,
  hideLabels = false,
  onSelect,
}: AmoomiPost3DProps) {
  const securityBreach =
    post.urgentMessages.some(
      (message) =>
        !message.resolved &&
        message.incident_type ===
          "security_breach"
    );



  if (
    post.x === null ||
    post.y === null
  ) {
    return null;
  }

  const mapX =
    Number(post.x);

  const mapY =
    Number(post.y);

  if (
    !Number.isFinite(
      mapX
    ) ||
    !Number.isFinite(
      mapY
    )
  ) {
    return null;
  }

  const x =
    mapX *
    MAP_SCALE;

  const z =
    -mapY *
    MAP_SCALE;

  const isResponse =
    post.name
      .trim()
      .toLowerCase()
      .startsWith(
        "response "
      );

  const urgent =
    post.unresolvedUrgentCount >
    0;

  const bodyColour =
    isResponse
      ? BLACK
      : GOLD;

  const sideColour =
    isResponse
      ? BLACK_DARK
      : GOLD_DARK;

  const labelColour =
    isResponse
      ? "#FACC15"
      : "#111827";



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
          post.id
        );
      }}
    >
      {/* Ground base */}
      <mesh
        position={[
          0,
          0.08,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            selected
              ? 0.94
              : 0.82,
            0.16,
            selected
              ? 0.94
              : 0.82,
          ]}
        />

        <meshStandardMaterial
          color={
            sideColour
          }
          roughness={0.58}
          metalness={0.18}
        />
      </mesh>

      {/* Main security-post block */}
      <mesh
        position={[
          0,
          0.34,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            selected
              ? 0.72
              : 0.64,
            0.42,
            selected
              ? 0.72
              : 0.64,
          ]}
        />

        <meshStandardMaterial
          color={
            bodyColour
          }
          roughness={0.48}
          metalness={0.12}
        />
      </mesh>

      {/* Gold top plate */}
      <mesh
        position={[
          0,
          0.57,
          0,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            0.68,
            0.06,
            0.68,
          ]}
        />

        <meshStandardMaterial
          color={GOLD}
          roughness={0.38}
          metalness={0.28}
        />
      </mesh>

      {/* Selection ring */}
      {selected && (
        <mesh
          position={[
            0,
            0.025,
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
              0.58,
              0.73,
              32,
            ]}
          />

          <meshBasicMaterial
            color="#FFFFFF"
          />
        </mesh>
      )}

      {/* Normal urgent warning */}
      {urgent &&
        !securityBreach && (
        <mesh
          position={[
            0,
            0.9,
            0,
          ]}
        >
          <sphereGeometry
            args={[
              0.12,
              18,
              18,
            ]}
          />

          <meshStandardMaterial
            color="#DC2626"
            emissive="#991B1B"
            emissiveIntensity={
              1.6
            }
          />
        </mesh>
      )}

      {/* Security breach: deliberately much more prominent */}
      {securityBreach && (
        <>
          <mesh
            position={[
              0,
              1.02,
              0,
            ]}
          >
            <sphereGeometry
              args={[
                0.19,
                20,
                20,
              ]}
            />

            <meshStandardMaterial
              color={
                BREACH_RED
              }
              emissive="#450A0A"
              emissiveIntensity={
                3.6
              }
            />
          </mesh>

          <pointLight
            position={[
              0,
              1.05,
              0,
            ]}
            color="#991B1B"
            intensity={2.8}
            distance={4.5}
            decay={2}
          />

          <SecurityBreachPulse3D />
        </>
      )}

      {/* Officer count */}
      {!hideLabels &&
        post.officers.length >
          0 && (
        <Html
          position={[
            0.42,
            0.78,
            0,
          ]}
          center
          distanceFactor={
            18
          }
          transform
          sprite
          style={{
            pointerEvents:
              "none",
          }}
        >
          <div className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-emerald-600 px-1 text-[9px] font-black text-white shadow">
            {
              post.officers.length
            }
          </div>
        </Html>
      )}

      {/* Post label */}
      {!hideLabels && (
      <Html
        position={[
          0,
          securityBreach
            ? 1.48
            : 1.1,
          0,
        ]}
        center
        distanceFactor={17}
        transform
        sprite
        style={{
          pointerEvents:
            "none",
        }}
      >
        <div
          className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[9px] font-black shadow ${
            securityBreach
              ? "border-red-900 bg-red-950 text-white"
              : isResponse
                ? "border-amber-400 bg-black text-amber-300"
                : "border-slate-950 bg-amber-400 text-slate-950"
          }`}
        >
          {
            securityBreach
              ? `BREACH • ${getMarkerLabel(
                  post.name
                )}`
              : getMarkerLabel(
                  post.name
                )
          }
        </div>
      </Html>
      )}

      {/* tiny top-face identifier */}
      {!hideLabels && (
      <Html
        position={[
          0,
          0.61,
          0,
        ]}
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        center
        transform
        distanceFactor={
          14
        }
        style={{
          pointerEvents:
            "none",
          color:
            labelColour,
          fontWeight:
            900,
          fontSize:
            "7px",
        }}
      >
        {
          getMarkerLabel(
            post.name
          )
        }
      </Html>
      )}
    </group>
  );
}
