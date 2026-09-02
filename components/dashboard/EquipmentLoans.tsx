"use client";

import {
  FormEvent,
  KeyboardEvent,
  useMemo,
  useState,
} from "react";

import useEquipmentLoans from "@/hooks/useEquipmentLoans";
import { getLondonDateString } from "@/lib/equipmentLoans/loanUtils";

import type {
  EquipmentLoanItemView,
  EquipmentLoanStatus,
  NewEquipmentLoanItem,
  RecentBorrower,
} from "@/types/equipmentLoans";

type LoanFilter = "all" | "out" | "late" | "returned";

interface EquipmentLoansProps {
  enabled: boolean;
}

interface DraftItem extends NewEquipmentLoanItem {
  localId: string;
}

interface PartialReturnState {
  itemId: string;
  itemName: string;
  quantity: number;
  quantityReturned: number;
}

const FILTERS: Array<{
  value: LoanFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "out", label: "Out" },
  { value: "late", label: "Late" },
  { value: "returned", label: "Returned" },
];

function addDays(date: string, amount: number) {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + amount));

  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function statusStyle(status: EquipmentLoanStatus) {
  switch (status) {
    case "late":
      return {
        label: "Late",
        classes: "bg-red-100 text-red-700",
      };

    case "returned":
      return {
        label: "Returned",
        classes: "bg-emerald-100 text-emerald-700",
      };

    case "returned_late":
      return {
        label: "Returned Late",
        classes: "bg-amber-100 text-amber-700",
      };

    default:
      return {
        label: "Out",
        classes: "bg-blue-100 text-blue-700",
      };
  }
}

function returnedCount(item: EquipmentLoanItemView) {
  const value =
    item.quantity_returned ??
    (item.returned_at ? item.quantity : 0);

  return Math.min(
    item.quantity,
    Math.max(0, value)
  );
}

function SummaryCard({
  label,
  value,
  caption,
  className,
}: {
  label: string;
  value: string | number;
  caption: string;
  className: string;
}) {
  return (
    <div className={`rounded-xl p-4 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
        {label}
      </p>

      <p className="mt-1 text-3xl font-bold">{value}</p>

      <p className="mt-1 text-xs opacity-70">{caption}</p>
    </div>
  );
}

export default function EquipmentLoans({
  enabled,
}: EquipmentLoansProps) {
  const today = getLondonDateString();

  const [loanDate, setLoanDate] = useState(today);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LoanFilter>("all");

  const [showNewLoan, setShowNewLoan] = useState(false);

  const [departmentId, setDepartmentId] = useState("");
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerAimsId, setBorrowerAimsId] = useState("");

  const [itemName, setItemName] = useState("");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);

  const [newLoanError, setNewLoanError] =
    useState<string | null>(null);

  const [inlineError, setInlineError] =
    useState<string | null>(null);

  const [issuing, setIssuing] = useState(false);

  const [changingItemId, setChangingItemId] =
    useState<string | null>(null);

  const [returningLoanId, setReturningLoanId] =
    useState<string | null>(null);

  const [addingToLoanId, setAddingToLoanId] =
    useState<string | null>(null);

  const [extraItemName, setExtraItemName] = useState("");
  const [extraItemQuantity, setExtraItemQuantity] = useState(1);

  /*
   * Partial return sheet.
   */
  const [partialReturn, setPartialReturn] =
    useState<PartialReturnState | null>(null);

  const [returnNow, setReturnNow] = useState(1);
  const [savingPartialReturn, setSavingPartialReturn] =
    useState(false);

  const {
    data,
    loading,
    error,
    refresh,
    createLoan,
    addItem,
    setItemReturned,
    setItemsReturned,
    setItemReturnedQuantity,
  } = useEquipmentLoans(loanDate, enabled);

  const isToday = loanDate === today;

  const toolSuggestions = useMemo(() => {
    const names = new Set<string>();

    data?.loans.forEach((loan) =>
      loan.items.forEach((item) => names.add(item.item_name))
    );

    return Array.from(names).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [data]);

  const filteredLoans = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();

    return data.loans.filter((loan) => {
      const matchesSearch =
        !query ||
        loan.department_name_snapshot
          .toLowerCase()
          .includes(query) ||
        loan.borrower_name
          .toLowerCase()
          .includes(query) ||
        loan.borrower_aims_id
          .toLowerCase()
          .includes(query) ||
        loan.items.some((item) =>
          item.item_name.toLowerCase().includes(query)
        );

      const matchesFilter =
        filter === "all" ||
        (filter === "out" && loan.status === "out") ||
        (filter === "late" && loan.status === "late") ||
        (filter === "returned" &&
          (loan.status === "returned" ||
            loan.status === "returned_late"));

      return matchesSearch && matchesFilter;
    });
  }, [data, search, filter]);

  const lateLoans =
    data?.loans.filter((loan) => loan.status === "late") ?? [];

  function resetNewLoan() {
    setDepartmentId("");
    setBorrowerName("");
    setBorrowerAimsId("");
    setItemName("");
    setItemQuantity(1);
    setDraftItems([]);
    setNewLoanError(null);
  }

  function closeNewLoan() {
    if (issuing) return;

    setShowNewLoan(false);
    resetNewLoan();
  }

  function applyRecentBorrower(borrower: RecentBorrower) {
    setDepartmentId(borrower.departmentId);
    setBorrowerName(borrower.borrowerName);
    setBorrowerAimsId(borrower.borrowerAimsId);
    setNewLoanError(null);
  }

  function addDraftItem() {
    const cleanName = itemName.trim();

    if (!cleanName) {
      setNewLoanError(
        "Enter the name of the tool or equipment."
      );
      return;
    }

    if (!Number.isInteger(itemQuantity) || itemQuantity < 1) {
      setNewLoanError("Quantity must be at least 1.");
      return;
    }

    setDraftItems((current) => {
      const existing = current.find(
        (item) =>
          item.item_name.toLowerCase() ===
          cleanName.toLowerCase()
      );

      if (existing) {
        return current.map((item) =>
          item.localId === existing.localId
            ? {
                ...item,
                quantity: item.quantity + itemQuantity,
              }
            : item
        );
      }

      return [
        ...current,
        {
          localId: crypto.randomUUID(),
          item_name: cleanName,
          quantity: itemQuantity,
        },
      ];
    });

    setItemName("");
    setItemQuantity(1);
    setNewLoanError(null);
  }

  function handleToolKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    addDraftItem();
  }

  async function handleCreateLoan(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!departmentId) {
      setNewLoanError("Select a department.");
      return;
    }

    if (!borrowerName.trim()) {
      setNewLoanError("Enter the borrower's name.");
      return;
    }

    if (!borrowerAimsId.trim()) {
      setNewLoanError("Enter the borrower's AIMS ID.");
      return;
    }

    if (!draftItems.length) {
      setNewLoanError("Add at least one tool to the loan.");
      return;
    }

    setIssuing(true);
    setNewLoanError(null);

    const result = await createLoan({
      departmentId,
      borrowerName: borrowerName.trim(),
      borrowerAimsId: borrowerAimsId.trim(),

      items: draftItems.map(({ item_name, quantity }) => ({
        item_name,
        quantity,
      })),
    });

    setIssuing(false);

    if (!result.success) {
      setNewLoanError(
        result.error ??
          "The equipment loan could not be created."
      );
      return;
    }

    setShowNewLoan(false);
    resetNewLoan();
  }

  /*
   * Quantity = 1 keeps the quick checkbox workflow.
   */
  async function toggleSingleReturned(
    item: EquipmentLoanItemView
  ) {
    const returned = returnedCount(item) >= item.quantity;

    if (
      returned &&
      !window.confirm(
        "Mark this item as outstanding again?"
      )
    ) {
      return;
    }

    setChangingItemId(item.id);
    setInlineError(null);

    const result = await setItemReturned(
      item.id,
      !returned
    );

    setChangingItemId(null);

    if (!result.success) {
      setInlineError(
        result.error ??
          "The equipment return could not be updated."
      );
    }
  }

  /*
   * Quantity >1 opens the partial-return sheet.
   */
  function openPartialReturn(item: EquipmentLoanItemView) {
    const alreadyReturned = returnedCount(item);

    setPartialReturn({
      itemId: item.id,
      itemName: item.item_name,
      quantity: item.quantity,
      quantityReturned: alreadyReturned,
    });

    setReturnNow(1);
    setInlineError(null);
  }

  function closePartialReturn() {
    if (savingPartialReturn) return;

    setPartialReturn(null);
    setReturnNow(1);
  }

  async function confirmPartialReturn() {
    if (!partialReturn) return;

    const outstanding =
      partialReturn.quantity -
      partialReturn.quantityReturned;

    const amount = Math.min(
      Math.max(returnNow, 1),
      outstanding
    );

    const newTotal =
      partialReturn.quantityReturned + amount;

    setSavingPartialReturn(true);

    const result = await setItemReturnedQuantity(
      partialReturn.itemId,
      newTotal
    );

    setSavingPartialReturn(false);

    if (!result.success) {
      setInlineError(
        result.error ??
          "The partial return could not be recorded."
      );
      return;
    }

    setPartialReturn(null);
    setReturnNow(1);
  }

  async function reopenMultiItem(
    item: EquipmentLoanItemView
  ) {
    if (
      !window.confirm(
        `Mark all ${item.quantity} × ${item.item_name} as outstanding again?`
      )
    ) {
      return;
    }

    setChangingItemId(item.id);
    setInlineError(null);

    const result = await setItemReturnedQuantity(
      item.id,
      0
    );

    setChangingItemId(null);

    if (!result.success) {
      setInlineError(
        result.error ??
          "The equipment return could not be changed."
      );
    }
  }

  async function returnAll(loanId: string) {
    const loan = data?.loans.find(
      (item) => item.id === loanId
    );

    if (!loan) return;

    const outstandingIds = loan.items
      .filter(
        (item) =>
          returnedCount(item) < item.quantity
      )
      .map((item) => item.id);

    if (!outstandingIds.length) return;

    if (
      !window.confirm(
        `Confirm all outstanding equipment for ${loan.borrower_name} has been returned?`
      )
    ) {
      return;
    }

    setReturningLoanId(loanId);
    setInlineError(null);

    const result = await setItemsReturned(
      outstandingIds,
      true
    );

    setReturningLoanId(null);

    if (!result.success) {
      setInlineError(
        result.error ??
          "Not all equipment could be marked returned."
      );
    }
  }

  async function submitExtraItem(loanId: string) {
    const cleanName = extraItemName.trim();

    if (!cleanName) {
      setInlineError("Enter the tool name.");
      return;
    }

    if (
      !Number.isInteger(extraItemQuantity) ||
      extraItemQuantity < 1
    ) {
      setInlineError("Quantity must be at least 1.");
      return;
    }

    setInlineError(null);

    const result = await addItem(
      loanId,
      cleanName,
      extraItemQuantity
    );

    if (!result.success) {
      setInlineError(
        result.error ?? "The tool could not be added."
      );
      return;
    }

    setAddingToLoanId(null);
    setExtraItemName("");
    setExtraItemQuantity(1);
  }

  const partialOutstanding = partialReturn
    ? partialReturn.quantity -
      partialReturn.quantityReturned
    : 0;

  const partialAfterReturn = partialReturn
    ? Math.min(
        partialReturn.quantity,
        partialReturn.quantityReturned + returnNow
      )
    : 0;

  return (
    <div className="p-3 sm:p-6">
      {/* HEADER */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Equipment Control
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">
              Equipment Loans
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              All tools are due back by 23:00.
            </p>
          </div>

          {/* MOBILE-FRIENDLY DATE CONTROLS */}
          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() =>
                setLoanDate(addDays(loanDate, -1))
              }
              className="flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 hover:bg-slate-50 sm:w-11"
            >
              ←
            </button>

            <input
              type="date"
              value={loanDate}
              max={today}
              onChange={(event) =>
                event.target.value &&
                setLoanDate(event.target.value)
              }
              className="h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-2 text-sm font-medium text-slate-950 sm:w-auto sm:px-3"
            />

            <button
              type="button"
              aria-label="Next day"
              disabled={loanDate >= today}
              onClick={() =>
                setLoanDate(addDays(loanDate, 1))
              }
              className="flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 disabled:opacity-35 sm:w-11"
            >
              →
            </button>

            {isToday ? (
              <button
                type="button"
                onClick={() => setShowNewLoan(true)}
                className="col-span-3 min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:col-span-1"
              >
                + New Loan
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoanDate(today)}
                className="col-span-3 min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white sm:col-span-1"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Out Now"
            value={
              loading
                ? "—"
                : data?.summary.outstanding ?? 0
            }
            caption="items outstanding"
            className="bg-slate-950 text-white"
          />

          <SummaryCard
            label="Late"
            value={
              loading
                ? "—"
                : data?.summary.late ?? 0
            }
            caption="past 23:00"
            className={
              (data?.summary.late ?? 0) > 0
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-700"
            }
          />

          <SummaryCard
            label="Active Loans"
            value={
              loading
                ? "—"
                : data?.summary.activeLoans ?? 0
            }
            caption="open ledgers"
            className="bg-blue-50 text-blue-700"
          />

          <SummaryCard
            label="Returned"
            value={
              loading
                ? "—"
                : data?.summary.returned ?? 0
            }
            caption="items returned"
            className="bg-emerald-50 text-emerald-700"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {formatDate(loanDate)}
          </span>

          <span className="text-xs font-medium text-slate-500">
            Return deadline: 23:00
          </span>
        </div>
      </section>

      {/* LATE EQUIPMENT */}
      {lateLoans.length > 0 && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-500">
                Attention Required
              </p>

              <h3 className="mt-1 font-semibold text-red-900">
                Overdue Equipment
              </h3>
            </div>

            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
              {data?.summary.late ?? 0} late
            </span>
          </div>

          <div className="divide-y divide-red-100">
            {lateLoans.map((loan) => {
              const lateQuantity = loan.items
                .filter((item) => item.status === "late")
                .reduce(
                  (sum, item) =>
                    sum +
                    Math.max(
                      item.quantity - returnedCount(item),
                      0
                    ),
                  0
                );

              return (
                <div
                  key={loan.id}
                  className="flex items-start justify-between gap-4 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {loan.department_name_snapshot}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {loan.borrower_name} · AIMS{" "}
                      {loan.borrower_aims_id}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-red-600">
                      {lateQuantity} late
                    </p>

                    <p className="mt-1 text-xs text-red-500">
                      since 23:00
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ERROR */}
      {(error || inlineError) && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            {inlineError ?? error}
          </p>

          <button
            type="button"
            onClick={() => {
              setInlineError(null);
              void refresh();
            }}
            className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* LEDGER */}
      <section className="mt-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-semibold text-slate-950">
              Daily Loan Ledger
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Manage loans, partial returns and outstanding
              equipment.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search department, person, AIMS or tool..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:font-normal placeholder:text-slate-400 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 lg:w-[340px]"
            />

            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex w-max rounded-xl bg-slate-100 p-1">
                {FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`min-h-9 shrink-0 rounded-lg px-4 text-xs font-semibold transition ${
                      filter === item.value
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Loading equipment loans...
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-500">
              ✓
            </div>

            <p className="mt-3 font-semibold text-slate-900">
              {data?.loans.length
                ? "No loans match this filter"
                : "No equipment loans recorded"}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {isToday
                ? "Issue a loan when equipment leaves the store."
                : "No loans were recorded for this date."}
            </p>

            {isToday && !data?.loans.length && (
              <button
                type="button"
                onClick={() => setShowNewLoan(true)}
                className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"
              >
                + Issue First Loan
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {filteredLoans.map((loan) => {
              const presentation = statusStyle(loan.status);

              const outstandingItems = loan.items.filter(
                (item) =>
                  returnedCount(item) < item.quantity
              );

              return (
                <article
                  key={loan.id}
                  className={`overflow-hidden rounded-2xl border shadow-sm ${
                    loan.status === "late"
                      ? "border-red-200 bg-red-50/30"
                      : "border-slate-300 bg-slate-100/70"
                  }`}
                >
                  {/* LOAN HEADER */}
                  <div
                    className={`border-b px-4 py-4 sm:px-5 ${
                      loan.status === "late"
                        ? "border-red-200 bg-red-50"
                        : "border-slate-300 bg-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-base font-bold text-slate-950">
                          {loan.department_name_snapshot}
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {loan.borrower_name}
                        </p>

                        <p className="mt-0.5 text-xs font-medium text-slate-500">
                          AIMS {loan.borrower_aims_id}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.classes}`}
                      >
                        {presentation.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-slate-500">
                      <span>
                        Issued{" "}
                        <strong className="text-slate-800">
                          {formatTime(loan.issued_at)}
                        </strong>
                      </span>

                      <span>
                        Due{" "}
                        <strong className="text-slate-800">
                          23:00
                        </strong>
                      </span>

                      <span className="font-semibold text-slate-700">
                        {loan.outstandingQuantity} outstanding
                      </span>
                    </div>
                  </div>

                  {/* ITEMS */}
                  <div className="divide-y divide-slate-200 bg-white/90">
                    {loan.items.map((item) => {
                      const itemPresentation =
                        statusStyle(item.status);

                      const returned = returnedCount(item);
                      const outstanding =
                        item.quantity - returned;

                      const fullyReturned =
                        outstanding === 0;

                      const partial =
                        returned > 0 && outstanding > 0;

                      const updating =
                        changingItemId === item.id;

                      /*
                       * SINGLE ITEM
                       */
                      if (item.quantity === 1) {
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                          >
                            <button
                              type="button"
                              disabled={updating}
                              onClick={() =>
                                void toggleSingleReturned(item)
                              }
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition disabled:opacity-50 ${
                                fullyReturned
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                  : item.status === "late"
                                    ? "border-red-300 bg-red-50 text-red-600"
                                    : "border-slate-300 bg-white text-slate-400"
                              }`}
                              aria-label={
                                fullyReturned
                                  ? `Mark ${item.item_name} outstanding`
                                  : `Mark ${item.item_name} returned`
                              }
                            >
                              {updating
                                ? "…"
                                : fullyReturned
                                  ? "✓"
                                  : ""}
                            </button>

                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-semibold ${
                                  fullyReturned
                                    ? "text-slate-400 line-through"
                                    : "text-slate-950"
                                }`}
                              >
                                {item.item_name}
                              </p>

                              <p className="mt-1 text-xs font-medium text-slate-500">
                                {fullyReturned
                                  ? `Returned ${formatTime(
                                      item.returned_at
                                    )}`
                                  : item.status === "late"
                                    ? "Not returned by 23:00"
                                    : "Currently out"}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${itemPresentation.classes}`}
                            >
                              {itemPresentation.label}
                            </span>
                          </div>
                        );
                      }

                      /*
                       * MULTI-QUANTITY ITEM
                       */
                      return (
                        <div
                          key={item.id}
                          className="px-4 py-4 sm:px-5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className={`text-sm font-semibold ${
                                    fullyReturned
                                      ? "text-slate-400 line-through"
                                      : "text-slate-950"
                                  }`}
                                >
                                  {item.item_name}
                                </p>

                                <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                                  ×{item.quantity}
                                </span>
                              </div>

                              {fullyReturned ? (
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  All {item.quantity} returned ·{" "}
                                  {formatTime(item.returned_at)}
                                </p>
                              ) : (
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  {returned} returned ·{" "}
                                  <span
                                    className={
                                      item.status === "late"
                                        ? "font-semibold text-red-600"
                                        : "font-semibold text-slate-700"
                                    }
                                  >
                                    {outstanding}{" "}
                                    {item.status === "late"
                                      ? "late"
                                      : "outstanding"}
                                  </span>
                                </p>
                              )}
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${itemPresentation.classes}`}
                            >
                              {itemPresentation.label}
                            </span>
                          </div>

                          {/* RETURN PROGRESS */}
                          <div className="mt-3">
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{
                                  width: `${
                                    item.quantity
                                      ? (returned /
                                          item.quantity) *
                                        100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-500">
                                {returned} / {item.quantity} returned
                              </span>

                              {partial && (
                                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                                  Partial Return
                                </span>
                              )}
                            </div>
                          </div>

                          {/* MOBILE-FRIENDLY ACTIONS */}
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            {!fullyReturned ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openPartialReturn(item)
                                }
                                className={`min-h-11 w-full rounded-xl px-4 text-sm font-semibold transition sm:w-auto ${
                                  item.status === "late"
                                    ? "bg-red-600 text-white hover:bg-red-700"
                                    : "bg-slate-950 text-white hover:bg-slate-800"
                                }`}
                              >
                                Return Items
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={updating}
                                onClick={() =>
                                  void reopenMultiItem(item)
                                }
                                className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                              >
                                {updating
                                  ? "Updating..."
                                  : "Mark Outstanding"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* LOAN ACTIONS */}
                  <div className="border-t border-slate-200 bg-slate-100/80 px-4 py-3 sm:px-5">
                    {addingToLoanId === loan.id ? (
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_auto_auto]">
                        <input
                          type="text"
                          list="equipment-tool-suggestions"
                          autoFocus
                          value={extraItemName}
                          onChange={(event) =>
                            setExtraItemName(
                              event.target.value
                            )
                          }
                          placeholder="Tool or equipment..."
                          className="h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400"
                        />

                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          value={extraItemQuantity}
                          onChange={(event) =>
                            setExtraItemQuantity(
                              Math.max(
                                1,
                                Number(event.target.value) || 1
                              )
                            )
                          }
                          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-semibold text-slate-950"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            void submitExtraItem(loan.id)
                          }
                          className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white"
                        >
                          Add
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAddingToLoanId(null);
                            setExtraItemName("");
                            setExtraItemQuantity(1);
                          }}
                          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        {isToday && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingToLoanId(loan.id);
                              setExtraItemName("");
                              setExtraItemQuantity(1);
                            }}
                            className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            + Add Tool
                          </button>
                        )}

                        {outstandingItems.length > 0 && (
                          <button
                            type="button"
                            disabled={
                              returningLoanId === loan.id
                            }
                            onClick={() =>
                              void returnAll(loan.id)
                            }
                            className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {returningLoanId === loan.id
                              ? "Returning..."
                              : "Return All Outstanding"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <datalist id="equipment-tool-suggestions">
        {toolSuggestions.map((tool) => (
          <option key={tool} value={tool} />
        ))}
      </datalist>

      {/* =====================================================
          PARTIAL RETURN SHEET
          Mobile = bottom sheet
          Desktop = centred dialog
      ====================================================== */}
      {partialReturn && (
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={closePartialReturn}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Return ${partialReturn.itemName}`}
            onMouseDown={(event) =>
              event.stopPropagation()
            }
            className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Return Equipment
                  </p>

                  <h3 className="mt-1 text-lg font-bold text-slate-950">
                    {partialReturn.itemName}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Record only the quantity being returned now.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={savingPartialReturn}
                  onClick={closePartialReturn}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl text-slate-500 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              {/* CURRENT POSITION */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-100 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Loaned
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-950">
                    {partialReturn.quantity}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                    Returned
                  </p>

                  <p className="mt-1 text-2xl font-bold text-emerald-700">
                    {partialReturn.quantityReturned}
                  </p>
                </div>

                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                    Still Out
                  </p>

                  <p className="mt-1 text-2xl font-bold text-blue-700">
                    {partialOutstanding}
                  </p>
                </div>
              </div>

              {/* RETURN NOW */}
              <div className="mt-6 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  How many are being returned now?
                </p>

                <div className="mx-auto mt-4 grid max-w-[250px] grid-cols-[56px_minmax(0,1fr)_56px] items-center gap-3">
                  <button
                    type="button"
                    disabled={returnNow <= 1}
                    onClick={() =>
                      setReturnNow((current) =>
                        Math.max(1, current - 1)
                      )
                    }
                    className="flex h-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-2xl font-medium text-slate-700 active:bg-slate-100 disabled:opacity-30"
                  >
                    −
                  </button>

                  <div className="flex h-16 items-center justify-center rounded-2xl bg-slate-950 text-3xl font-bold text-white">
                    {returnNow}
                  </div>

                  <button
                    type="button"
                    disabled={
                      returnNow >= partialOutstanding
                    }
                    onClick={() =>
                      setReturnNow((current) =>
                        Math.min(
                          partialOutstanding,
                          current + 1
                        )
                      )
                    }
                    className="flex h-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-2xl font-medium text-slate-700 active:bg-slate-100 disabled:opacity-30"
                  >
                    +
                  </button>
                </div>

                {partialOutstanding > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setReturnNow(partialOutstanding)
                    }
                    className="mt-3 min-h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    Return all {partialOutstanding} remaining
                  </button>
                )}
              </div>

              {/* PREVIEW */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  After this return
                </p>

                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold text-emerald-700">
                      {partialAfterReturn} /{" "}
                      {partialReturn.quantity} returned
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {Math.max(
                        partialReturn.quantity -
                          partialAfterReturn,
                        0
                      )}{" "}
                      remaining
                    </p>
                  </div>

                  {partialAfterReturn ===
                    partialReturn.quantity && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Fully Returned
                    </span>
                  )}
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${
                        (partialAfterReturn /
                          partialReturn.quantity) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* MOBILE STICKY-LIKE ACTION AREA */}
            <div className="border-t border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={savingPartialReturn}
                  onClick={closePartialReturn}
                  className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    savingPartialReturn ||
                    returnNow < 1
                  }
                  onClick={() =>
                    void confirmPartialReturn()
                  }
                  className="min-h-12 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingPartialReturn
                    ? "Saving..."
                    : `Confirm ${returnNow} Returned`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          NEW LOAN
      ====================================================== */}
      {showNewLoan && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={closeNewLoan}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Issue equipment loan"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
            className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Equipment Control
                </p>

                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  New Equipment Loan
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Due back today by 23:00.
                </p>
              </div>

              <button
                type="button"
                disabled={issuing}
                onClick={closeNewLoan}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleCreateLoan}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              <div className="p-4 sm:p-5">
                {/* RECENT BORROWERS */}
                {!!data?.recentBorrowers.length && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Recent Borrowers
                    </p>

                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {data.recentBorrowers
                        .slice(0, 6)
                        .map((borrower) => (
                          <button
                            key={`${borrower.departmentId}-${borrower.borrowerAimsId}`}
                            type="button"
                            onClick={() =>
                              applyRecentBorrower(borrower)
                            }
                            className="min-w-[180px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:bg-white"
                          >
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {borrower.borrowerName}
                            </p>

                            <p className="mt-1 truncate text-xs font-medium text-slate-600">
                              {borrower.departmentName}
                            </p>

                            <p className="mt-1 text-xs font-medium text-slate-500">
                              AIMS {borrower.borrowerAimsId}
                            </p>
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* BORROWER */}
                <div
                  className={
                    data?.recentBorrowers.length
                      ? "mt-6"
                      : ""
                  }
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Borrower
                  </p>

                  <div className="mt-3 grid gap-4">
                    <label>
                      <span className="text-sm font-semibold text-slate-700">
                        Department
                      </span>

                      <select
                        value={departmentId}
                        onChange={(event) =>
                          setDepartmentId(
                            event.target.value
                          )
                        }
                        className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">
                          Select department...
                        </option>

                        {data?.departments.map(
                          (department) => (
                            <option
                              key={department.id}
                              value={department.id}
                            >
                              {department.name}
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>
                        <span className="text-sm font-semibold text-slate-700">
                          Name
                        </span>

                        <input
                          type="text"
                          value={borrowerName}
                          onChange={(event) =>
                            setBorrowerName(
                              event.target.value
                            )
                          }
                          placeholder="Borrower's full name"
                          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:font-normal placeholder:text-slate-400 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                      </label>

                      <label>
                        <span className="text-sm font-semibold text-slate-700">
                          AIMS ID
                        </span>

                        <input
                          type="text"
                          inputMode="numeric"
                          value={borrowerAimsId}
                          onChange={(event) =>
                            setBorrowerAimsId(
                              event.target.value
                            )
                          }
                          placeholder="AIMS ID"
                          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:font-normal placeholder:text-slate-400 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* EQUIPMENT */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Equipment
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Enter each tool manually.
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {draftItems.reduce(
                        (sum, item) =>
                          sum + item.quantity,
                        0
                      )}{" "}
                      items
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_78px] gap-2 sm:grid-cols-[minmax(0,1fr)_90px_auto]">
                    <input
                      type="text"
                      list="equipment-tool-suggestions"
                      value={itemName}
                      onKeyDown={handleToolKeyDown}
                      onChange={(event) =>
                        setItemName(event.target.value)
                      }
                      placeholder="e.g. Cordless Drill"
                      className="h-12 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />

                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={itemQuantity}
                      onChange={(event) =>
                        setItemQuantity(
                          Math.max(
                            1,
                            Number(event.target.value) || 1
                          )
                        )
                      }
                      aria-label="Quantity"
                      className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-center text-base font-bold text-slate-950"
                    />

                    <button
                      type="button"
                      onClick={addDraftItem}
                      className="col-span-2 min-h-11 rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-900 hover:bg-slate-300 sm:col-span-1"
                    >
                      + Add
                    </button>
                  </div>

                  {!!draftItems.length && (
                    <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                      {draftItems.map((item) => (
                        <div
                          key={item.localId}
                          className="flex items-center gap-3 bg-white px-3 py-3"
                        >
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-950">
                            {item.item_name}
                          </p>

                          <div className="flex items-center rounded-lg bg-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems((current) =>
                                  current.map((candidate) =>
                                    candidate.localId ===
                                    item.localId
                                      ? {
                                          ...candidate,
                                          quantity: Math.max(
                                            1,
                                            candidate.quantity - 1
                                          ),
                                        }
                                      : candidate
                                  )
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center text-slate-700"
                            >
                              −
                            </button>

                            <span className="min-w-8 text-center text-sm font-bold text-slate-950">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems((current) =>
                                  current.map((candidate) =>
                                    candidate.localId ===
                                    item.localId
                                      ? {
                                          ...candidate,
                                          quantity:
                                            candidate.quantity +
                                            1,
                                        }
                                      : candidate
                                  )
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center text-slate-700"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove ${item.item_name}`}
                            onClick={() =>
                              setDraftItems((current) =>
                                current.filter(
                                  (candidate) =>
                                    candidate.localId !==
                                    item.localId
                                )
                              )
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {newLoanError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    {newLoanError}
                  </div>
                )}
              </div>

              {/* STICKY MOBILE ACTIONS */}
              <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={issuing}
                    onClick={closeNewLoan}
                    className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={issuing}
                    className="min-h-12 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {issuing
                      ? "Issuing..."
                      : "Issue Equipment"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}