import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  hasValidEditorSession,
} from "@/lib/auth/requireEditorSession";

import {
  getEquipmentLoanItemStatus,
  getEquipmentLoanStatus,
  getLoanQuantities,
  getLondonDateString,
  isValidLoanDate,
} from "@/lib/equipmentLoans/loanUtils";

import {
  supabaseServer,
} from "@/lib/supabaseServer";

import type {
  EquipmentLoan,
  EquipmentLoanItem,
  EquipmentLoanView,
  NewEquipmentLoanItem,
  RecentBorrower,
} from "@/types/equipmentLoans";

export async function GET(
  request: NextRequest
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

  const requestedDate =
    request.nextUrl.searchParams.get(
      "date"
    ) ?? getLondonDateString();

  if (
    !isValidLoanDate(
      requestedDate
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid loan date.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * Load:
   * - departments
   * - loans for selected date
   * - recent borrower activity
   */
  const [
    departmentsResult,
    loansResult,
    recentLoansResult,
  ] = await Promise.all([
    supabaseServer
      .from(
        "report_departments"
      )
      .select(
        "id,name,nazim_name,sort_order,active"
      )
      .eq(
        "active",
        true
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      ),

    supabaseServer
      .from(
        "equipment_loans"
      )
      .select("*")
      .eq(
        "loan_date",
        requestedDate
      )
      .order(
        "issued_at",
        {
          ascending: false,
        }
      ),

    supabaseServer
      .from(
        "equipment_loans"
      )
      .select(
        "department_id,department_name_snapshot,borrower_name,borrower_aims_id,issued_at"
      )
      .order(
        "issued_at",
        {
          ascending: false,
        }
      )
      .limit(50),
  ]);

  if (
    departmentsResult.error
  ) {
    console.error(
      "Departments error:",
      departmentsResult.error
    );

    return NextResponse.json(
      {
        error:
          "Departments could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    loansResult.error
  ) {
    console.error(
      "Equipment loans error:",
      loansResult.error
    );

    return NextResponse.json(
      {
        error:
          "Equipment loans could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    recentLoansResult.error
  ) {
    console.error(
      "Recent borrowers error:",
      recentLoansResult.error
    );
  }

  const loans =
    (loansResult.data ??
      []) as EquipmentLoan[];

  const loanIds =
    loans.map(
      (loan) => loan.id
    );

  let items:
    EquipmentLoanItem[] = [];

  /*
   * Only query loan items when
   * there are loans for the day.
   */
  if (
    loanIds.length > 0
  ) {
    const itemsResult =
      await supabaseServer
        .from(
          "equipment_loan_items"
        )
        .select("*")
        .in(
          "loan_id",
          loanIds
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );

    if (
      itemsResult.error
    ) {
      console.error(
        "Equipment loan items error:",
        itemsResult.error
      );

      return NextResponse.json(
        {
          error:
            "Equipment loan items could not be loaded.",
        },
        {
          status: 500,
        }
      );
    }

    items =
      (itemsResult.data ??
        []) as EquipmentLoanItem[];
  }

  const now =
    new Date();

  /*
   * Convert database loans into
   * dashboard-ready loan views.
   */
  const loanViews:
    EquipmentLoanView[] =
    loans.map((loan) => {
      const loanItems =
        items.filter(
          (item) =>
            item.loan_id ===
            loan.id
        );

      const quantities =
        getLoanQuantities(
          loanItems
        );

      return {
        ...loan,
        ...quantities,

        status:
          getEquipmentLoanStatus(
            loan,
            loanItems,
            now
          ),

        items:
          loanItems.map(
            (item) => ({
              ...item,

              status:
                getEquipmentLoanItemStatus(
                  item,
                  loan.due_at,
                  now
                ),
            })
          ),
      };
    });

  /*
   * CURRENTLY OUT
   *
   * Quantity-based rather than
   * row-based.
   *
   * Example:
   * 6 issued
   * 2 returned
   * = 4 outstanding
   */
  const outstandingQuantity =
    loanViews.reduce(
      (sum, loan) =>
        sum +
        loan.outstandingQuantity,
      0
    );

  /*
   * LATE
   *
   * Only count the quantity
   * still outstanding after 23:00.
   *
   * 6 loaned
   * 2 returned
   * = 4 late
   */
  const lateQuantity =
    loanViews.reduce(
      (sum, loan) =>
        sum +
        loan.items
          .filter(
            (item) =>
              item.status ===
              "late"
          )
          .reduce(
            (
              itemSum,
              item
            ) =>
              itemSum +
              Math.max(
                item.quantity -
                  item.quantity_returned,
                0
              ),
            0
          ),
      0
    );

  /*
   * RETURNED
   *
   * Counts quantities already
   * physically returned, including
   * partial returns.
   */
  const returnedQuantity =
    loanViews.reduce(
      (sum, loan) =>
        sum +
        loan.returnedQuantity,
      0
    );

  /*
   * Number of distinct departments
   * currently holding equipment.
   */
  const departmentsWithOutstanding =
    new Set(
      loanViews
        .filter(
          (loan) =>
            loan.outstandingQuantity >
            0
        )
        .map(
          (loan) =>
            loan.department_id
        )
    ).size;

  /*
   * Build recent-borrower shortcuts
   * without needing another table.
   */
  const recentBorrowers:
    RecentBorrower[] = [];

  const seenBorrowers =
    new Set<string>();

  for (
    const row of
    recentLoansResult.data ??
    []
  ) {
    const key =
      `${row.department_id}::${row.borrower_aims_id}`
        .toLowerCase();

    if (
      seenBorrowers.has(
        key
      )
    ) {
      continue;
    }

    seenBorrowers.add(
      key
    );

    recentBorrowers.push({
      departmentId:
        row.department_id,

      departmentName:
        row.department_name_snapshot,

      borrowerName:
        row.borrower_name,

      borrowerAimsId:
        row.borrower_aims_id,

      lastUsedAt:
        row.issued_at,
    });

    if (
      recentBorrowers.length >=
      8
    ) {
      break;
    }
  }

  return NextResponse.json({
    success: true,

    loanDate:
      requestedDate,

    serverTime:
      now.toISOString(),

    summary: {
      outstanding:
        outstandingQuantity,

      late:
        lateQuantity,

      departmentsWithOutstanding,

      returned:
        returnedQuantity,

      activeLoans:
        loanViews.filter(
          (loan) =>
            loan.outstandingQuantity >
            0
        ).length,
    },

    departments:
      departmentsResult.data ??
      [],

    recentBorrowers,

    loans:
      loanViews,
  });
}

export async function POST(
  request: NextRequest
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

  const body =
    (await request
      .json()
      .catch(() => null)) as
      | {
          departmentId?: unknown;
          borrowerName?: unknown;
          borrowerAimsId?: unknown;
          items?: unknown;
        }
      | null;

  if (!body) {
    return NextResponse.json(
      {
        error:
          "Invalid loan information.",
      },
      {
        status: 400,
      }
    );
  }

  const departmentId =
    typeof body.departmentId ===
    "string"
      ? body.departmentId.trim()
      : "";

  const borrowerName =
    typeof body.borrowerName ===
    "string"
      ? body.borrowerName.trim()
      : "";

  const borrowerAimsId =
    typeof body.borrowerAimsId ===
    "string"
      ? body.borrowerAimsId.trim()
      : "";

  if (!departmentId) {
    return NextResponse.json(
      {
        error:
          "Select a department.",
      },
      {
        status: 400,
      }
    );
  }

  if (!borrowerName) {
    return NextResponse.json(
      {
        error:
          "Borrower name is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (!borrowerAimsId) {
    return NextResponse.json(
      {
        error:
          "Borrower AIMS ID is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Array.isArray(
      body.items
    ) ||
    body.items.length ===
      0
  ) {
    return NextResponse.json(
      {
        error:
          "Add at least one tool to the loan.",
      },
      {
        status: 400,
      }
    );
  }

  const items:
    NewEquipmentLoanItem[] =
    [];

  /*
   * Validate every manually-entered
   * equipment line.
   */
  for (
    const rawItem of
    body.items
  ) {
    if (
      typeof rawItem !==
        "object" ||
      rawItem === null
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid equipment item.",
        },
        {
          status: 400,
        }
      );
    }

    const item =
      rawItem as {
        item_name?: unknown;
        quantity?: unknown;
      };

    const itemName =
      typeof item.item_name ===
      "string"
        ? item.item_name.trim()
        : "";

    const quantity =
      typeof item.quantity ===
      "number"
        ? item.quantity
        : 1;

    if (!itemName) {
      return NextResponse.json(
        {
          error:
            "Every equipment item needs a name.",
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
            "Equipment quantity must be at least 1.",
        },
        {
          status: 400,
        }
      );
    }

    items.push({
      item_name:
        itemName,

      quantity,
    });
  }

  /*
   * Validate the department.
   */
  const departmentResult =
    await supabaseServer
      .from(
        "report_departments"
      )
      .select(
        "id,name"
      )
      .eq(
        "id",
        departmentId
      )
      .eq(
        "active",
        true
      )
      .maybeSingle();

  if (
    departmentResult.error ||
    !departmentResult.data
  ) {
    return NextResponse.json(
      {
        error:
          "Department could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const loanDate =
    getLondonDateString();

  /*
   * Database trigger automatically sets:
   *
   * department_name_snapshot
   * due_at = 23:00 Europe/London
   */
  const loanResult =
    await supabaseServer
      .from(
        "equipment_loans"
      )
      .insert({
        department_id:
          departmentId,

        borrower_name:
          borrowerName,

        borrower_aims_id:
          borrowerAimsId,

        loan_date:
          loanDate,
      })
      .select("*")
      .single();

  if (
    loanResult.error ||
    !loanResult.data
  ) {
    console.error(
      "Create equipment loan error:",
      loanResult.error
    );

    return NextResponse.json(
      {
        error:
          "The equipment loan could not be created.",
      },
      {
        status: 500,
      }
    );
  }

  const loan =
    loanResult.data as EquipmentLoan;

  /*
   * quantity_returned does not need to be
   * specified because the database defaults
   * it to 0.
   */
  const itemResult =
    await supabaseServer
      .from(
        "equipment_loan_items"
      )
      .insert(
        items.map((item) => ({
          loan_id:
            loan.id,

          item_name:
            item.item_name,

          quantity:
            item.quantity,
        }))
      )
      .select("*");

  if (
    itemResult.error
  ) {
    console.error(
      "Create equipment items error:",
      itemResult.error
    );

    /*
     * Avoid leaving behind a loan
     * containing no tools.
     */
    await supabaseServer
      .from(
        "equipment_loans"
      )
      .delete()
      .eq(
        "id",
        loan.id
      );

    return NextResponse.json(
      {
        error:
          "The equipment items could not be added.",
      },
      {
        status: 500,
      }
    );
  }

  const createdItems =
    (itemResult.data ??
      []) as EquipmentLoanItem[];

  const quantities =
    getLoanQuantities(
      createdItems
    );

  return NextResponse.json(
    {
      success: true,

      loan: {
        ...loan,
        ...quantities,

        status:
          getEquipmentLoanStatus(
            loan,
            createdItems
          ),

        items:
          createdItems.map(
            (item) => ({
              ...item,

              status:
                getEquipmentLoanItemStatus(
                  item,
                  loan.due_at
                ),
            })
          ),
      },
    },
    {
      status: 201,
    }
  );
}