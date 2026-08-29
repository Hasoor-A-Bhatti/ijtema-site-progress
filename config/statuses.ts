import type {
  AreaType,
  SiteStatus,
} from "@/types/site";

export const STATUS_CONFIG: Record<
  SiteStatus,
  {
    colour: string;
    shortLabel: string;
  }
> = {
  not_started: {
    colour: "#6B7280",
    shortLabel: "Not Started",
  },

  laid: {
    colour: "#FACC15",
    shortLabel: "Laid",
  },

  preparing: {
    colour: "#F59E0B",
    shortLabel: "Being Prepared",
  },

  ready_for_inspection: {
    colour: "#3B82F6",
    shortLabel: "Ready for Inspection",
  },

  completed: {
    colour: "#22C55E",
    shortLabel: "Fully Completed",
  },
};

export const STATUS_ORDER: SiteStatus[] = [
  "not_started",
  "laid",
  "preparing",
  "ready_for_inspection",
  "completed",
];

export function getStatusLabel(
  status: SiteStatus,
  areaType: AreaType
) {
  if (status === "laid") {
    if (areaType === "marquee") {
      return "Marquee Laid";
    }

    if (
      areaType === "rubber_tracking" ||
      areaType === "metal_tracking"
    ) {
      return "Tracking Laid";
    }

    if (areaType === "fence") {
      return "Fence Installed";
    }

    return "Area Established";
  }

  return STATUS_CONFIG[status].shortLabel;
}