export const GENERATOR_MARKER_AREA = 794 * 0.8;
export const GENERATOR_MARKER_SIZE = Math.sqrt(GENERATOR_MARKER_AREA);

export interface InitialGeneratorDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  kva: number;
  description: string | null;
  syncGroup: string | null;
}

export const initialGenerators: InitialGeneratorDefinition[] = [
  { id: "g1", name: "G1", x: 1046, y: 1178, kva: 100, description: null, syncGroup: "Sync 1" },
  { id: "g2", name: "G2", x: 1068, y: 1189, kva: 100, description: null, syncGroup: "Sync 1" },
  { id: "g3", name: "G3", x: 773, y: 1180, kva: 100, description: null, syncGroup: null },
  { id: "g4", name: "G4", x: 656, y: 1401, kva: 100, description: null, syncGroup: null },
  { id: "g5", name: "G5", x: 1419, y: 1133, kva: 100, description: null, syncGroup: null },
  { id: "g6", name: "G6", x: 1434, y: 451, kva: 100, description: null, syncGroup: null },
  { id: "g7", name: "G7", x: 488, y: 616, kva: 100, description: null, syncGroup: null },
  { id: "g8", name: "G8", x: 490, y: 1069, kva: 60, description: null, syncGroup: null },
  { id: "g9", name: "G9", x: 442, y: 1216, kva: 60, description: null, syncGroup: null },
  { id: "g10", name: "G10", x: 192, y: 1857, kva: 100, description: null, syncGroup: null },
  { id: "g11", name: "G11", x: 920, y: 2068, kva: 100, description: null, syncGroup: null },
  { id: "g12", name: "G12", x: 963, y: 1909, kva: 40, description: "Outdoor Screen", syncGroup: null },
  { id: "g13", name: "G13", x: 1424, y: 1731, kva: 60, description: "Towable", syncGroup: null },
  { id: "g14", name: "G14", x: 252, y: 1000, kva: 60, description: null, syncGroup: null },
  { id: "g15", name: "G15", x: 142, y: 1181, kva: 60, description: null, syncGroup: null },
  { id: "g16", name: "G16", x: 966, y: 525, kva: 60, description: null, syncGroup: null },
  { id: "g17", name: "G17", x: 1169, y: 1717, kva: 40, description: "VIP", syncGroup: null },
  { id: "g18", name: "G18", x: 1044, y: 1435, kva: 100, description: null, syncGroup: "Sync 2" },
  { id: "g19", name: "G19", x: 1066, y: 1447, kva: 100, description: null, syncGroup: "Sync 2" },
];
