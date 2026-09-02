import type {
  EquipmentLoan,
  EquipmentLoanItem,
  EquipmentLoanStatus,
} from "@/types/equipmentLoans";

export const EQUIPMENT_LOAN_TIME_ZONE =
  "Europe/London";

export const EQUIPMENT_RETURN_HOUR = 23;

export function getLondonDateString(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat("en-GB", {
      timeZone: EQUIPMENT_LOAN_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function isValidLoanDate(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getEquipmentLoanItemStatus(
  item: EquipmentLoanItem,
  dueAt: string,
  now = new Date()
): EquipmentLoanStatus {
  const fullyReturned =
    item.quantity_returned >= item.quantity;

  /*
   * Any remaining quantity is still outstanding.
   */
  if (!fullyReturned) {
    return now.getTime() >
      new Date(dueAt).getTime()
      ? "late"
      : "out";
  }

  /*
   * Defensive fallback. Normally full returns
   * always have returned_at set by the API.
   */
  if (!item.returned_at) {
    return now.getTime() >
      new Date(dueAt).getTime()
      ? "returned_late"
      : "returned";
  }

  return new Date(item.returned_at).getTime() >
    new Date(dueAt).getTime()
    ? "returned_late"
    : "returned";
}

export function getEquipmentLoanStatus(
  loan: EquipmentLoan,
  items: EquipmentLoanItem[],
  now = new Date()
): EquipmentLoanStatus {
  const statuses =
    items.map((item) =>
      getEquipmentLoanItemStatus(
        item,
        loan.due_at,
        now
      )
    );

  if (
    statuses.some(
      (status) => status === "late"
    )
  ) {
    return "late";
  }

  if (
    statuses.some(
      (status) => status === "out"
    )
  ) {
    return "out";
  }

  if (
    statuses.some(
      (status) => status === "returned_late"
    )
  ) {
    return "returned_late";
  }

  return "returned";
}

export function getLoanQuantities(
  items: EquipmentLoanItem[]
) {
  const totalQuantity =
    items.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  const returnedQuantity =
    items.reduce(
      (sum, item) =>
        sum +
        Math.min(
          item.quantity_returned,
          item.quantity
        ),
      0
    );

  return {
    totalQuantity,
    returnedQuantity,

    outstandingQuantity:
      totalQuantity -
      returnedQuantity,
  };
}