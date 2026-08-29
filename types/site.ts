export type SiteStatus =
  | "not_started"
  | "laid"
  | "preparing"
  | "ready_for_inspection"
  | "completed";

export type InfrastructureType =
  | "fence"
  | "rubber_tracking"
  | "metal_tracking";

export type AreaType =
  | "marquee"
  | "cabin"
  | "service_pad"
  | "site_yard"
  | "other"
  | InfrastructureType;

export type GeometryType =
  | "polygon"
  | "line";

export interface SiteArea {
  id: string;
  name: string;
  type: AreaType;
  points: string;
  status: SiteStatus;
  geometry?: GeometryType;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface EquipmentRequirement {
  id: string;
  area_id: string;
  item_name: string;
  quantity_required: number;
  quantity_received: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UrgentTask {
  id: string;
  area_id: string;
  task_text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}