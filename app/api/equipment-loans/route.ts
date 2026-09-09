import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

import type {
  EquipmentBookingGroup,
  EquipmentLoan,
  EquipmentLoanDepartment,
  EquipmentLoanItem,
  EquipmentLoanStatus,
  RecentBorrower,
} from "@/types/equipmentLoans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_BOOKING_GROUPS: EquipmentBookingGroup[] = [
  "admin",
  "ansar",
  "khuddam",
];

const DEPARTMENTS: EquipmentLoanDepartment[] = [
  { id: "flag-hoisting", name: "Flag Hoisting" },
  { id: "flooring-carpet", name: "Flooring & Carpet" },
  { id: "fuel-supply", name: "Fuel Supply" },
  { id: "operations", name: "Operations" },
  { id: "power-supply-heating", name: "Power Supply & Heating" },
  { id: "reporting", name: "Reporting" },
  { id: "site-accounts", name: "Site Accounts" },
  { id: "site-admin", name: "Site Admin" },
  { id: "site-architecture", name: "Site Architecture" },
  { id: "site-beautification", name: "Site Beautification" },
  { id: "site-clearance", name: "Site Clearance" },
  { id: "site-office", name: "Site Office" },
  { id: "site-procurement", name: "Site Procurement" },
  { id: "site-setup-transition", name: "Site Setup & Transition" },
  { id: "site-transport", name: "Site Transport" },
  { id: "site-transition-wind-up", name: "Site Transition & Wind Up" },
  { id: "stage", name: "Stage" },
  { id: "stock-distribution", name: "Stock and Distribution" },
  { id: "water-maintenance", name: "Water Maintenance" },
];

interface EquipmentLoanRow {
  id: string;
  loan_date: string;
  booking_group: EquipmentBookingGroup | null;
  department_id: string;
  department_name_snapshot: string;
  borrower_name: string;
  borrower_aims_id: string;
  issued_at: string;
  due_at: string;
  created_at?: string | null;
}

interface EquipmentLoanItemRow {
  id: string;
  loan_id: string;
  item_name: string;
  quantity: number;
  quantity_returned: number;
  returned_at: string | null;
  created_at?: string | null;
}

function isBookingGroup(
  value: unknown
): value is EquipmentBookingGroup {
  return (
    typeof value === "string" &&
    VALID_BOOKING_GROUPS.includes(
      value as EquipmentBookingGroup
    )
  );
}

function isDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  );
}

function getLondonDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [
        part.type,
        part.value,
      ])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/*
 * Convert a London local date/time to its UTC ISO value.
 * This avoids hard-coding BST/GMT and remains correct if
 * the app is used around a clock change.
 */
function londonLocalToUtc(
  dateString: string,
  hour: number,
  minute: number
) {
  const [
    year,
    month,
    day,
  ] = dateString.split("-").map(Number);

  const desiredAsUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0
    );

  let candidate =
    desiredAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts =
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone: "Europe/London",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }
      ).formatToParts(
        new Date(candidate)
      );

    const values =
      Object.fromEntries(
        parts
          .filter(
            (part) =>
              part.type !==
              "literal"
          )
          .map(
            (part) => [
              part.type,
              part.value,
            ]
          )
      );

    const representedAsUtc =
      Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        Number(values.hour),
        Number(values.minute),
        0,
        0
      );

    const difference =
      desiredAsUtc -
      representedAsUtc;

    if (difference === 0) {
      break;
    }

    candidate +=
      difference;
  }

  return new Date(candidate);
}

function getItemStatus(
  item: EquipmentLoanItemRow,
  dueAt: string,
  now = new Date()
): EquipmentLoanStatus {
  const fullyReturned =
    item.quantity_returned >=
      item.quantity ||
    Boolean(item.returned_at);

  if (fullyReturned) {
    if (
      item.returned_at &&
      new Date(item.returned_at).getTime() >
        new Date(dueAt).getTime()
    ) {
      return "returned_late";
    }

    return "returned";
  }

  if (
    now.getTime() >
    new Date(dueAt).getTime()
  ) {
    return "late";
  }

  return "out";
}

function buildLoans(
  loanRows: EquipmentLoanRow[],
  itemRows: EquipmentLoanItemRow[],
  now = new Date()
): EquipmentLoan[] {
  const itemsByLoan =
    new Map<
      string,
      EquipmentLoanItemRow[]
    >();

  itemRows.forEach((item) => {
    const current =
      itemsByLoan.get(
        item.loan_id
      ) ?? [];

    current.push(item);

    itemsByLoan.set(
      item.loan_id,
      current
    );
  });

  return loanRows.map((loan) => {
    const items =
      (
        itemsByLoan.get(
          loan.id
        ) ?? []
      ).map(
        (
          item
        ): EquipmentLoanItem => {
          const status =
            getItemStatus(
              item,
              loan.due_at,
              now
            );

          return {
            ...item,
            status,
            outstandingQuantity:
              Math.max(
                item.quantity -
                  item.quantity_returned,
                0
              ),
          };
        }
      );

    const outstandingQuantity =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item
            .outstandingQuantity,
        0
      );

    let status: EquipmentLoanStatus =
      "out";

    if (
      items.length > 0 &&
      items.every(
        (item) =>
          item.status ===
            "returned" ||
          item.status ===
            "returned_late"
      )
    ) {
      status =
        items.some(
          (item) =>
            item.status ===
            "returned_late"
        )
          ? "returned_late"
          : "returned";
    } else if (
      items.some(
        (item) =>
          item.status ===
          "late"
      )
    ) {
      status = "late";
    }

    return {
      ...loan,
      items,
      status,
      outstandingQuantity,
    };
  });
}

function buildSummary(
  loans: EquipmentLoan[]
) {
  const items =
    loans.flatMap(
      (loan) =>
        loan.items
    );

  return {
    outstanding:
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item
            .outstandingQuantity,
        0
      ),

    late:
      items
        .filter(
          (item) =>
            item.status ===
            "late"
        )
        .reduce(
          (
            sum,
            item
          ) =>
            sum +
            item
              .outstandingQuantity,
          0
        ),

    activeLoans:
      loans.filter(
        (loan) =>
          loan.status ===
            "out" ||
          loan.status ===
            "late"
      ).length,

    returned:
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Math.min(
            item
              .quantity_returned,
            item.quantity
          ),
        0
      ),
  };
}

async function loadRecentBorrowers(
  bookingGroup: EquipmentBookingGroup
): Promise<RecentBorrower[]> {
  const result =
    await supabaseServer
      .from(
        "equipment_loans"
      )
      .select(
        "department_id,department_name_snapshot,borrower_name,borrower_aims_id,issued_at"
      )
      .eq(
        "booking_group",
        bookingGroup
      )
      .order(
        "issued_at",
        {
          ascending: false,
        }
      )
      .limit(60);

  if (result.error) {
    console.error(
      "Failed to load recent equipment borrowers:",
      result.error
    );

    return [];
  }

  const seen =
    new Set<string>();

  const borrowers:
    RecentBorrower[] =
    [];

  for (const row of
    result.data ??
    []) {
    const key =
      `${row.department_id}|${row.borrower_aims_id}|${row.borrower_name}`
        .toLowerCase();

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);

    borrowers.push({
      departmentId:
        row.department_id,
      departmentName:
        row.department_name_snapshot,
      borrowerName:
        row.borrower_name,
      borrowerAimsId:
        row.borrower_aims_id,
    });

    if (
      borrowers.length >=
      12
    ) {
      break;
    }
  }

  return borrowers;
}

async function loanBelongsToGroup(
  loanId: string,
  bookingGroup: EquipmentBookingGroup
) {
  const result =
    await supabaseServer
      .from(
        "equipment_loans"
      )
      .select(
        "id,booking_group"
      )
      .eq(
        "id",
        loanId
      )
      .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return (
    result.data?.booking_group ===
    bookingGroup
  );
}

async function itemBelongsToGroup(
  itemId: string,
  bookingGroup: EquipmentBookingGroup
) {
  const itemResult =
    await supabaseServer
      .from(
        "equipment_loan_items"
      )
      .select(
        "id,loan_id,quantity"
      )
      .eq(
        "id",
        itemId
      )
      .maybeSingle();

  if (itemResult.error) {
    throw itemResult.error;
  }

  if (!itemResult.data) {
    return null;
  }

  const belongs =
    await loanBelongsToGroup(
      itemResult.data
        .loan_id,
      bookingGroup
    );

  if (!belongs) {
    return null;
  }

  return itemResult.data;
}

export async function GET(
  request: Request
) {
  const url =
    new URL(
      request.url
    );

  const loanDate =
    url.searchParams.get(
      "date"
    );

  const bookingGroup =
    url.searchParams.get(
      "bookingGroup"
    );

  if (
    !isDateString(
      loanDate
    )
  ) {
    return NextResponse.json(
      {
        error:
          "A valid loan date is required.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !isBookingGroup(
      bookingGroup
    )
  ) {
    return NextResponse.json(
      {
        error:
          "A valid equipment booking group is required.",
      },
      {
        status: 400,
      }
    );
  }

  const loansResult =
    await supabaseServer
      .from(
        "equipment_loans"
      )
      .select(
        "id,loan_date,booking_group,department_id,department_name_snapshot,borrower_name,borrower_aims_id,issued_at,due_at,created_at"
      )
      .eq(
        "loan_date",
        loanDate
      )
      .eq(
        "booking_group",
        bookingGroup
      )
      .order(
        "issued_at",
        {
          ascending: false,
        }
      );

  if (
    loansResult.error
  ) {
    console.error(
      "Failed to load equipment loans:",
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

  const loanRows =
    (
      loansResult.data ??
      []
    ) as EquipmentLoanRow[];

  const loanIds =
    loanRows.map(
      (loan) =>
        loan.id
    );

  let itemRows:
    EquipmentLoanItemRow[] =
    [];

  if (
    loanIds.length >
    0
  ) {
    const itemsResult =
      await supabaseServer
        .from(
          "equipment_loan_items"
        )
        .select(
          "id,loan_id,item_name,quantity,quantity_returned,returned_at,created_at"
        )
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
        "Failed to load equipment loan items:",
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

    itemRows =
      (
        itemsResult.data ??
        []
      ) as EquipmentLoanItemRow[];
  }

  const loans =
    buildLoans(
      loanRows,
      itemRows
    );

  const recentBorrowers =
    await loadRecentBorrowers(
      bookingGroup
    );

  return NextResponse.json({
    success: true,
    loanDate,
    bookingGroup,
    departments:
      DEPARTMENTS,
    loans,
    recentBorrowers,
    summary:
      buildSummary(
        loans
      ),
  });
}

export async function POST(
  request: Request
) {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !==
      "object" ||
    body === null
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  const input =
    body as {
      bookingGroup?: unknown;
      departmentId?: unknown;
      borrowerName?: unknown;
      borrowerAimsId?: unknown;
      items?: unknown;
    };

  if (
    !isBookingGroup(
      input.bookingGroup
    )
  ) {
    return NextResponse.json(
      {
        error:
          "A valid equipment booking group is required.",
      },
      {
        status: 400,
      }
    );
  }

  const department =
    DEPARTMENTS.find(
      (candidate) =>
        candidate.id ===
        input.departmentId
    );

  if (!department) {
    return NextResponse.json(
      {
        error:
          "Select a valid department.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof input.borrowerName !==
      "string" ||
    !input.borrowerName.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Enter the borrower's name.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof input.borrowerAimsId !==
      "string" ||
    !input.borrowerAimsId.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Enter the borrower's AIMS ID.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    !Array.isArray(
      input.items
    ) ||
    input.items.length ===
      0
  ) {
    return NextResponse.json(
      {
        error:
          "Add at least one item of equipment.",
      },
      {
        status: 400,
      }
    );
  }

  const items:
    Array<{
      item_name: string;
      quantity: number;
    }> = [];

  for (const candidate of input.items) {
    if (
      typeof candidate !==
        "object" ||
      candidate === null
    ) {
      return NextResponse.json(
        {
          error:
            "One of the equipment items is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    const raw =
      candidate as {
        item_name?: unknown;
        quantity?: unknown;
      };

    if (
      typeof raw.item_name !==
        "string" ||
      !raw.item_name.trim() ||
      !Number.isInteger(
        raw.quantity
      ) ||
      Number(
        raw.quantity
      ) < 1
    ) {
      return NextResponse.json(
        {
          error:
            "Every equipment item needs a name and a quantity of at least 1.",
        },
        {
          status: 400,
        }
      );
    }

    items.push({
      item_name:
        raw.item_name.trim(),
      quantity:
        Number(
          raw.quantity
        ),
    });
  }

  const loanDate =
    getLondonDateString();

  const issuedAt =
    new Date();

  const dueAt =
    londonLocalToUtc(
      loanDate,
      23,
      0
    );

  const loanResult =
    await supabaseServer
      .from(
        "equipment_loans"
      )
      .insert({
        loan_date:
          loanDate,
        booking_group:
          input.bookingGroup,
        department_id:
          department.id,
        department_name_snapshot:
          department.name,
        borrower_name:
          input.borrowerName.trim(),
        borrower_aims_id:
          input.borrowerAimsId.trim(),
        issued_at:
          issuedAt.toISOString(),
        due_at:
          dueAt.toISOString(),
      })
      .select(
        "id"
      )
      .single();

  if (
    loanResult.error ||
    !loanResult.data
  ) {
    console.error(
      "Failed to create equipment loan:",
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

  const loanId =
    loanResult.data.id as string;

  const itemsResult =
    await supabaseServer
      .from(
        "equipment_loan_items"
      )
      .insert(
        items.map(
          (item) => ({
            loan_id:
              loanId,
            item_name:
              item.item_name,
            quantity:
              item.quantity,
            quantity_returned:
              0,
            returned_at:
              null,
          })
        )
      );

  if (
    itemsResult.error
  ) {
    console.error(
      "Failed to create equipment loan items:",
      itemsResult.error
    );

    await supabaseServer
      .from(
        "equipment_loans"
      )
      .delete()
      .eq(
        "id",
        loanId
      );

    return NextResponse.json(
      {
        error:
          "The equipment loan items could not be created.",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
    loanId,
  });
}

export async function PATCH(
  request: Request
) {
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  if (
    typeof body !==
      "object" ||
    body === null
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  const input =
    body as {
      action?: unknown;
      bookingGroup?: unknown;
      loanId?: unknown;
      itemId?: unknown;
      itemIds?: unknown;
      itemName?: unknown;
      quantity?: unknown;
      returned?: unknown;
    };

  if (
    !isBookingGroup(
      input.bookingGroup
    )
  ) {
    return NextResponse.json(
      {
        error:
          "A valid equipment booking group is required.",
      },
      {
        status: 400,
      }
    );
  }

  try {
    if (
      input.action ===
      "add_item"
    ) {
      if (
        typeof input.loanId !==
          "string" ||
        !input.loanId.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "A valid loan is required.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        typeof input.itemName !==
          "string" ||
        !input.itemName.trim() ||
        !Number.isInteger(
          input.quantity
        ) ||
        Number(
          input.quantity
        ) < 1
      ) {
        return NextResponse.json(
          {
            error:
              "Enter a valid tool name and quantity.",
          },
          {
            status: 400,
          }
        );
      }

      const belongs =
        await loanBelongsToGroup(
          input.loanId,
          input.bookingGroup
        );

      if (!belongs) {
        return NextResponse.json(
          {
            error:
              "This loan does not belong to your equipment portal.",
          },
          {
            status: 403,
          }
        );
      }

      const result =
        await supabaseServer
          .from(
            "equipment_loan_items"
          )
          .insert({
            loan_id:
              input.loanId,
            item_name:
              input.itemName.trim(),
            quantity:
              Number(
                input.quantity
              ),
            quantity_returned:
              0,
            returned_at:
              null,
          });

      if (result.error) {
        throw result.error;
      }

      return NextResponse.json({
        success: true,
      });
    }

    if (
      input.action ===
      "set_item_returned"
    ) {
      if (
        typeof input.itemId !==
          "string" ||
        !input.itemId.trim() ||
        typeof input.returned !==
          "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "A valid equipment return update is required.",
          },
          {
            status: 400,
          }
        );
      }

      const item =
        await itemBelongsToGroup(
          input.itemId,
          input.bookingGroup
        );

      if (!item) {
        return NextResponse.json(
          {
            error:
              "This equipment item does not belong to your equipment portal.",
          },
          {
            status: 403,
          }
        );
      }

      const result =
        await supabaseServer
          .from(
            "equipment_loan_items"
          )
          .update({
            quantity_returned:
              input.returned
                ? item.quantity
                : 0,
            returned_at:
              input.returned
                ? new Date()
                    .toISOString()
                : null,
          })
          .eq(
            "id",
            item.id
          );

      if (result.error) {
        throw result.error;
      }

      return NextResponse.json({
        success: true,
      });
    }

    if (
      input.action ===
      "set_items_returned"
    ) {
      if (
        !Array.isArray(
          input.itemIds
        ) ||
        input.itemIds.length ===
          0 ||
        !input.itemIds.every(
          (itemId) =>
            typeof itemId ===
              "string" &&
            Boolean(
              itemId.trim()
            )
        ) ||
        typeof input.returned !==
          "boolean"
      ) {
        return NextResponse.json(
          {
            error:
              "A valid list of equipment items is required.",
          },
          {
            status: 400,
          }
        );
      }

      const ids =
        Array.from(
          new Set(
            input.itemIds as string[]
          )
        );

      const itemsResult =
        await supabaseServer
          .from(
            "equipment_loan_items"
          )
          .select(
            "id,loan_id,quantity"
          )
          .in(
            "id",
            ids
          );

      if (
        itemsResult.error
      ) {
        throw itemsResult.error;
      }

      if (
        !itemsResult.data ||
        itemsResult.data.length !==
          ids.length
      ) {
        return NextResponse.json(
          {
            error:
              "One or more equipment items could not be found.",
          },
          {
            status: 404,
          }
        );
      }

      const loanIds =
        Array.from(
          new Set(
            itemsResult.data.map(
              (item) =>
                item.loan_id
            )
          )
        );

      const loansResult =
        await supabaseServer
          .from(
            "equipment_loans"
          )
          .select(
            "id,booking_group"
          )
          .in(
            "id",
            loanIds
          );

      if (
        loansResult.error
      ) {
        throw loansResult.error;
      }

      const allBelong =
        (
          loansResult.data ??
          []
        ).length ===
          loanIds.length &&
        (
          loansResult.data ??
          []
        ).every(
          (loan) =>
            loan.booking_group ===
            input.bookingGroup
        );

      if (!allBelong) {
        return NextResponse.json(
          {
            error:
              "One or more equipment items do not belong to your equipment portal.",
          },
          {
            status: 403,
          }
        );
      }

      const returnedAt =
        input.returned
          ? new Date()
              .toISOString()
          : null;

      const updates =
        await Promise.all(
          itemsResult.data.map(
            (item) =>
              supabaseServer
                .from(
                  "equipment_loan_items"
                )
                .update({
                  quantity_returned:
                    input.returned
                      ? item.quantity
                      : 0,
                  returned_at:
                    returnedAt,
                })
                .eq(
                  "id",
                  item.id
                )
          )
        );

      const failed =
        updates.find(
          (result) =>
            result.error
        );

      if (
        failed?.error
      ) {
        throw failed.error;
      }

      return NextResponse.json({
        success: true,
      });
    }

    return NextResponse.json(
      {
        error:
          "Unknown equipment loan action.",
      },
      {
        status: 400,
      }
    );
  } catch (mutationError) {
    console.error(
      "Equipment loan update failed:",
      mutationError
    );

    return NextResponse.json(
      {
        error:
          "The equipment loan update could not be saved.",
      },
      {
        status: 500,
      }
    );
  }
}
