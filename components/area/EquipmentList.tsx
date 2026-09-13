"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useEditorAccess } from "@/components/editor/EditorAccessProvider";
import { supabase } from "@/lib/supabase";

import type {
  EquipmentRequirement,
} from "@/types/site";

interface EquipmentListProps {
  areaId: string;
  areaName: string;
}

export default function EquipmentList({
  areaId,
  areaName,
}: EquipmentListProps) {
  const { canEdit } = useEditorAccess();

  const [equipment, setEquipment] =
    useState<EquipmentRequirement[]>([]);

  const [itemName, setItemName] =
    useState("");

  const [
    quantityRequired,
    setQuantityRequired,
  ] = useState("1");

  const [loading, setLoading] =
    useState(true);

  const [adding, setAdding] =
    useState(false);

  /*
   * LOAD EQUIPMENT
   */
  const loadEquipment =
    useCallback(async () => {
      const { data, error } =
        await supabase
          .from(
            "equipment_requirements"
          )
          .select("*")
          .eq("area_id", areaId)
          .order("created_at", {
            ascending: true,
          });

      if (error) {
        console.error(
          "Failed to load equipment:",
          error
        );

        return;
      }

      setEquipment(
        (data ?? []) as EquipmentRequirement[]
      );
    }, [areaId]);

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      setLoading(true);

      const { data, error } =
        await supabase
          .from(
            "equipment_requirements"
          )
          .select("*")
          .eq("area_id", areaId)
          .order("created_at", {
            ascending: true,
          });

      if (cancelled) return;

      if (error) {
        console.error(
          "Failed to load equipment:",
          error
        );

        setLoading(false);
        return;
      }

      setEquipment(
        (data ?? []) as EquipmentRequirement[]
      );

      setLoading(false);
    }

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [areaId]);

  /*
   * REALTIME
   */
  useEffect(() => {
    const channel = supabase
      .channel(
        `equipment-${areaId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "equipment_requirements",
        },
        () => {
          void loadEquipment();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [areaId, loadEquipment]);

  /*
   * ADD EQUIPMENT
   */
  async function addEquipment(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!canEdit) {
      alert(
        "Enable editing before adding equipment."
      );

      return;
    }

    const cleanName =
      itemName.trim();

    const required =
      Number(quantityRequired);

    if (
      !cleanName ||
      !Number.isInteger(required) ||
      required <= 0
    ) {
      return;
    }

    setAdding(true);

    try {
      const response = await fetch(
        "/api/equipment",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            areaId,
            itemName: cleanName,
            quantityRequired:
              required,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "The equipment requirement could not be added."
        );
      }

      setEquipment((current) => [
        ...current,
        data.equipment as EquipmentRequirement,
      ]);

      setItemName("");
      setQuantityRequired("1");
    } catch (error) {
      console.error(
        "Failed to add equipment:",
        error
      );

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
   * UPDATE REQUIRED QUANTITY
   */
  async function updateRequired(
    item: EquipmentRequirement,
    quantity: number
  ) {
    if (!canEdit) return;

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return;
    }

    await updateEquipment(
      item,
      {
        quantityRequired: quantity,
      }
    );
  }

  /*
   * UPDATE RECEIVED QUANTITY
   */
  async function updateReceived(
    item: EquipmentRequirement,
    quantity: number
  ) {
    if (!canEdit) return;

    if (
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      return;
    }

    await updateEquipment(
      item,
      {
        quantityReceived: quantity,
      }
    );
  }

  /*
   * COMPLETE / REOPEN
   */
  async function toggleComplete(
    item: EquipmentRequirement
  ) {
    if (!canEdit) return;

    const nextCompleted =
      !item.completed;

    if (
      nextCompleted &&
      item.quantity_received <
        item.quantity_required
    ) {
      alert(
        "The full required quantity must be on site before this equipment can be confirmed complete."
      );

      return;
    }

    await updateEquipment(
      item,
      {
        completed:
          nextCompleted,
      }
    );
  }

  /*
   * COMMON UPDATE FUNCTION
   */
  async function updateEquipment(
    item: EquipmentRequirement,
    changes: {
      quantityRequired?: number;
      quantityReceived?: number;
      completed?: boolean;
    }
  ) {
    const previousItem = item;

    const optimisticRequired =
      changes.quantityRequired ??
      item.quantity_required;

    const optimisticReceived =
      changes.quantityReceived ??
      item.quantity_received;

    let optimisticCompleted =
      changes.completed ??
      item.completed;

    if (
      optimisticReceived <
      optimisticRequired
    ) {
      optimisticCompleted = false;
    }

    const optimisticItem: EquipmentRequirement =
      {
        ...item,
        quantity_required:
          optimisticRequired,
        quantity_received:
          optimisticReceived,
        completed:
          optimisticCompleted,
        updated_at:
          new Date().toISOString(),
      };

    setEquipment((current) =>
      current.map(
        (currentItem) =>
          currentItem.id === item.id
            ? optimisticItem
            : currentItem
      )
    );

    try {
      const response = await fetch(
        `/api/equipment/${encodeURIComponent(
          item.id
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            changes
          ),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "The equipment requirement could not be updated."
        );
      }

      setEquipment((current) =>
        current.map(
          (currentItem) =>
            currentItem.id ===
            item.id
              ? (data.equipment as EquipmentRequirement)
              : currentItem
        )
      );
    } catch (error) {
      console.error(
        "Failed to update equipment:",
        error
      );

      setEquipment((current) =>
        current.map(
          (currentItem) =>
            currentItem.id ===
            item.id
              ? previousItem
              : currentItem
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
   * REMOVE EQUIPMENT
   */
  async function removeEquipment(
    item: EquipmentRequirement
  ) {
    if (!canEdit) {
      alert(
        "Enable editing before removing equipment."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${item.item_name}" from ${areaName}?`
      );

    if (!confirmed) return;

    const previousEquipment =
      equipment;

    setEquipment((current) =>
      current.filter(
        (currentItem) =>
          currentItem.id !== item.id
      )
    );

    try {
      const response = await fetch(
        `/api/equipment/${encodeURIComponent(
          item.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "The equipment requirement could not be removed."
        );
      }
    } catch (error) {
      console.error(
        "Failed to remove equipment:",
        error
      );

      setEquipment(
        previousEquipment
      );

      alert(
        error instanceof Error
          ? error.message
          : "The equipment requirement could not be removed."
      );
    }
  }

  return (
    <div>
      <div>
        <h3 className="font-semibold text-slate-900">
          Equipment
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Track required equipment and
          confirm when the full quantity
          has arrived on site.
        </p>
      </div>

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
          onChange={(event) =>
            setItemName(
              event.target.value
            )
          }
          disabled={!canEdit}
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
            value={
              quantityRequired
            }
            onChange={(event) =>
              setQuantityRequired(
                event.target.value
              )
            }
            disabled={!canEdit}
            className="min-h-11 w-28 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-slate-600 disabled:cursor-not-allowed disabled:bg-slate-100"
          />

          <button
            type="submit"
            disabled={
              adding ||
              !canEdit ||
              !itemName.trim()
            }
            className="min-h-11 flex-1 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {adding
              ? "Adding..."
              : "Add Equipment"}
          </button>
        </div>
      </form>

      <div className="mt-5">
        {loading && (
          <p className="text-sm text-slate-500">
            Loading equipment...
          </p>
        )}

        {!loading &&
          equipment.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
              <p className="text-sm font-medium text-slate-700">
                No equipment requirements
              </p>

              <p className="mt-1 text-xs text-slate-500">
                No equipment has been
                recorded for this area.
              </p>
            </div>
          )}

        {equipment.length > 0 && (
          <div className="grid gap-3">
            {equipment.map(
              (item) => {
                const fulfilled =
                  item.quantity_received >=
                    item.quantity_required &&
                  item.completed;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 ${
                      fulfilled
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">
                          {
                            item.item_name
                          }
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {fulfilled
                            ? "Requirement fulfilled"
                            : "Equipment outstanding"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={
                          !canEdit
                        }
                        onClick={() =>
                          removeEquipment(
                            item
                          )
                        }
                        className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-500">
                          Delivery progress
                        </span>

                        <span className="font-semibold text-slate-700">
                          {Math.min(
                            100,
                            Math.round(
                              (item.quantity_received /
                                item.quantity_required) *
                                100
                            )
                          )}
                          %
                        </span>
                      </div>

                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              (item.quantity_received /
                                item.quantity_required) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-xs font-medium text-slate-500">
                        Required

                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={
                            item.quantity_required
                          }
                          disabled={
                            !canEdit
                          }
                          onChange={(
                            event
                          ) => {
                            const value =
                              Number(
                                event
                                  .target
                                  .value
                              );

                            if (
                              Number.isInteger(
                                value
                              ) &&
                              value > 0
                            ) {
                              void updateRequired(
                                item,
                                value
                              );
                            }
                          }}
                          className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-base text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </label>

                      <label className="text-xs font-medium text-slate-500">
                        On Site

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            item.quantity_received
                          }
                          disabled={
                            !canEdit
                          }
                          onChange={(
                            event
                          ) => {
                            const value =
                              Number(
                                event
                                  .target
                                  .value
                              );

                            if (
                              Number.isInteger(
                                value
                              ) &&
                              value >= 0
                            ) {
                              void updateReceived(
                                item,
                                value
                              );
                            }
                          }}
                          className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-base text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                        />
                      </label>
                    </div>

                    <label className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                      <input
                        type="checkbox"
                        checked={
                          item.completed
                        }
                        disabled={
                          !canEdit ||
                          (!item.completed &&
                            item.quantity_received <
                              item.quantity_required)
                        }
                        onChange={() =>
                          void toggleComplete(
                            item
                          )
                        }
                        className="h-5 w-5 shrink-0 disabled:cursor-not-allowed"
                      />

                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          Confirm complete
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.quantity_received >=
                          item.quantity_required
                            ? "Full required quantity is on site."
                            : `${item.quantity_required - item.quantity_received} still required.`}
                        </p>
                      </div>
                    </label>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}