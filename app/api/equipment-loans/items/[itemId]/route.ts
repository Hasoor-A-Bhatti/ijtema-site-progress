import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  hasValidEditorSession,
} from "@/lib/auth/requireEditorSession";

import {
  getEquipmentLoanItemStatus,
} from "@/lib/equipmentLoans/loanUtils";

import {
  supabaseServer,
} from "@/lib/supabaseServer";

import type {
  EquipmentLoanItem,
} from "@/types/equipmentLoans";

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      itemId: string;
    }>;
  }
) {
  const authorised =
    await hasValidEditorSession();

  if (!authorised) {
    return NextResponse.json(
      {
        error:
          "Editing access is required.",
      },
      {
        status: 401,
      }
    );
  }

  const { itemId } =
    await context.params;

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          quantityReturned?: unknown;

          /*
           * Temporary backwards compatibility
           * with the original boolean API.
           */
          returned?: unknown;
        }
      | null;

  const existingResult =
    await supabaseServer
      .from(
        "equipment_loan_items"
      )
      .select("*")
      .eq(
        "id",
        itemId
      )
      .maybeSingle();

  if (
    existingResult.error ||
    !existingResult.data
  ) {
    return NextResponse.json(
      {
        error:
          "Equipment item could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const existingItem =
    existingResult.data as EquipmentLoanItem;

  let quantityReturned:
    number;

  /*
   * New quantity-aware API.
   */
  if (
    typeof body?.quantityReturned === "number"
  ) {
    quantityReturned =
      body.quantityReturned;
  }

  /*
   * Keep old calls working temporarily:
   * returned=true means everything returned.
   */
  else if (
    typeof body?.returned === "boolean"
  ) {
    quantityReturned =
      body.returned
        ? existingItem.quantity
        : 0;
  } else {
    return NextResponse.json(
      {
        error:
          "Returned quantity is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Number.isInteger(
      quantityReturned
    ) ||
    quantityReturned < 0 ||
    quantityReturned >
      existingItem.quantity
  ) {
    return NextResponse.json(
      {
        error:
          `Returned quantity must be between 0 and ${existingItem.quantity}.`,
      },
      {
        status: 400,
      }
    );
  }

  const fullyReturned =
    quantityReturned ===
    existingItem.quantity;

  /*
   * returned_at represents when the LAST
   * outstanding item came back.
   *
   * Partial returns therefore leave it null.
   */
  let returnedAt:
    string | null = null;

  if (fullyReturned) {
    returnedAt =
      existingItem.quantity_returned ===
        existingItem.quantity &&
      existingItem.returned_at
        ? existingItem.returned_at
        : new Date().toISOString();
  }

  const updateResult =
    await supabaseServer
      .from(
        "equipment_loan_items"
      )
      .update({
        quantity_returned:
          quantityReturned,

        returned_at:
          returnedAt,
      })
      .eq(
        "id",
        itemId
      )
      .select("*")
      .single();

  if (
    updateResult.error ||
    !updateResult.data
  ) {
    console.error(
      updateResult.error
    );

    return NextResponse.json(
      {
        error:
          "Equipment return could not be updated.",
      },
      {
        status: 500,
      }
    );
  }

  const loanResult =
    await supabaseServer
      .from(
        "equipment_loans"
      )
      .select(
        "id,due_at"
      )
      .eq(
        "id",
        existingItem.loan_id
      )
      .maybeSingle();

  if (
    loanResult.error ||
    !loanResult.data
  ) {
    return NextResponse.json(
      {
        error:
          "Equipment loan could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const item =
    updateResult.data as EquipmentLoanItem;

  return NextResponse.json({
    success: true,

    item: {
      ...item,

      status:
        getEquipmentLoanItemStatus(
          item,
          loanResult.data.due_at
        ),
    },
  });
}