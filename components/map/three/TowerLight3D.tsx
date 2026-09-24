"use client";

import { Html } from "@react-three/drei";
import * as THREE from "three";

import type {
  SiteTowerLight,
} from "@/types/towerLights";

interface TowerLight3DProps {
  light: SiteTowerLight;
  selected?: boolean;
  sceneMode?: "day" | "night";
  onSelect?: (
    lightId: string
  ) => void;
}

const MAP_SCALE = 0.02;

const MAST_HEIGHT = 3.5;
const BASE_HEIGHT = 0.15;

const MAST_COLOUR = "#374151";
const BASE_COLOUR = "#1F2937";

const LIGHT_ON = "#FACC15";
const LIGHT_OFF = "#FDE68A";
const LIGHT_DOWN = "#EF4444";

const TRAILER_METAL = "#475569";
const TRAILER_DARK = "#1F2937";
const TYRE_COLOUR = "#111827";
const RIM_COLOUR = "#94A3B8";
const JACK_COLOUR = "#64748B";

/*
 * Night-time tower-light coverage.
 *
 * Because the visible tower model is scaled to 85%, the geometry
 * radius is slightly larger so the final world-space illuminated
 * radius is approximately 5.5 map units.
 *
 * Increase/decrease LIGHT_COVERAGE_RADIUS if you later want to model
 * a different real-world throw distance.
 */
const LIGHT_COVERAGE_RADIUS = 8.0;
const LIGHT_COVERAGE_COLOUR = "#FFE7A3";

export default function TowerLight3D({
  light,
  selected = false,
  sceneMode = "day",
  onSelect,
}: TowerLight3DProps) {
  /*
   * Tower-light coordinates can arrive from Supabase
   * as numbers OR numeric strings.
   */
  const mapX =
    Number(light.x);

  const mapY =
    Number(light.y);

  if (
    !Number.isFinite(mapX) ||
    !Number.isFinite(mapY)
  ) {
    return null;
  }

  const x =
    mapX *
    MAP_SCALE;

  const z =
    -mapY *
    MAP_SCALE;

  const isOn =
    light.status ===
    "on";

  const isDown =
    light.status ===
    "down";

  const lampColour =
    isDown
      ? LIGHT_DOWN
      : isOn
        ? LIGHT_ON
        : LIGHT_OFF;

  const showNightCoverage =
    sceneMode === "night" &&
    isOn;

  return (
    <group
      position={[
        x,
        0,
        z,
      ]}
      scale={[
        0.85,
        0.85,
        0.85,
      ]}
      onClick={(
        event
      ) => {
        event.stopPropagation();

        onSelect?.(
          light.id
        );
      }}
    >
      {showNightCoverage && (
        <>
          {/*
           * Ground illumination pool.
           * This is deliberately a soft radial gradient rather than
           * a hard circle, so overlapping tower lights naturally
           * show where coverage is strong and where dark gaps remain.
           */}
          <mesh
            position={[
              0,
              0.028,
              0,
            ]}
            rotation={[
              -Math.PI / 2,
              0,
              0,
            ]}
            raycast={() =>
              null
            }
            renderOrder={2}
          >
            <circleGeometry
              args={[
                LIGHT_COVERAGE_RADIUS,
                72,
              ]}
            />

            <shaderMaterial
              transparent
              depthWrite={false}
              blending={
                THREE.AdditiveBlending
              }
              uniforms={{
                uColour: {
                  value:
                    new THREE.Color(
                      LIGHT_COVERAGE_COLOUR
                    ),
                },
                uOpacity: {
                  value: 0.48,
                },
              }}
              vertexShader={`
                varying vec2 vUv;

                void main() {
                  vUv = uv;

                  gl_Position =
                    projectionMatrix *
                    modelViewMatrix *
                    vec4(
                      position,
                      1.0
                    );
                }
              `}
              fragmentShader={`
                uniform vec3 uColour;
                uniform float uOpacity;

                varying vec2 vUv;

                void main() {
                  float distanceFromCentre =
                    distance(
                      vUv,
                      vec2(0.5)
                    ) * 2.0;

                  float softEdge =
                    1.0 -
                    smoothstep(
                      0.12,
                      1.0,
                      distanceFromCentre
                    );

                  float brightCore =
                    1.0 -
                    smoothstep(
                      0.0,
                      0.42,
                      distanceFromCentre
                    );

                  float alpha =
                    (
                      softEdge * 0.58 +
                      brightCore * 0.42
                    ) *
                    uOpacity;

                  gl_FragColor =
                    vec4(
                      uColour,
                      alpha
                    );
                }
              `}
            />
          </mesh>

          {/*
           * Actual 3D light source. This makes nearby marquees,
           * tracking and infrastructure receive warm light, while
           * the coverage disc makes the operational footprint easy
           * to assess from above.
           */}
          <pointLight
            position={[
              0,
              MAST_HEIGHT + 0.2,
              0,
            ]}
            color="#FFF0C2"
            intensity={34}
            distance={
              LIGHT_COVERAGE_RADIUS *
              1.08
            }
            decay={2}
          />
        </>
      )}

      {/* MOBILE TRAILER CHASSIS */}
      <mesh
        position={[0, 0.13, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[1.25, 0.18, 0.78]}
        />
        <meshPhysicalMaterial
          color={TRAILER_METAL}
          roughness={0.46}
          metalness={0.42}
          clearcoat={0.16}
          clearcoatRoughness={0.56}
        />
      </mesh>

      {/* ENGINE / POWER HOUSING */}
      <mesh
        position={[0, 0.48, 0.05]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[0.82, 0.5, 0.58]}
        />
        <meshPhysicalMaterial
          color={TRAILER_DARK}
          roughness={0.5}
          metalness={0.24}
          clearcoat={0.14}
          clearcoatRoughness={0.6}
        />
      </mesh>

      {/* ENGINE VENT PANEL */}
      <mesh
        position={[0, 0.48, -0.252]}
      >
        <boxGeometry
          args={[0.52, 0.28, 0.035]}
        />
        <meshStandardMaterial
          color="#374151"
          roughness={0.58}
          metalness={0.28}
        />
      </mesh>

      {/* VENT SLATS */}
      {[-0.18, -0.09, 0, 0.09, 0.18].map(
        (offset, index) => (
          <mesh
            key={`${light.id}-tower-vent-${index}`}
            position={[offset, 0.48, -0.275]}
          >
            <boxGeometry
              args={[0.035, 0.2, 0.015]}
            />
            <meshStandardMaterial
              color="#9CA3AF"
              roughness={0.48}
              metalness={0.46}
            />
          </mesh>
        )
      )}

      {/* AXLE */}
      <mesh
        position={[0, 0.16, 0.02]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <cylinderGeometry
          args={[0.055, 0.055, 1.48, 12]}
        />
        <meshStandardMaterial
          color="#374151"
          roughness={0.5}
          metalness={0.52}
        />
      </mesh>

      {/* WHEELS */}
      {[-0.72, 0.72].map(
        (wheelX, index) => (
          <group
            key={`${light.id}-wheel-${index}`}
            position={[wheelX, 0.18, 0.02]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <mesh castShadow>
              <cylinderGeometry
                args={[0.22, 0.22, 0.12, 20]}
              />
              <meshStandardMaterial
                color={TYRE_COLOUR}
                roughness={0.88}
              />
            </mesh>

            <mesh>
              <cylinderGeometry
                args={[0.095, 0.095, 0.125, 16]}
              />
              <meshPhysicalMaterial
                color={RIM_COLOUR}
                roughness={0.36}
                metalness={0.62}
              />
            </mesh>
          </group>
        )
      )}

      {/* TOW BAR */}
      <mesh
        position={[0, 0.16, 0.72]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
      >
        <cylinderGeometry
          args={[0.045, 0.045, 0.92, 10]}
        />
        <meshStandardMaterial
          color={TRAILER_METAL}
          roughness={0.48}
          metalness={0.48}
        />
      </mesh>

      {/* TOW HITCH */}
      <mesh
        position={[0, 0.16, 1.17]}
        castShadow
      >
        <sphereGeometry
          args={[0.085, 14, 14]}
        />
        <meshPhysicalMaterial
          color={RIM_COLOUR}
          roughness={0.32}
          metalness={0.68}
        />
      </mesh>

      {/* STABILISER LEGS */}
      {[
        [-0.48, 0.1, -0.48],
        [0.48, 0.1, -0.48],
        [-0.48, 0.1, 0.44],
        [0.48, 0.1, 0.44],
      ].map((position, index) => (
        <group
          key={`${light.id}-jack-${index}`}
          position={
            position as [
              number,
              number,
              number
            ]
          }
        >
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry
              args={[0.06, 0.28, 0.06]}
            />
            <meshStandardMaterial
              color={JACK_COLOUR}
              roughness={0.48}
              metalness={0.44}
            />
          </mesh>

          <mesh position={[0, -0.1, 0]}>
            <boxGeometry
              args={[0.17, 0.035, 0.17]}
            />
            <meshStandardMaterial
              color="#374151"
              roughness={0.62}
              metalness={0.26}
            />
          </mesh>
        </group>
      ))}

      {/* LARGE BASE */}
      <mesh
        position={[
          0,
          BASE_HEIGHT /
            2,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry
          args={[
            0.72,
            BASE_HEIGHT,
            0.72,
          ]}
        />

        <meshPhysicalMaterial
          color={BASE_COLOUR}
          roughness={0.46}
          metalness={0.32}
          clearcoat={0.16}
          clearcoatRoughness={0.6}
        />
      </mesh>

      {/* MAIN TELESCOPIC MAST */}
      <mesh
        position={[
          0,
          BASE_HEIGHT +
            MAST_HEIGHT /
              2,
          0,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            0.075,
            0.11,
            MAST_HEIGHT,
            12,
          ]}
        />

        <meshPhysicalMaterial
          color={MAST_COLOUR}
          roughness={0.34}
          metalness={0.62}
          clearcoat={0.18}
          clearcoatRoughness={0.5}
        />
      </mesh>

      {/* UPPER MAST SECTION */}
      <mesh
        position={[
          0,
          BASE_HEIGHT +
            MAST_HEIGHT -
            0.1,
          0,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            0.055,
            0.065,
            0.85,
            12,
          ]}
        />

        <meshPhysicalMaterial
          color="#4B5563"
          roughness={0.3}
          metalness={0.65}
          clearcoat={0.18}
          clearcoatRoughness={0.48}
        />
      </mesh>

      {/* TELESCOPIC MAST COLLARS */}
      {[0.95, 1.8, 2.62].map(
        (height, index) => (
          <mesh
            key={`${light.id}-mast-collar-${index}`}
            position={[
              0,
              BASE_HEIGHT + height,
              0,
            ]}
          >
            <cylinderGeometry
              args={[0.1, 0.1, 0.08, 12]}
            />
            <meshPhysicalMaterial
              color="#9CA3AF"
              roughness={0.34}
              metalness={0.62}
            />
          </mesh>
        )
      )}

      {/* FLOODLIGHT CROSS BAR */}
      <mesh
        position={[
          0,
          BASE_HEIGHT +
            MAST_HEIGHT +
            0.38,
          0,
        ]}
        castShadow
      >
        <boxGeometry
          args={[
            1.18,
            0.11,
            0.13,
          ]}
        />

        <meshPhysicalMaterial
          color="#374151"
          roughness={0.36}
          metalness={0.52}
          clearcoat={0.16}
          clearcoatRoughness={0.52}
        />
      </mesh>

      {/* FOUR FLOODLIGHT HEADS */}
      {[
        -0.42,
        -0.14,
        0.14,
        0.42,
      ].map(
        (
          offset,
          index
        ) => (
          <group
            key={
              `${light.id}-lamp-${index}`
            }
            position={[
              offset,
              BASE_HEIGHT +
                MAST_HEIGHT +
                0.34,
              -0.12,
            ]}
            rotation={[
              -0.22,
              0,
              0,
            ]}
          >
            <mesh
              castShadow
            >
              <boxGeometry
                args={[
                  0.22,
                  0.22,
                  0.12,
                ]}
              />

              <meshPhysicalMaterial
                color="#4B5563"
                roughness={0.36}
                metalness={0.5}
                clearcoat={0.14}
                clearcoatRoughness={0.52}
              />
            </mesh>

            {/* FLOODLIGHT VISOR */}
            <mesh
              position={[0, 0.105, -0.02]}
            >
              <boxGeometry
                args={[0.24, 0.04, 0.16]}
              />
              <meshStandardMaterial
                color="#1F2937"
                roughness={0.46}
                metalness={0.36}
              />
            </mesh>

            {/* BRIGHT LAMP FACE */}
            <mesh
              position={[
                0,
                0,
                -0.066,
              ]}
            >
              <planeGeometry
                args={[
                  0.17,
                  0.17,
                ]}
              />

              <meshStandardMaterial
                color={
                  lampColour
                }
                emissive={
                  lampColour
                }
                emissiveIntensity={
                  isOn
                    ? 2.8
                    : isDown
                      ? 1.3
                      : 0.15
                }
                side={
                  THREE.DoubleSide
                }
              />
            </mesh>
          </group>
        )
      )}

      {/* LIGHT OUTPUT WHEN ON */}
      {isOn && (
        <pointLight
          position={[
            0,
            BASE_HEIGHT +
              MAST_HEIGHT +
              0.35,
            -0.25,
          ]}
          intensity={
            4.2
          }
          distance={
            9
          }
          color={
            LIGHT_ON
          }
        />
      )}

      {/* DOWN STATUS WARNING */}
      {isDown && (
        <>
          <mesh
            position={[
              0,
              BASE_HEIGHT +
                MAST_HEIGHT +
                0.95,
              0,
            ]}
          >
            <sphereGeometry
              args={[
                0.16,
                18,
                18,
              ]}
            />

            <meshBasicMaterial
              color={
                LIGHT_DOWN
              }
            />
          </mesh>

          <mesh
            position={[
              0,
              0.035,
              0,
            ]}
            rotation={[
              -Math.PI /
                2,
              0,
              0,
            ]}
          >
            <ringGeometry
              args={[
                0.58,
                0.72,
                32,
              ]}
            />

            <meshBasicMaterial
              color={
                LIGHT_DOWN
              }
              transparent
              opacity={
                0.75
              }
              side={
                THREE.DoubleSide
              }
            />
          </mesh>
        </>
      )}

      {/* SELECTED RING */}
      {selected && (
        <mesh
          position={[
            0,
            0.04,
            0,
          ]}
          rotation={[
            -Math.PI /
              2,
            0,
            0,
          ]}
        >
          <ringGeometry
            args={[
              0.72,
              0.88,
              32,
            ]}
          />

          <meshBasicMaterial
            color="#FFFFFF"
            side={
              THREE.DoubleSide
            }
          />
        </mesh>
      )}

      {/* ALWAYS-VISIBLE LABEL */}
      <Html
        position={[
          0,
          BASE_HEIGHT +
            MAST_HEIGHT +
            1.05,
          0,
        ]}
        center
        distanceFactor={
          17
        }
        style={{
          pointerEvents:
            "none",
        }}
      >
        <div
          className={`whitespace-nowrap rounded-md border bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ${
            isDown
              ? "border-red-300 text-red-700"
              : isOn
                ? "border-amber-300 text-amber-800"
                : "border-slate-200 text-slate-700"
          }`}
        >
          {light.name}
          {" · "}
          {isDown
            ? "DOWN"
            : isOn
              ? "ON"
              : "OFF"}
        </div>
      </Html>
    </group>
  );
}
