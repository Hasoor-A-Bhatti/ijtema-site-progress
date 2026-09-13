export type TowerLightStatus =
  | "on"
  | "off"
  | "down";

export interface TowerLightStatusHistoryEntry {
  id: string;
  tower_light_id: string;
  old_status: TowerLightStatus;
  new_status: TowerLightStatus;
  changed_at: string;
}

export interface SiteTowerLight {
  id: string;
  name: string;
  x: number | string;
  y: number | string;
  status: TowerLightStatus;
  created_at: string;
  updated_at: string;
  status_history: TowerLightStatusHistoryEntry[];
}
