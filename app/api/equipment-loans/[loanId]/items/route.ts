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

export async function POST(
  request: NextRequest,
  context: {
    params:
      Promise<{
        loanId: string;
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

  const {
    loanId,
  } =
    await context.params;

  const body =
    (await request
      .json()
      .catch(
        () => null
      )) as
      | {
          itemName?: unknown;
          quantity?: unknown;
        }
      | null;

  const itemName =
    typeof body?.itemName ===
      "string"
      ? body.itemName.trim()
      : "";

  const quantity =
    typeof body?.quantity ===
      "number"
      ? body.quantity
      : 1;

  if (!itemName) {
    return NextResponse.json(
      {
        error:
          "Enter the equipment name.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Number.isInteger(
      quantity
    ) ||
    quantity < 1
  ) {
    return NextResponse.json(
      {
        error:
          "Quantity must be at least 1.",
      },
      {
        status: 400,
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
        loanId
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

  const itemResult =
    await supabaseServer
      .from(
        "equipment_loan_items"
      )
      .insert(
        {
          loan_id:
            loanId,

          item_name:
            itemName,

          quantity,
        }
      )
      .select("*")
      .single();

  if (
    itemResult.error ||
    !itemResult.data
  ) {
    console.error(
      itemResult.error
    );

    return NextResponse.json(
      {
        error:
          "Equipment could not be added.",
      },
      {
        status: 500,
      }
    );
  }

  const item =
    itemResult.data as EquipmentLoanItem;

  return NextResponse.json(
    {
      success:
        true,

      item: {
        ...item,

        status:
          getEquipmentLoanItemStatus(
            item,
            loanResult.data
              .due_at
          ),
      },
    },
    {
      status: 201,
    }
  );
}