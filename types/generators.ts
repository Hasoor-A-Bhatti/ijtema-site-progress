export interface GeneratorFuelLog {
  id: string;
  generator_id: string;
  log_date: string;
  litres: number;
  created_at: string;
}

export interface GeneratorRatingHistoryEntry {
  id: string;
  generator_id: string;
  old_kva: number;
  new_kva: number;
  changed_at: string;
}

export interface SiteGenerator {
  id: string;
  name: string;
  x: number;
  y: number;
  kva: number;
  default_kva: number;
  description: string | null;
  sync_group: string | null;
  is_down: boolean;
  created_at: string;
  updated_at: string;
  fuel_logs: GeneratorFuelLog[];
  rating_history: GeneratorRatingHistoryEntry[];
  total_fuel_litres: number;
}

export interface GeneratorListResponse {
  success: true;
  generators: SiteGenerator[];
  fleet: {
    totalGenerators: number;
    totalKva: number;
    totalFuelLitres: number;
  };
}
