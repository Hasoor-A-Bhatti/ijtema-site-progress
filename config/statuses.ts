import type { AreaType, SiteStatus } from "@/types/site";

interface StatusConfigItem {
  label: string;
  colour: string;
}

export const STATUS_CONFIG: Record<SiteStatus, StatusConfigItem> = {
  not_started: {
    label: "Not Started",
    colour: "#94A3B8",
  },
  marked: {
    label: "Marked",
    colour: "#FACC15",
  },
  construction_started: {
    label: "Construction Started",
    colour: "#FB923C",
  },
  construction_completed: {
    label: "Construction Completed",
    colour: "#C084FC",
  },
  carpeting_completed: {
    label: "Carpeting Completed",
    colour: "#2DD4BF",
  },
  electrical_installation_completed: {
    label: "Electrical Installation Completed",
    colour: "#22D3EE",
  },
  track_laid: {
    label: "Track Laid",
    colour: "#FB923C",
  },
  fence_erected: {
    label: "Fence Erected",
    colour: "#FB923C",
  },
  fence_secured: {
    label: "Fence Secured",
    colour: "#C084FC",
  },
  fence_covered: {
    label: "Fence Covered",
    colour: "#2DD4BF",
  },
  ready_for_inspection: {
    label: "Ready for Inspection",
    colour: "#60A5FA",
  },
  signed_off: {
    label: "Signed Off",
    colour: "#4ADE80",
  },
};

export const MARQUEE_STATUS_ORDER: SiteStatus[] = [
  "not_started",
  "marked",
  "construction_started",
  "construction_completed",
  "carpeting_completed",
  "electrical_installation_completed",
  "ready_for_inspection",
  "signed_off",
];

export const TRACK_STATUS_ORDER: SiteStatus[] = [
  "not_started",
  "marked",
  "track_laid",
  "ready_for_inspection",
  "signed_off",
];

export const FENCE_STATUS_ORDER: SiteStatus[] = [
  "not_started",
  "marked",
  "fence_erected",
  "fence_secured",
  "fence_covered",
  "ready_for_inspection",
  "signed_off",
];

export const ALL_STATUS_ORDER: SiteStatus[] = [
  "not_started",
  "marked",
  "construction_started",
  "construction_completed",
  "carpeting_completed",
  "electrical_installation_completed",
  "track_laid",
  "fence_erected",
  "fence_secured",
  "fence_covered",
  "ready_for_inspection",
  "signed_off",
];

// Kept for compatibility with any existing dashboard code that still imports STATUS_ORDER.
export const STATUS_ORDER = ALL_STATUS_ORDER;

export function getStatusOrder(areaType: AreaType): SiteStatus[] {
  if (
    areaType === "metal_tracking" ||
    areaType === "rubber_tracking"
  ) {
    return TRACK_STATUS_ORDER;
  }

  if (areaType === "fence") {
    return FENCE_STATUS_ORDER;
  }

  return MARQUEE_STATUS_ORDER;
}

export function getStatusLabel(
  status: SiteStatus,
  _areaType?: AreaType
): string {
  return STATUS_CONFIG[status].label;
}
