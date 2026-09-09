"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import useEquipmentLoans from "@/hooks/useEquipmentLoans";
import { getLondonDateString } from "@/lib/equipmentLoans/loanUtils";

import type {
  EquipmentBookingGroup,
  EquipmentLoanStatus,
  NewEquipmentLoanItem,
  RecentBorrower,
} from "@/types/equipmentLoans";

type LoanFilter = "all" | "out" | "late" | "returned";

interface EquipmentPortalSession {
  username: string;
  bookingGroup: EquipmentBookingGroup;
  label: string;
}

interface EquipmentPortalUser extends EquipmentPortalSession {
  password: string;
}

interface DraftItem extends NewEquipmentLoanItem {
  localId: string;
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

const EQUIPMENT_SESSION_KEY =
  "ijtema_equipment_portal_session";

const EQUIPMENT_USERS: EquipmentPortalUser[] = [
  {
    username: "Admin",
    password: "Admin123@",
    bookingGroup: "admin",
    label: "Admin",
  },
  {
    username: "AnsarUk",
    password: "Ansar123@",
    bookingGroup: "ansar",
    label: "Ansar",
  },
  {
    username: "KhuddamUk",
    password: "Khuddam123@",
    bookingGroup: "khuddam",
    label: "Khuddam",
  },
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
        classes: "bg-red-50 text-red-700",
      };

    case "returned":
      return {
        label: "Returned",
        classes: "bg-emerald-50 text-emerald-700",
      };

    case "returned_late":
      return {
        label: "Returned Late",
        classes: "bg-amber-50 text-amber-700",
      };

    default:
      return {
        label: "Out",
        classes: "bg-blue-50 text-blue-700",
      };
  }
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

export default function EquipmentLoans() {
  const today = getLondonDateString();

  const [
    portalSession,
    setPortalSession,
  ] = useState<EquipmentPortalSession | null>(null);

  const [
    sessionLoading,
    setSessionLoading,
  ] = useState(true);

  const [
    loginUsername,
    setLoginUsername,
  ] = useState("");

  const [
    loginPassword,
    setLoginPassword,
  ] = useState("");

  const [
    loginError,
    setLoginError,
  ] = useState<string | null>(null);

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

  const [newLoanError, setNewLoanError] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [issuing, setIssuing] = useState(false);
  const [changingItemId, setChangingItemId] = useState<string | null>(null);
  const [returningLoanId, setReturningLoanId] = useState<string | null>(null);

  const [addingToLoanId, setAddingToLoanId] = useState<string | null>(null);
  const [extraItemName, setExtraItemName] = useState("");
  const [extraItemQuantity, setExtraItemQuantity] = useState(1);

  const {
    data,
    loading,
    error,
    refresh,
    createLoan,
    addItem,
    setItemReturned,
    setItemsReturned,
  } = useEquipmentLoans(
    loanDate,
    portalSession?.bookingGroup ?? null,
    Boolean(portalSession)
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const saved =
          window.sessionStorage.getItem(
            EQUIPMENT_SESSION_KEY
          );

        if (saved) {
          const parsed =
            JSON.parse(
              saved
            ) as Partial<EquipmentPortalSession>;

          if (
            typeof parsed.username === "string" &&
            typeof parsed.label === "string" &&
            (
              parsed.bookingGroup === "admin" ||
              parsed.bookingGroup === "ansar" ||
              parsed.bookingGroup === "khuddam"
            )
          ) {
            setPortalSession({
              username: parsed.username,
              bookingGroup: parsed.bookingGroup,
              label: parsed.label,
            });
          }
        }
      } catch {
        window.sessionStorage.removeItem(
          EQUIPMENT_SESSION_KEY
        );
      } finally {
        setSessionLoading(false);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  function handlePortalLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setLoginError(null);

    const match =
      EQUIPMENT_USERS.find(
        (user) =>
          user.username === loginUsername.trim() &&
          user.password === loginPassword
      );

    if (!match) {
      setLoginError(
        "Incorrect username or password."
      );
      return;
    }

    const session: EquipmentPortalSession = {
      username: match.username,
      bookingGroup: match.bookingGroup,
      label: match.label,
    };

    window.sessionStorage.setItem(
      EQUIPMENT_SESSION_KEY,
      JSON.stringify(session)
    );

    setPortalSession(session);
    setLoginPassword("");
    setLoginError(null);
  }

  function logoutPortal() {
    window.sessionStorage.removeItem(
      EQUIPMENT_SESSION_KEY
    );

    setPortalSession(null);
    setLoginUsername("");
    setLoginPassword("");
    setLoginError(null);

    setShowNewLoan(false);
    setSearch("");
    setFilter("all");
    setLoanDate(today);
    resetNewLoan();
  }

  const isToday = loanDate === today;

  /*
   * Existing entries become autocomplete suggestions.
   * There is still no permanent tool catalogue.
   */
  const toolSuggestions = useMemo(() => {
    const names = new Set<string>();

    data?.loans.forEach((loan) =>
      loan.items.forEach((item) => names.add(item.item_name))
    );

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredLoans = useMemo(() => {
    if (!data) return [];

    const query = search.trim().toLowerCase();

    return data.loans.filter((loan) => {
      const matchesSearch =
        !query ||
        loan.department_name_snapshot.toLowerCase().includes(query) ||
        loan.borrower_name.toLowerCase().includes(query) ||
        loan.borrower_aims_id.toLowerCase().includes(query) ||
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

  /*
   * Normal helper — deliberately NOT named "use..."
   * so React doesn't interpret it as a hook.
   */
  function applyRecentBorrower(borrower: RecentBorrower) {
    setDepartmentId(borrower.departmentId);
    setBorrowerName(borrower.borrowerName);
    setBorrowerAimsId(borrower.borrowerAimsId);
    setNewLoanError(null);
  }

  function addDraftItem() {
    const cleanName = itemName.trim();

    if (!cleanName) {
      setNewLoanError("Enter the name of the tool or equipment.");
      return;
    }

    if (!Number.isInteger(itemQuantity) || itemQuantity < 1) {
      setNewLoanError("Quantity must be at least 1.");
      return;
    }

    setDraftItems((current) => {
      const existing = current.find(
        (item) =>
          item.item_name.toLowerCase() === cleanName.toLowerCase()
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

  function handleToolKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    addDraftItem();
  }

  async function handleCreateLoan(event: FormEvent<HTMLFormElement>) {
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

    if (draftItems.length === 0) {
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
        result.error ?? "The equipment loan could not be created."
      );
      return;
    }

    setShowNewLoan(false);
    resetNewLoan();
  }

  async function toggleReturned(
    itemId: string,
    currentlyReturned: boolean
  ) {
    if (
      currentlyReturned &&
      !window.confirm("Mark this item as outstanding again?")
    ) {
      return;
    }

    setChangingItemId(itemId);
    setInlineError(null);

    const result = await setItemReturned(itemId, !currentlyReturned);

    setChangingItemId(null);

    if (!result.success) {
      setInlineError(
        result.error ?? "The equipment return could not be updated."
      );
    }
  }

  async function returnAll(loanId: string) {
    const loan = data?.loans.find((item) => item.id === loanId);
    if (!loan) return;

    const outstandingIds = loan.items
      .filter((item) => !item.returned_at)
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

    const result = await setItemsReturned(outstandingIds, true);

    setReturningLoanId(null);

    if (!result.success) {
      setInlineError(
        result.error ?? "Not all equipment could be marked returned."
      );
    }
  }

  async function submitExtraItem(loanId: string) {
    const cleanName = extraItemName.trim();

    if (!cleanName) {
      setInlineError("Enter the tool name.");
      return;
    }

    if (!Number.isInteger(extraItemQuantity) || extraItemQuantity < 1) {
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
      setInlineError(result.error ?? "The tool could not be added.");
      return;
    }

    setAddingToLoanId(null);
    setExtraItemName("");
    setExtraItemQuantity(1);
  }

  if (sessionLoading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-slate-200" />

          <p className="mt-4 text-sm font-medium text-slate-500">
            Loading Equipment Loans…
          </p>
        </div>
      </div>
    );
  }

  if (!portalSession) {
    return (
      <div className="flex min-h-[520px] items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-950 px-6 py-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Equipment Control
            </p>

            <h2 className="mt-1 text-2xl font-semibold">
              Equipment Loans Access
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Sign in with your allocated equipment control account.
            </p>
          </div>

          <form
            onSubmit={handlePortalLogin}
            className="p-6"
          >
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Username
              </span>

              <input
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                value={loginUsername}
                onChange={(event) =>
                  setLoginUsername(event.target.value)
                }
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter username"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">
                Password
              </span>

              <input
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) =>
                  setLoginPassword(event.target.value)
                }
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Enter password"
              />
            </label>

            {loginError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="mt-5 min-h-12 w-full rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Sign In
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Your session remains active in this browser tab until you log out or close the tab.
            </p>
          </form>
        </div>
      </div>
    );
  }

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
              {portalSession.label} bookings only · All tools are due back by 23:00.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              {portalSession.label} Portal
            </span>

            <button
              type="button"
              onClick={logoutPortal}
              className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Log Out
            </button>

            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setLoanDate(addDays(loanDate, -1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 hover:bg-slate-50"
            >
              ←
            </button>

            <input
              type="date"
              value={loanDate}
              max={today}
              onChange={(event) =>
                event.target.value && setLoanDate(event.target.value)
              }
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700 sm:flex-none sm:px-3 sm:text-base"
            />

            <button
              type="button"
              aria-label="Next day"
              disabled={loanDate >= today}
              onClick={() => setLoanDate(addDays(loanDate, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 hover:bg-slate-50 disabled:opacity-35"
            >
              →
            </button>

            {isToday ? (
              <button
                type="button"
                onClick={() => setShowNewLoan(true)}
                className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                + New Loan
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoanDate(today)}
                className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white"
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
            value={loading ? "—" : data?.summary.outstanding ?? 0}
            caption="items outstanding"
            className="bg-slate-950 text-white"
          />

          <SummaryCard
            label="Late"
            value={loading ? "—" : data?.summary.late ?? 0}
            caption="past 23:00"
            className={
              (data?.summary.late ?? 0) > 0
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-700"
            }
          />

          <SummaryCard
            label="Active Loans"
            value={loading ? "—" : data?.summary.activeLoans ?? 0}
            caption="open ledgers"
            className="bg-blue-50 text-blue-700"
          />

          <SummaryCard
            label="Returned"
            value={loading ? "—" : data?.summary.returned ?? 0}
            caption="items returned"
            className="bg-emerald-50 text-emerald-700"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {formatDate(loanDate)}
          </span>

          <span className="text-xs font-medium text-slate-500">
            Return deadline: 23:00 Europe/London
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
                .reduce((sum, item) => sum + item.quantity, 0);

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
                      {loan.borrower_name} · AIMS {loan.borrower_aims_id}
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

      {/* ERRORS */}
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
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700"
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
              Manage loans, returns and outstanding equipment.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search department, person, AIMS or tool..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 lg:w-[340px]"
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
                (item) => !item.returned_at
              );

              return (
                <article
                  key={loan.id}
                  className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                    loan.status === "late"
                      ? "border-red-200"
                      : "border-slate-200"
                  }`}
                >
                  {/* LOAN HEADER */}
                  <div
                    className={`border-b px-4 py-4 sm:px-5 ${
                      loan.status === "late"
                        ? "border-red-100 bg-red-50/50"
                        : "border-slate-100 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-950">
                          {loan.department_name_snapshot}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {loan.borrower_name}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          AIMS {loan.borrower_aims_id}
                        </p>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.classes}`}
                      >
                        {presentation.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span>
                        Issued{" "}
                        <strong className="text-slate-700">
                          {formatTime(loan.issued_at)}
                        </strong>
                      </span>

                      <span>
                        Due <strong className="text-slate-700">23:00</strong>
                      </span>

                      <span>
                        {loan.outstandingQuantity} outstanding
                      </span>
                    </div>
                  </div>

                  {/* ITEMS */}
                  <div className="divide-y divide-slate-100">
                    {loan.items.map((item) => {
                      const returned = Boolean(item.returned_at);
                      const updating = changingItemId === item.id;
                      const itemPresentation = statusStyle(item.status);

                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                        >
                          <button
                            type="button"
                            disabled={updating}
                            onClick={() =>
                              void toggleReturned(item.id, returned)
                            }
                            aria-label={
                              returned
                                ? `Mark ${item.item_name} outstanding`
                                : `Mark ${item.item_name} returned`
                            }
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition disabled:opacity-50 ${
                              returned
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                : item.status === "late"
                                  ? "border-red-300 bg-red-50 text-red-600"
                                  : "border-slate-300 bg-white text-slate-400"
                            }`}
                          >
                            {updating ? "…" : returned ? "✓" : ""}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={`text-sm font-semibold ${
                                  returned
                                    ? "text-slate-400 line-through"
                                    : "text-slate-900"
                                }`}
                              >
                                {item.item_name}
                              </p>

                              {item.quantity > 1 && (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                  ×{item.quantity}
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {returned
                                ? `Returned ${formatTime(item.returned_at)}`
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
                    })}
                  </div>

                  {/* ACTIONS */}
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                    {addingToLoanId === loan.id ? (
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px_auto_auto]">
                        <input
                          type="text"
                          list="equipment-tool-suggestions"
                          autoFocus
                          value={extraItemName}
                          onChange={(event) =>
                            setExtraItemName(event.target.value)
                          }
                          placeholder="Tool or equipment..."
                          className="h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base"
                        />

                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={extraItemQuantity}
                          onChange={(event) =>
                            setExtraItemQuantity(
                              Math.max(1, Number(event.target.value) || 1)
                            )
                          }
                          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400"
                        />

                        <button
                          type="button"
                          onClick={() => void submitExtraItem(loan.id)}
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
                          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        {/* New tools can only be added to today's loans */}
                        {isToday && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingToLoanId(loan.id);
                              setExtraItemName("");
                              setExtraItemQuantity(1);
                            }}
                            className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            + Add Tool
                          </button>
                        )}

                        {/* Returns remain available for old overdue loans */}
                        {outstandingItems.length > 0 && (
                          <button
                            type="button"
                            disabled={returningLoanId === loan.id}
                            onClick={() => void returnAll(loan.id)}
                            className="min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {returningLoanId === loan.id
                              ? "Returning..."
                              : "Return All"}
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

      {/* NEW LOAN */}
      {showNewLoan && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={closeNewLoan}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Issue equipment loan"
            onMouseDown={(event) => event.stopPropagation()}
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
                  {portalSession.label} booking · Due back today by 23:00.
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
                      {data.recentBorrowers.slice(0, 6).map((borrower) => (
                        <button
                          key={`${borrower.departmentId}-${borrower.borrowerAimsId}`}
                          type="button"
                          onClick={() => applyRecentBorrower(borrower)}
                          className="min-w-[180px] shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-slate-300 hover:bg-white"
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {borrower.borrowerName}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-500">
                            {borrower.departmentName}
                          </p>

                          <p className="mt-1 text-xs font-medium text-slate-400">
                            AIMS {borrower.borrowerAimsId}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* BORROWER */}
                <div className={data?.recentBorrowers.length ? "mt-6" : ""}>
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
                          setDepartmentId(event.target.value)
                        }
                        className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
                      >
                        <option value="">Select department...</option>

                        {data?.departments.map((department) => (
                          <option
                            key={department.id}
                            value={department.id}
                          >
                            {department.name}
                          </option>
                        ))}
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
                            setBorrowerName(event.target.value)
                          }
                          placeholder="Borrower's full name"
                          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400"
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
                            setBorrowerAimsId(event.target.value)
                          }
                          placeholder="AIMS ID"
                          className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400"
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

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {draftItems.reduce(
                        (sum, item) => sum + item.quantity,
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
                      onChange={(event) => setItemName(event.target.value)}
                      placeholder="e.g. Cordless Drill"
                      className="h-12 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base"
                    />

                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={itemQuantity}
                      onChange={(event) =>
                        setItemQuantity(
                          Math.max(1, Number(event.target.value) || 1)
                        )
                      }
                      aria-label="Quantity"
                      className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-center text-base"
                    />

                    <button
                      type="button"
                      onClick={addDraftItem}
                      className="col-span-2 min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-200 sm:col-span-1"
                    >
                      + Add
                    </button>
                  </div>

                  {!!draftItems.length && (
                    <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                      {draftItems.map((item) => (
                        <div
                          key={item.localId}
                          className="flex items-center gap-3 px-3 py-3"
                        >
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                            {item.item_name}
                          </p>

                          <div className="flex items-center rounded-lg bg-slate-100">
                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems((current) =>
                                  current.map((candidate) =>
                                    candidate.localId === item.localId
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
                              className="flex h-9 w-9 items-center justify-center text-slate-600"
                            >
                              −
                            </button>

                            <span className="min-w-8 text-center text-sm font-bold">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                setDraftItems((current) =>
                                  current.map((candidate) =>
                                    candidate.localId === item.localId
                                      ? {
                                          ...candidate,
                                          quantity:
                                            candidate.quantity + 1,
                                        }
                                      : candidate
                                  )
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center text-slate-600"
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
                                    candidate.localId !== item.localId
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

              {/* STICKY ACTIONS */}
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
                    {issuing ? "Issuing..." : "Issue Equipment"}
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