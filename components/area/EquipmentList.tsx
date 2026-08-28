"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { useEditorAccess } from "@/components/editor/EditorAccessProvider";
import { supabase } from "@/lib/supabase";

import type { EquipmentRequirement } from "@/types/site";

interface EquipmentListProps {
  areaId: string;
  areaName: string;
}

interface EquipmentChanges {
  quantityRequired?: number;
  quantityReceived?: number;
  completed?: boolean;
}

interface EquipmentResponse {
  equipment: EquipmentRequirement;
  areaStatusChanged?: boolean;
  areaStatus?: string;
}

async function apiRequest<T>(
  url: string,
  options: RequestInit,
  fallbackError: string
): Promise<T> {
  const response = await fetch(url, options);

  const data = (await response
    .json()
    .catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? fallbackError);
  }

  return data;
}

export default function EquipmentList({
  areaId,
  areaName,
}: EquipmentListProps) {
  const { canEdit } = useEditorAccess();

  const [equipment, setEquipment] = useState<EquipmentRequirement[]>([]);
  const [itemName, setItemName] = useState("");
  const [quantityRequired, setQuantityRequired] = useState("1");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  /*
   * LOAD EQUIPMENT
   */
  const loadEquipment = useCallback(async () => {
    const { data, error } = await supabase
      .from("equipment_requirements")
      .select("*")
      .eq("area_id", areaId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load equipment:", error);
      return;
    }

    setEquipment((data ?? []) as EquipmentRequirement[]);
  }, [areaId]);

  /*
   * INITIAL LOAD
   */
  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      await loadEquipment();

      if (!cancelled) {
        setLoading(false);
      }
    }

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [loadEquipment]);

  /*
   * REALTIME
   */
  useEffect(() => {
    const channel = supabase
      .channel(`equipment-${areaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "equipment_requirements",
        },
        () => {
          void loadEquipment();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [areaId, loadEquipment]);

  /*
   * ADD EQUIPMENT
   */
  async function addEquipment(event: FormEvent) {
    event.preventDefault();

    if (!canEdit) {
      alert("Enable editing before adding equipment.");
      return;
    }

    const cleanName = itemName.trim();
    const required = Number(quantityRequired);

    if (!cleanName || !Number.isInteger(required) || required <= 0) {
      return;
    }

    setAdding(true);

    try {
      const data = await apiRequest<EquipmentResponse>(
        "/api/equipment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            areaId,
            itemName: cleanName,
            quantityRequired: required,
          }),
        },
        "The equipment requirement could not be added."
      );

      setEquipment((current) => [...current, data.equipment]);

      setItemName("");
      setQuantityRequired("1");
    } catch (error) {
      console.error("Failed to add equipment:", error);

      alert(
        error instanceof Error
          ? error.message
          : "The equipment requirement could not be added."
      );
    } finally {
      setAdding(false);
    }
  }

  /*
   * UPDATE EQUIPMENT
   */
  async function updateEquipment(
    item: EquipmentRequirement,
    changes: EquipmentChanges
  ) {
    if (!canEdit) return;

    const previousItem = item;

    const optimisticRequired =
      changes.quantityRequired ?? item.quantity_required;

    const optimisticReceived =
      changes.quantityReceived ?? item.quantity_received;

    const optimisticCompleted =
      optimisticReceived < optimisticRequired
        ? false
        : changes.completed ?? item.completed;

    const optimisticItem: EquipmentRequirement = {
      ...item,
      quantity_required: optimisticRequired,
      quantity_received: optimisticReceived,
      completed: optimisticCompleted,
      updated_at: new Date().toISOString(),
    };

    setEquipment((current) =>
      current.map((currentItem) =>
        currentItem.id === item.id ? optimisticItem : currentItem
      )
    );

    try {
      const data = await apiRequest<EquipmentResponse>(
        `/api/equipment/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        },
        "The equipment requirement could not be updated."
      );

      setEquipment((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? data.equipment : currentItem
        )
      );
    } catch (error) {
      console.error("Failed to update equipment:", error);

      setEquipment((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? previousItem : currentItem
        )
      );

      alert(
        error instanceof Error
          ? error.message
          : "The equipment requirement could not be updated."
      );
    }
  }

  /*
   * UPDATE REQUIRED QUANTITY
   */
  function updateRequired(
    item: EquipmentRequirement,
    quantity: number
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) return;

    void updateEquipment(item, {
      quantityRequired: quantity,
    });
  }

  /*
   * UPDATE RECEIVED QUANTITY
   */
  function updateReceived(
    item: EquipmentRequirement,
    quantity: number
  ) {
    if (!Number.isInteger(quantity) || quantity < 0) return;

    void updateEquipment(item, {
      quantityReceived: quantity,
    });
  }

  /*
   * COMPLETE / REOPEN REQUIREMENT
   */
  function toggleComplete(item: EquipmentRequirement) {
    if (!canEdit) return;

    const nextCompleted = !item.completed;

    if (
      nextCompleted &&
      item.quantity_received < item.quantity_required
    ) {
      alert(
        "The full required quantity must be on site before this equipment can be confirmed complete."
      );

      return;
    }

    void updateEquipment(item, {
      completed: nextCompleted,
    });
  }

  /*
   * REMOVE EQUIPMENT
   */
  async function removeEquipment(item: EquipmentRequirement) {
    if (!canEdit) {
      alert("Enable editing before removing equipment.");
      return;
    }

    if (
      !window.confirm(
        `Remove "${item.item_name}" from ${areaName}?`
      )
    ) {
      return;
    }

    const previousEquipment = equipment;

    setEquipment((current) =>
      current.filter((currentItem) => currentItem.id !== item.id)
    );

    try {
      await apiRequest<{ success: boolean }>(
        `/api/equipment/${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
        },
        "The equipment requirement could not be removed."
      );
    } catch (error) {
      console.error("Failed to remove equipment:", error);

      setEquipment(previousEquipment);

      alert(
        error instanceof Error
          ? error.message
          : "The equipment requirement could not be removed."
      );
    }
  }

  return (
    <div>
      {/* HEADER */}
      <div>
        <h3 className="font-semibold text-slate-900">
          Equipment
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Track required equipment and confirm when the full quantity
          has arrived on site.
        </p>
      </div>

      {/* ADD EQUIPMENT */}
      <form
        onSubmit={addEquipment}
        className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Add Equipment
        </label>

        <input
          type="text"
          value={itemName}
          disabled={!canEdit}
          onChange={(event) => setItemName(event.target.value)}
          placeholder={
            canEdit
              ? "e.g. Tables"
              : "Enable editing to add equipment"
          }
          className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100"
        />

        <div className="mt-2 flex gap-2">
          <input
            type="number"
            min="1"
            step="1"
            value={quantityRequired}
            disabled={!canEdit}
            onChange={(event) =>
              setQuantityRequired(event.target.value)
            }
            aria-label="Required quantity"
            className="min-h-11 w-28 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100"
          />

          <button
            type="submit"
            disabled={
              adding ||
              !canEdit ||
              !itemName.trim() ||
              Number(quantityRequired) <= 0
            }
            className="min-h-11 flex-1 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding ? "Adding..." : "Add Equipment"}
          </button>
        </div>
      </form>

      {/* EQUIPMENT LIST */}
      <div className="mt-5">
        {loading && (
          <p className="text-sm text-slate-500">
            Loading equipment...
          </p>
        )}

        {!loading && equipment.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
            <p className="text-sm font-medium text-slate-700">
              No equipment requirements
            </p>

            <p className="mt-1 text-xs text-slate-500">
              No equipment has been recorded for this area.
            </p>
          </div>
        )}

        {equipment.length > 0 && (
          <div className="grid gap-3">
            {equipment.map((item) => {
              const quantityComplete =
                item.quantity_received >= item.quantity_required;

              const fulfilled =
                quantityComplete && item.completed;

              const remaining = Math.max(
                item.quantity_required - item.quantity_received,
                0
              );

              const progress =
                item.quantity_required > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (item.quantity_received /
                          item.quantity_required) *
                          100
                      )
                    )
                  : 0;

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-3"
                >
                  {/* ITEM HEADER */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">
                        {item.item_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {fulfilled
                          ? "Requirement fulfilled"
                          : quantityComplete
                            ? "Full quantity on site — confirmation required"
                            : "Equipment outstanding"}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => void removeEquipment(item)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  {/* PROGRESS BAR */}
                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-500">
                        {item.quantity_received} of{" "}
                        {item.quantity_required} on site
                      </p>

                      <p className="text-xs font-semibold text-slate-700">
                        {progress}%
                      </p>
                    </div>

                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          fulfilled
                            ? "bg-green-500"
                            : progress > 0
                              ? "bg-blue-500"
                              : "bg-slate-300"
                        }`}
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* QUANTITIES */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium text-slate-500">
                      Required

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity_required}
                        disabled={!canEdit}
                        onChange={(event) =>
                          updateRequired(
                            item,
                            Number(event.target.value)
                          )
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-base text-slate-900 outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>

                    <label className="text-xs font-medium text-slate-500">
                      On Site

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity_received}
                        disabled={!canEdit}
                        onChange={(event) =>
                          updateReceived(
                            item,
                            Number(event.target.value)
                          )
                        }
                        className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-base text-slate-900 outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                    </label>
                  </div>

                  {/* MANUAL CONFIRMATION */}
                  <label className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      disabled={
                        !canEdit ||
                        (!item.completed && !quantityComplete)
                      }
                      onChange={() => toggleComplete(item)}
                      className="h-5 w-5 shrink-0 disabled:cursor-not-allowed"
                    />

                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Confirm complete
                      </p>

                      <p className="text-xs text-slate-500">
                        {fulfilled
                          ? "Equipment has been fully received and confirmed."
                          : quantityComplete
                            ? "Full required quantity is on site. Confirm it above."
                            : `${remaining} still required.`}
                      </p>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}