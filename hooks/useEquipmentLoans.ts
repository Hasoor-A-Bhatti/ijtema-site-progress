"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  CreateEquipmentLoanInput,
  EquipmentBookingGroup,
  EquipmentLoanMutationResult,
  EquipmentLoansResponse,
} from "@/types/equipmentLoans";

interface ErrorResponse {
  error?: string;
}

async function readResponse(
  response: Response
): Promise<EquipmentLoansResponse | ErrorResponse | null> {
  return (await response.json().catch(() => null)) as
    | EquipmentLoansResponse
    | ErrorResponse
    | null;
}

export default function useEquipmentLoans(
  loanDate: string,
  bookingGroup: EquipmentBookingGroup | null,
  enabled = true
) {
  const [data, setData] =
    useState<EquipmentLoansResponse | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !bookingGroup) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        date: loanDate,
        bookingGroup,
      });

      const response = await fetch(
        `/api/equipment-loans?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const body = await readResponse(response);

      if (
        !response.ok ||
        !body ||
        !("success" in body)
      ) {
        throw new Error(
          body && "error" in body && body.error
            ? body.error
            : "Equipment loans could not be loaded."
        );
      }

      setData(body);
    } catch (loadError) {
      console.error(
        "Failed to load equipment loans:",
        loadError
      );

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Equipment loans could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [
    bookingGroup,
    enabled,
    loanDate,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [refresh]);

  const createLoan = useCallback(
    async (
      input: Omit<
        CreateEquipmentLoanInput,
        "bookingGroup"
      >
    ): Promise<EquipmentLoanMutationResult> => {
      if (!bookingGroup) {
        return {
          success: false,
          error: "Sign in to Equipment Loans first.",
        };
      }

      try {
        const response = await fetch(
          "/api/equipment-loans",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              ...input,
              bookingGroup,
            }),
          }
        );

        const body =
          (await response.json().catch(() => null)) as
            | {
                success?: boolean;
                error?: string;
              }
            | null;

        if (!response.ok || !body?.success) {
          throw new Error(
            body?.error ??
              "The equipment loan could not be created."
          );
        }

        await refresh();

        return {
          success: true,
        };
      } catch (createError) {
        return {
          success: false,
          error:
            createError instanceof Error
              ? createError.message
              : "The equipment loan could not be created.",
        };
      }
    },
    [
      bookingGroup,
      refresh,
    ]
  );

  const addItem = useCallback(
    async (
      loanId: string,
      itemName: string,
      quantity: number
    ): Promise<EquipmentLoanMutationResult> => {
      if (!bookingGroup) {
        return {
          success: false,
          error: "Sign in to Equipment Loans first.",
        };
      }

      try {
        const response = await fetch(
          "/api/equipment-loans",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "add_item",
              bookingGroup,
              loanId,
              itemName,
              quantity,
            }),
          }
        );

        const body =
          (await response.json().catch(() => null)) as
            | {
                success?: boolean;
                error?: string;
              }
            | null;

        if (!response.ok || !body?.success) {
          throw new Error(
            body?.error ??
              "The tool could not be added."
          );
        }

        await refresh();

        return {
          success: true,
        };
      } catch (addError) {
        return {
          success: false,
          error:
            addError instanceof Error
              ? addError.message
              : "The tool could not be added.",
        };
      }
    },
    [
      bookingGroup,
      refresh,
    ]
  );

  const setItemReturned = useCallback(
    async (
      itemId: string,
      returned: boolean
    ): Promise<EquipmentLoanMutationResult> => {
      if (!bookingGroup) {
        return {
          success: false,
          error: "Sign in to Equipment Loans first.",
        };
      }

      try {
        const response = await fetch(
          "/api/equipment-loans",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "set_item_returned",
              bookingGroup,
              itemId,
              returned,
            }),
          }
        );

        const body =
          (await response.json().catch(() => null)) as
            | {
                success?: boolean;
                error?: string;
              }
            | null;

        if (!response.ok || !body?.success) {
          throw new Error(
            body?.error ??
              "The equipment return could not be updated."
          );
        }

        await refresh();

        return {
          success: true,
        };
      } catch (returnError) {
        return {
          success: false,
          error:
            returnError instanceof Error
              ? returnError.message
              : "The equipment return could not be updated.",
        };
      }
    },
    [
      bookingGroup,
      refresh,
    ]
  );

  const setItemsReturned = useCallback(
    async (
      itemIds: string[],
      returned: boolean
    ): Promise<EquipmentLoanMutationResult> => {
      if (!bookingGroup) {
        return {
          success: false,
          error: "Sign in to Equipment Loans first.",
        };
      }

      if (itemIds.length === 0) {
        return {
          success: true,
        };
      }

      try {
        const response = await fetch(
          "/api/equipment-loans",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "set_items_returned",
              bookingGroup,
              itemIds,
              returned,
            }),
          }
        );

        const body =
          (await response.json().catch(() => null)) as
            | {
                success?: boolean;
                error?: string;
              }
            | null;

        if (!response.ok || !body?.success) {
          throw new Error(
            body?.error ??
              "Not all equipment could be updated."
          );
        }

        await refresh();

        return {
          success: true,
        };
      } catch (returnError) {
        return {
          success: false,
          error:
            returnError instanceof Error
              ? returnError.message
              : "Not all equipment could be updated.",
        };
      }
    },
    [
      bookingGroup,
      refresh,
    ]
  );

  return {
    data,
    loading,
    error,
    refresh,
    createLoan,
    addItem,
    setItemReturned,
    setItemsReturned,
  };
}
