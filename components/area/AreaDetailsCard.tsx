"use client";

import { useState } from "react";

import EquipmentList from "./EquipmentList";
import ProgressControls from "./ProgressControls";
import UrgentTasksList from "./UrgentTasksList";

import { getStatusLabel, STATUS_CONFIG } from "@/config/statuses";

import type { SiteArea, SiteStatus } from "@/types/site";

type AreaTab = "progress" | "equipment" | "urgent";

interface AreaDetailsCardProps {
  area: SiteArea;
  status: SiteStatus;
  onStatusChange: (status: SiteStatus) => void;
  onClose: () => void;
}

export default function AreaDetailsCard({
  area,
  status,
  onStatusChange,
  onClose,
}: AreaDetailsCardProps) {
  const [activeTab, setActiveTab] = useState<AreaTab>("progress");

  const config = STATUS_CONFIG[status];

  return (
    <div className="absolute bottom-3 left-3 right-3 z-30 max-h-[75dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:bottom-4 md:left-auto md:right-4 md:w-[390px] md:p-5">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="break-words text-lg font-semibold text-slate-900 md:text-xl">
            {area.name}
          </h2>

          <div className="mt-2 flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: config.colour }}
            />

            <span className="text-sm font-medium text-slate-700">
              {getStatusLabel(status, area.type)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close area details"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-slate-500 hover:bg-slate-100 active:bg-slate-200"
        >
          ×
        </button>
      </div>

      {/* TABS */}
      <div className="mt-4 grid grid-cols-3 rounded-xl bg-slate-100 p-1 md:mt-5">
        <button
          type="button"
          onClick={() => setActiveTab("progress")}
          className={`min-h-10 rounded-lg px-2 py-2 text-sm ${
            activeTab === "progress"
              ? "bg-white font-semibold text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Progress
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("equipment")}
          className={`min-h-10 rounded-lg px-2 py-2 text-sm ${
            activeTab === "equipment"
              ? "bg-white font-semibold text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Equipment
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("urgent")}
          className={`min-h-10 rounded-lg px-2 py-2 text-sm ${
            activeTab === "urgent"
              ? "bg-white font-semibold text-slate-900 shadow-sm"
              : "text-slate-500"
          }`}
        >
          Urgent
        </button>
      </div>

      {/* CONTENT */}
      <div className="mt-4 md:mt-5">
        {activeTab === "progress" && (
          <ProgressControls
            status={status}
            areaType={area.type}
            onStatusChange={onStatusChange}
          />
        )}

        {activeTab === "equipment" && (
          <EquipmentList
            areaId={area.id}
            areaName={area.name}
          />
        )}

        {activeTab === "urgent" && (
          <UrgentTasksList
            areaId={area.id}
            areaName={area.name}
          />
        )}
      </div>
    </div>
  );
}