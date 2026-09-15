"use client";

const MAP_WIDTH = 2384;
const MAP_HEIGHT = 3370;
const MAP_SCALE = 0.02;

export default function SiteEntranceDecor3D() {
  const worldWidth = MAP_WIDTH * MAP_SCALE;
  const worldHeight = MAP_HEIGHT * MAP_SCALE;

  /*
   * Decorative public road on the right vertical edge.
   */
  const roadThickness = 5.0;
  const roadLength = worldHeight;

  const roadX = worldWidth - roadThickness / 2 - 0.45;
  const roadZ = -worldHeight / 2;

  const laneDashCount = 18;
  const laneDashLength = 1.05;
  const laneDashGap = 2.1;

  const totalLaneSpan =
    laneDashCount * laneDashLength +
    (laneDashCount - 1) * laneDashGap;

  const laneStartZ =
    roadZ + totalLaneSpan / 2 - laneDashLength / 2;

  return (
    <group name="site-entrance-decor">
      {/* Main public road - vertical on the right edge */}
      <mesh
        position={[roadX, 0.008, roadZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[roadThickness, roadLength]} />
        <meshStandardMaterial
          color="#6b7280"
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      {/* Left road edge */}
      <mesh
        position={[roadX - roadThickness / 2 + 0.08, 0.01, roadZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.12, roadLength]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>

      {/* Right road edge */}
      <mesh
        position={[roadX + roadThickness / 2 - 0.08, 0.01, roadZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[0.12, roadLength]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>

      {/* Dashed centre line */}
      {Array.from({ length: laneDashCount }).map((_, index) => (
        <mesh
          key={`lane-mark-${index}`}
          position={[
            roadX,
            0.012,
            laneStartZ - index * (laneDashLength + laneDashGap),
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.12, laneDashLength]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
    </group>
  );
}