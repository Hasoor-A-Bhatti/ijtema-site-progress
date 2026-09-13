export const SITE_ACCOUNTS_DEPARTMENT_ID = "site-accounts";
export const SITE_ACCOUNTS_FIELD_COUNT = 6;

export const SITE_ACCOUNTS_EXPENSE_DEPARTMENTS = [
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
  { id: "mileage-claim", name: "Mileage Claim" },
] as const;

export type SiteAccountsExpenseField =
  | "submitted"
  | "pending_approval"
  | "approved_remaining"
  | "paid";

export interface SiteAccountsExpenseEntry {
  department_name: string;
  submitted: number;
  pending_approval: number;
  approved_remaining: number;
  paid: number;
}

export interface SiteAccountsTrackerValues {
  version: 1;
  total_budget: number | null;
  departmental_expenses: Record<string, SiteAccountsExpenseEntry>;
}

export interface SiteAccountsStoredValues {
  custom_answers: SiteAccountsTrackerValues;
  signature_name_aims_id: string;
}

export interface SiteAccountsTotals {
  paid: number;
  remaining: number;
  pendingApproval: number;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function createEmptySiteAccountsTracker(): SiteAccountsTrackerValues {
  return {
    version: 1,
    total_budget: null,
    departmental_expenses: Object.fromEntries(
      SITE_ACCOUNTS_EXPENSE_DEPARTMENTS.map((department) => [
        department.id,
        {
          department_name: department.name,
          submitted: 0,
          pending_approval: 0,
          approved_remaining: 0,
          paid: 0,
        },
      ])
    ),
  };
}

function normaliseMoney(
  value: unknown,
  label: string,
  options: { allowNull?: boolean } = {}
): { value: number | null; error: string | null } {
  if (
    options.allowNull &&
    (value === null || value === undefined || value === "")
  ) {
    return { value: null, error: null };
  }

  if (value === null || value === undefined || value === "") {
    return { value: 0, error: null };
  }

  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return {
      value: null,
      error: `${label} must be a valid amount of 0 or more.`,
    };
  }

  return {
    value: roundMoney(numberValue),
    error: null,
  };
}

export function normaliseSiteAccountsForm(input: unknown):
  | { values: SiteAccountsStoredValues; error: null }
  | { values: null; error: string } {
  if (typeof input !== "object" || input === null) {
    return {
      values: null,
      error: "Invalid Site Accounts information.",
    };
  }

  const body = input as Record<string, unknown>;
  const signature = body.signature_name_aims_id;

  if (signature !== undefined && typeof signature !== "string") {
    return {
      values: null,
      error: "Invalid Site Accounts signature.",
    };
  }

  const rawTracker =
    typeof body.custom_answers === "object" && body.custom_answers !== null
      ? (body.custom_answers as Record<string, unknown>)
      : body;

  const totalBudget = normaliseMoney(
    rawTracker.total_budget,
    "Total budget amount",
    { allowNull: true }
  );

  if (totalBudget.error) {
    return {
      values: null,
      error: totalBudget.error,
    };
  }

  const rawExpenses =
    typeof rawTracker.departmental_expenses === "object" &&
    rawTracker.departmental_expenses !== null
      ? (rawTracker.departmental_expenses as Record<string, unknown>)
      : {};

  const departmentalExpenses: Record<string, SiteAccountsExpenseEntry> = {};

  for (const department of SITE_ACCOUNTS_EXPENSE_DEPARTMENTS) {
    const rawEntry =
      typeof rawExpenses[department.id] === "object" &&
      rawExpenses[department.id] !== null
        ? (rawExpenses[department.id] as Record<string, unknown>)
        : {};

    const submitted = normaliseMoney(
      rawEntry.submitted,
      `${department.name} submitted amount`
    );
    const pendingApproval = normaliseMoney(
      rawEntry.pending_approval,
      `${department.name} pending approval amount`
    );
    const approvedRemaining = normaliseMoney(
      rawEntry.approved_remaining,
      `${department.name} approved / remaining amount`
    );
    const paid = normaliseMoney(
      rawEntry.paid,
      `${department.name} paid amount`
    );

    const error =
      submitted.error ??
      pendingApproval.error ??
      approvedRemaining.error ??
      paid.error;

    if (error) {
      return {
        values: null,
        error,
      };
    }

    departmentalExpenses[department.id] = {
      department_name: department.name,
      submitted: submitted.value ?? 0,
      pending_approval: pendingApproval.value ?? 0,
      approved_remaining: approvedRemaining.value ?? 0,
      paid: paid.value ?? 0,
    };
  }

  return {
    error: null,
    values: {
      custom_answers: {
        version: 1,
        total_budget: totalBudget.value,
        departmental_expenses: departmentalExpenses,
      },
      signature_name_aims_id:
        typeof signature === "string" ? signature.trim() : "",
    },
  };
}

export function validateSiteAccountsForSubmission(
  values: SiteAccountsStoredValues
) {
  if (values.custom_answers.total_budget === null) {
    return "Enter the total budget amount.";
  }

  if (!values.signature_name_aims_id.trim()) {
    return "Enter the signatory Name & AIMS ID.";
  }

  return null;
}

export function isSiteAccountsTrackerValues(
  value: unknown
): value is SiteAccountsTrackerValues {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SiteAccountsTrackerValues>;

  return (
    candidate.version === 1 &&
    (candidate.total_budget === null ||
      typeof candidate.total_budget === "number") &&
    typeof candidate.departmental_expenses === "object" &&
    candidate.departmental_expenses !== null
  );
}

export function getSiteAccountsTotals(
  tracker: SiteAccountsTrackerValues
): SiteAccountsTotals {
  return Object.values(tracker.departmental_expenses).reduce<SiteAccountsTotals>(
    (totals, entry) => ({
      paid: roundMoney(totals.paid + entry.paid),
      remaining: roundMoney(
        totals.remaining + entry.approved_remaining
      ),
      pendingApproval: roundMoney(
        totals.pendingApproval + entry.pending_approval
      ),
    }),
    {
      paid: 0,
      remaining: 0,
      pendingApproval: 0,
    }
  );
}
