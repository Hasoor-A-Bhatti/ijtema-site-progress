"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  EquipmentLoanView,
  NewEquipmentLoan,
  RecentBorrower,
} from "@/types/equipmentLoans";

export interface EquipmentLoanDepartment {
  id: string;
  name: string;
  nazim_name: string;
  sort_order: number;
  active: boolean;
}

export interface EquipmentLoansDashboardData {
  success: true;

  loanDate: string;
  serverTime: string;

  summary: {
    outstanding: number;
    late: number;
    departmentsWithOutstanding: number;
    returned: number;
    activeLoans: number;
  };

  departments:
    EquipmentLoanDepartment[];

  recentBorrowers:
    RecentBorrower[];

  loans:
    EquipmentLoanView[];
}

interface ActionResult {
  success: boolean;
  error?: string;
}

export default function useEquipmentLoans(
  loanDate: string,
  enabled = true
) {
  const [
    data,
    setData,
  ] =
    useState<EquipmentLoansDashboardData | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<Date | null>(
      null
    );

  /*
   * LOAD DASHBOARD
   */
  const loadLoans =
    useCallback(
      async () => {
        if (!enabled) {
          return;
        }

        try {
          setError(null);

          const response =
            await fetch(
              `/api/equipment-loans?date=${encodeURIComponent(
                loanDate
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const result =
            (await response
              .json()
              .catch(
                () => ({})
              )) as
              | EquipmentLoansDashboardData
              | {
                  error?: string;
                };

          if (
            !response.ok
          ) {
            throw new Error(
              "error" in
                  result &&
                result.error
                ? result.error
                : "Equipment loans could not be loaded."
            );
          }

          setData(
            result as EquipmentLoansDashboardData
          );

          setLastUpdated(
            new Date()
          );
        } catch (
          loadError
        ) {
          console.error(
            "Failed to load equipment loans:",
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Equipment loans could not be loaded."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        enabled,
        loanDate,
      ]
    );

  /*
   * LOAD + POLLING
   */
  useEffect(() => {
    const initialLoad =
      window.setTimeout(
        () => {
          if (!enabled) {
            setData(null);
            setError(null);
            setLastUpdated(null);
            setLoading(false);
            return;
          }

          setLoading(true);
          setData(null);

          void loadLoans();
        },
        0
      );

    if (!enabled) {
      return () => {
        window.clearTimeout(
          initialLoad
        );
      };
    }

    /*
     * 30-second refresh allows late states
     * to change automatically around 23:00.
     */
    const polling =
      window.setInterval(
        () => {
          void loadLoans();
        },
        30000
      );

    return () => {
      window.clearTimeout(
        initialLoad
      );

      window.clearInterval(
        polling
      );
    };
  }, [
    enabled,
    loadLoans,
  ]);

  /*
   * CREATE NEW LOAN
   */
  async function createLoan(
    loan: NewEquipmentLoan
  ): Promise<ActionResult> {
    try {
      const response =
        await fetch(
          "/api/equipment-loans",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                loan
              ),
          }
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({})
          )) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        return {
          success:
            false,

          error:
            result.error ??
            "The equipment loan could not be created.",
        };
      }

      await loadLoans();

      return {
        success:
          true,
      };
    } catch (
      actionError
    ) {
      console.error(
        "Failed to create equipment loan:",
        actionError
      );

      return {
        success:
          false,

        error:
          "Could not connect to the server.",
      };
    }
  }

  /*
   * ADD TOOL TO EXISTING LOAN
   */
  async function addItem(
    loanId: string,
    itemName: string,
    quantity: number
  ): Promise<ActionResult> {
    try {
      const response =
        await fetch(
          `/api/equipment-loans/${encodeURIComponent(
            loanId
          )}/items`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                itemName,
                quantity,
              }),
          }
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({})
          )) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        return {
          success:
            false,

          error:
            result.error ??
            "The tool could not be added.",
        };
      }

      await loadLoans();

      return {
        success:
          true,
      };
    } catch (
      actionError
    ) {
      console.error(
        "Failed to add equipment loan item:",
        actionError
      );

      return {
        success:
          false,

        error:
          "Could not connect to the server.",
      };
    }
  }

  /*
   * GENERIC ITEM PATCH
   *
   * Used internally by both:
   * - old checkbox behaviour
   * - new quantity-aware returns
   */
  async function updateItemReturn(
    itemId: string,
    body:
      | {
          returned:
            boolean;
        }
      | {
          quantityReturned:
            number;
        }
  ): Promise<ActionResult> {
    try {
      const response =
        await fetch(
          `/api/equipment-loans/items/${encodeURIComponent(
            itemId
          )}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body
              ),
          }
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({})
          )) as {
          error?: string;
        };

      if (
        !response.ok
      ) {
        return {
          success:
            false,

          error:
            result.error ??
            "The equipment return could not be updated.",
        };
      }

      await loadLoans();

      return {
        success:
          true,
      };
    } catch (
      actionError
    ) {
      console.error(
        "Failed to update equipment return:",
        actionError
      );

      return {
        success:
          false,

        error:
          "Could not connect to the server.",
      };
    }
  }

  /*
   * EXISTING CHECKBOX API
   *
   * returned = true
   * → entire quantity returned
   *
   * returned = false
   * → entire quantity outstanding again
   *
   * Kept so the current UI continues
   * working during the transition.
   */
  async function setItemReturned(
    itemId: string,
    returned: boolean
  ) {
    return updateItemReturn(
      itemId,
      {
        returned,
      }
    );
  }

  /*
   * NEW PARTIAL RETURN API
   *
   * Example:
   *
   * 6 issued
   * quantityReturned = 2
   *
   * → 2 returned
   * → 4 outstanding
   */
  async function setItemReturnedQuantity(
    itemId: string,
    quantityReturned: number
  ) {
    return updateItemReturn(
      itemId,
      {
        quantityReturned,
      }
    );
  }

  /*
   * RETURN MULTIPLE ITEM ROWS
   *
   * Used by Return All.
   *
   * Each item row is marked completely
   * returned.
   */
  async function setItemsReturned(
    itemIds: string[],
    returned: boolean
  ): Promise<ActionResult> {
    if (
      itemIds.length ===
      0
    ) {
      return {
        success:
          true,
      };
    }

    try {
      const responses =
        await Promise.all(
          itemIds.map(
            (itemId) =>
              fetch(
                `/api/equipment-loans/items/${encodeURIComponent(
                  itemId
                )}`,
                {
                  method:
                    "PATCH",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body:
                    JSON.stringify({
                      returned,
                    }),
                }
              )
          )
        );

      for (
        const response of
        responses
      ) {
        if (
          !response.ok
        ) {
          const result =
            (await response
              .json()
              .catch(
                () => ({})
              )) as {
              error?:
                string;
            };

          /*
           * Some rows may have succeeded
           * already, so refresh before
           * returning the error.
           */
          await loadLoans();

          return {
            success:
              false,

            error:
              result.error ??
              "One or more equipment returns could not be updated.",
          };
        }
      }

      await loadLoans();

      return {
        success:
          true,
      };
    } catch (
      actionError
    ) {
      console.error(
        "Failed to update equipment returns:",
        actionError
      );

      await loadLoans();

      return {
        success:
          false,

        error:
          "Could not connect to the server.",
      };
    }
  }

  return {
    data,
    loading,
    error,
    lastUpdated,

    refresh:
      loadLoans,

    createLoan,
    addItem,

    /*
     * Existing all-or-nothing controls.
     */
    setItemReturned,
    setItemsReturned,

    /*
     * New partial-return control.
     */
    setItemReturnedQuantity,
  };
}