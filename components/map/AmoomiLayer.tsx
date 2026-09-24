"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
  MouseEvent,
} from "react";

export type AmoomiRole =
  | "viewer"
  | "admin";

export interface AmoomiOfficer {
  id: string;
  post_id: string;
  name: string;
  phone: string | null;
  active: boolean;
  is_shift_incharge: boolean;
  deployed_at: string;
  updated_at: string;
}

export interface RememberedAmoomiOfficer {
  name: string;
  phone: string | null;
}

export interface AmoomiUrgentMessage {
  id: string;
  post_id: string;
  message: string;
  incident_type:
    | "urgent"
    | "security_breach";
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export interface AmoomiPost {
  id: string;
  name: string;
  x: number | string | null;
  y: number | string | null;
  sort_order: number;
  officers: AmoomiOfficer[];
  urgentMessages: AmoomiUrgentMessage[];
  unresolvedUrgentCount: number;
}

const POST_GOLD = "#D4AF37";
const POST_GOLD_BORDER = "#111827";

const RESPONSE_BLACK = "#111111";
const RESPONSE_GOLD_BORDER = "#D4AF37";

const RED = "#EF4444";
const MARKER_SIZE = 34;

function formatTime(value: string) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date(value));
}


function getMarkerLabel(name: string) {
  const trimmed = name.trim();

  const gateMatch =
    trimmed.match(
      /^Gate\s+(\d+)/i
    );

  if (gateMatch) {
    return `G${gateMatch[1]}`;
  }

  const postMatch =
    trimmed.match(
      /^Post\s+(\d+)/i
    );

  if (postMatch) {
    return `P${postMatch[1]}`;
  }

  const responseMatch =
    trimmed.match(
      /^Response\s+(\d+)/i
    );

  if (responseMatch) {
    return `R${responseMatch[1]}`;
  }

  return trimmed
    .slice(0, 3)
    .toUpperCase();
}

export function AmoomiLayer({
  posts,
  selectedPostId,
  traceMode,
  onSelectPost,
}: {
  posts: AmoomiPost[];
  selectedPostId: string | null;
  traceMode: boolean;
  onSelectPost: (postId: string) => void;
}) {
  return (
    <>
      {posts.map((post) => {
        if (
          post.x === null ||
          post.y === null
        ) {
          return null;
        }

        const x = Number(post.x);
        const y = Number(post.y);

        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y)
        ) {
          return null;
        }

        const selected =
          selectedPostId === post.id;

        const urgent =
          post.unresolvedUrgentCount >
          0;

        const securityBreach =
          post.urgentMessages.some(
            (message) =>
              !message.resolved &&
              message.incident_type ===
                "security_breach"
          );

        const isResponsePost =
          post.name
            .trim()
            .toLowerCase()
            .startsWith("response ");

        const markerFill =
          isResponsePost
            ? RESPONSE_BLACK
            : POST_GOLD;

        const markerBorder =
          isResponsePost
            ? RESPONSE_GOLD_BORDER
            : POST_GOLD_BORDER;

        const markerText =
          isResponsePost
            ? "#FACC15"
            : "#111827";

        const hasShiftIncharge =
          post.officers.some(
            (officer) =>
              officer.is_shift_incharge
          );

        const markerSize =
          selected
            ? MARKER_SIZE + 5
            : MARKER_SIZE;

        const markerX =
          x - markerSize / 2;

        const markerY =
          y - markerSize / 2;

        return (
          <g
            key={post.id}
            className={
              traceMode
                ? "pointer-events-none"
                : "cursor-pointer"
            }
            onClick={
              traceMode
                ? undefined
                : (
                    event:
                      MouseEvent<SVGGElement>
                  ) => {
                    event.stopPropagation();
                    onSelectPost(post.id);
                  }
            }
            role={
              traceMode
                ? undefined
                : "button"
            }
            aria-label={
              traceMode
                ? undefined
                : `${post.name}, ${post.officers.length} officers deployed${
                    urgent
                      ? ", urgent communication outstanding"
                      : ""
                  }`
            }
          >
            {!traceMode && (
              <circle
                cx={x}
                cy={y}
                r={42}
                fill="transparent"
                pointerEvents="all"
              />
            )}

            {securityBreach ? (
              <>
                {/* SECURITY BREACH: exaggerated dual-ring pulse */}
                <circle
                  cx={x}
                  cy={y}
                  r={22}
                  fill="none"
                  stroke="#7F1D1D"
                  strokeWidth={9}
                  opacity={0}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="r"
                    values="18;64"
                    dur="0.72s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0"
                    dur="0.72s"
                    repeatCount="indefinite"
                  />
                </circle>

                <circle
                  cx={x}
                  cy={y}
                  r={20}
                  fill="none"
                  stroke="#450A0A"
                  strokeWidth={7}
                  opacity={0}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="r"
                    values="22;58"
                    dur="0.85s"
                    begin="0.30s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.95;0"
                    dur="0.85s"
                    begin="0.30s"
                    repeatCount="indefinite"
                  />
                </circle>

                <circle
                  cx={x}
                  cy={y}
                  r={19}
                  fill="#7F1D1D"
                  opacity={0.38}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="r"
                    values="17;29;17"
                    dur="0.65s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.65;0.12;0.65"
                    dur="0.65s"
                    repeatCount="indefinite"
                  />
                </circle>

                <text
                  x={x}
                  y={markerY - 13}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#450A0A"
                  fontSize={17}
                  fontWeight="900"
                  pointerEvents="none"
                  style={{
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 6,
                    strokeLinejoin: "round",
                  }}
                >
                  BREACH
                </text>
              </>
            ) : urgent ? (
              <>
                <circle
                  cx={x}
                  cy={y}
                  r={22}
                  fill="none"
                  stroke={RED}
                  strokeWidth={5}
                  opacity={0}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="r"
                    values="20;38"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.9;0"
                    dur="1.35s"
                    repeatCount="indefinite"
                  />
                </circle>

                <circle
                  cx={x}
                  cy={y}
                  r={17}
                  fill={RED}
                  opacity={0.18}
                  pointerEvents="none"
                >
                  <animate
                    attributeName="opacity"
                    values="0.28;0.06;0.28"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </>
            ) : null}

            <rect
              x={markerX}
              y={markerY}
              width={markerSize}
              height={markerSize}
              rx={5}
              fill={markerFill}
              stroke={
                selected
                  ? "#FFFFFF"
                  : markerBorder
              }
              strokeWidth={
                selected
                  ? 4
                  : 2.5
              }
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />

            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={markerText}
              fontSize={
                selected
                  ? 13
                  : 11
              }
              fontWeight="900"
              pointerEvents="none"
            >
              {getMarkerLabel(
                post.name
              )}
            </text>

            {hasShiftIncharge && (
              <g pointerEvents="none">
                <circle
                  cx={markerX + 2}
                  cy={markerY + 2}
                  r={8.5}
                  fill="#111111"
                  stroke="#FACC15"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={markerX + 2}
                  y={markerY + 2.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#FACC15"
                  fontSize={9}
                  fontWeight="900"
                >
                  ♛
                </text>
              </g>
            )}

            {post.officers.length > 0 && (
              <g pointerEvents="none">
                <circle
                  cx={
                    markerX +
                    markerSize -
                    2
                  }
                  cy={markerY + 2}
                  r={7.5}
                  fill="#16A34A"
                  stroke="white"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={
                    markerX +
                    markerSize -
                    2
                  }
                  y={markerY + 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={8}
                  fontWeight="900"
                >
                  {post.officers.length}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </>
  );
}

export function AmoomiAccessModal({
  open,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated:
    (role: AmoomiRole) => void;
}) {
  const [role, setRole] =
    useState<AmoomiRole>(
      "viewer"
    );

  const [password, setPassword] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  if (!open) {
    return null;
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!password) {
      setError(
        "Enter the Amoomi password."
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response =
        await fetch(
          "/api/amoomi",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                action: "login",
                role,
                password,
              }),
          }
        );

      const data =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | {
              error?: string;
              role?: AmoomiRole;
            }
          | null;

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Amoomi access could not be enabled."
        );
      }

      setPassword("");

      onAuthenticated(
        data?.role ?? role
      );
    } catch (loginError) {
      setError(
        loginError instanceof
          Error
          ? loginError.message
          : "Amoomi access could not be enabled."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-amber-300 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Restricted Layer
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-950">
              Amoomi Access
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Choose Viewer or Admin access, then enter the matching password.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
          {(
            [
              "viewer",
              "admin",
            ] as const
          ).map(
            (option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  setRole(option)
                }
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  role === option
                    ? "bg-slate-950 text-amber-300 shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
              >
                {option === "viewer"
                  ? "Viewer"
                  : "Admin"}
              </button>
            )
          )}
        </div>

        <form
          onSubmit={submit}
          className="mt-4"
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            autoFocus
            className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            placeholder={
              role === "admin"
                ? "Admin password"
                : "Viewer password"
            }
          />

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-950">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-amber-300 shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Unlocking…"
              : `Unlock as ${
                  role === "admin"
                    ? "Admin"
                    : "Viewer"
                }`}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AmoomiPostCard({
  post,
  allPosts,
  rememberedOfficers,
  role,
  onChanged,
  onLogout,
  onClose,
}: {
  post: AmoomiPost;
  allPosts: AmoomiPost[];
  rememberedOfficers:
    RememberedAmoomiOfficer[];
  role: AmoomiRole;
  onChanged:
    () => Promise<void> | void;
  onLogout:
    () => Promise<void> | void;
  onClose: () => void;
}) {
  const [
    tab,
    setTab,
  ] = useState<
    | "deployed"
    | "manage"
    | "urgent"
  >("deployed");

  const [
    officerName,
    setOfficerName,
  ] = useState("");

  const [
    officerPhone,
    setOfficerPhone,
  ] = useState("");

  const [
    rememberedOfficerKey,
    setRememberedOfficerKey,
  ] = useState("");

  const [
    urgentMessage,
    setUrgentMessage,
  ] = useState("");

  const [
    breachMessage,
    setBreachMessage,
  ] = useState("");

  const [
    transferTargets,
    setTransferTargets,
  ] = useState<
    Record<string, string>
  >({});

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [notice, setNotice] =
    useState<string | null>(
      null
    );

  const unresolved =
    useMemo(
      () =>
        post.urgentMessages.filter(
          (message) =>
            !message.resolved
        ),
      [post.urgentMessages]
    );

  const unresolvedBreaches =
    useMemo(
      () =>
        post.urgentMessages.filter(
          (message) =>
            !message.resolved &&
            message.incident_type ===
              "security_breach"
        ),
      [post.urgentMessages]
    );

  const resolved =
    useMemo(
      () =>
        post.urgentMessages.filter(
          (message) =>
            message.resolved
        ),
      [post.urgentMessages]
    );

  async function action(
    payload:
      Record<string, unknown>,
    successMessage: string
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response =
        await fetch(
          "/api/amoomi",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | {
              error?: string;
            }
          | null;

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "The Amoomi update could not be saved."
        );
      }

      setNotice(
        successMessage
      );

      await onChanged();
    } catch (actionError) {
      setError(
        actionError instanceof
          Error
          ? actionError.message
          : "The Amoomi update could not be saved."
      );
    } finally {
      setBusy(false);
    }
  }

  async function addOfficer(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!officerName.trim()) {
      return;
    }

    await action(
      {
        action: "addOfficer",
        postId: post.id,
        name:
          officerName.trim(),
        phone:
          officerPhone.trim(),
      },
      "Officer deployed."
    );

    setOfficerName("");
    setOfficerPhone("");
    setRememberedOfficerKey("");
  }

  async function setShiftIncharge(
    officerId: string
  ) {
    await action(
      {
        action: "setShiftIncharge",
        officerId,
        postId: post.id,
      },
      "Shift Incharge set."
    );
  }

  async function demoteShiftIncharge(
    officerId: string
  ) {
    await action(
      {
        action: "demoteShiftIncharge",
        officerId,
      },
      "Shift Incharge demoted."
    );
  }

  async function submitUrgent(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!urgentMessage.trim()) {
      return;
    }

    await action(
      {
        action: "addUrgent",
        postId: post.id,
        message:
          urgentMessage.trim(),
      },
      "Urgent communication submitted."
    );

    setUrgentMessage("");
  }

  async function submitSecurityBreach(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    await action(
      {
        action:
          "addSecurityBreach",
        postId: post.id,
        message:
          breachMessage.trim() ||
          "Security breach reported.",
      },
      "Security breach raised."
    );

    setBreachMessage("");
  }

  return (
    <div className="fixed inset-x-2 bottom-2 z-[80] flex max-h-[78dvh] flex-col overflow-hidden rounded-3xl border border-amber-300 bg-white shadow-2xl sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-24 sm:max-h-[calc(100dvh-7rem)] sm:w-[min(430px,calc(100vw-2rem))]">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 to-amber-500 px-4 py-3 text-white sm:px-5 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">
                {post.name}
              </h2>

              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                {role}
              </span>

              {unresolved.length >
                0 && (
                <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  {unresolved.length} urgent
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-amber-100">
              Amoomi Security Post
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-slate-200 bg-white p-2">
        {(
          [
            [
              "deployed",
              `Deployed (${post.officers.length})`,
            ],
            [
              "manage",
              "Manage",
            ],
            [
              "urgent",
              unresolved.length > 0
                ? `Urgent (${unresolved.length})`
                : "Urgent",
            ],
          ] as const
        ).map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setTab(value)
              }
              className={`rounded-xl px-2 py-2.5 text-xs font-semibold transition ${
                tab === value
                  ? value ===
                    "urgent"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">
            {notice}
          </div>
        )}

        {tab ===
          "deployed" && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  Officers on duty
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Currently deployed to this post.
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                {post.officers.length}
              </div>
            </div>

            {post.officers.length ===
            0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center text-sm text-slate-500">
                No officers are currently deployed to this post.
              </div>
            ) : (
              <div className="space-y-2">
                {post.officers.map(
                  (officer) => (
                    <div
                      key={officer.id}
                      className={`rounded-2xl border px-4 py-3 transition ${
                        officer.is_shift_incharge
                          ? "border-amber-400 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 shadow-lg ring-1 ring-amber-300"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                            officer.is_shift_incharge
                              ? "border border-amber-300 bg-amber-400 text-slate-950"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {officer.name
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          {officer.is_shift_incharge && (
                            <div className="mb-1 inline-flex rounded-full border border-amber-300/70 bg-amber-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">
                              Shift Incharge
                            </div>
                          )}

                          <p
                            className={`truncate text-sm font-bold ${
                              officer.is_shift_incharge
                                ? "text-white"
                                : "text-slate-950"
                            }`}
                          >
                            {officer.name}
                          </p>
                          <p
                            className={`mt-0.5 text-xs ${
                              officer.is_shift_incharge
                                ? "text-amber-100/80"
                                : "text-slate-500"
                            }`}
                          >
                            {officer.phone ||
                              "No phone number"}
                          </p>
                        </div>

                        {role === "admin" && (
                          <div className="shrink-0">
                            {officer.is_shift_incharge ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void demoteShiftIncharge(
                                    officer.id
                                  )
                                }
                                className="rounded-lg border border-amber-300 bg-amber-400 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
                              >
                                Demote
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  busy ||
                                  allPosts.some(
                                    (candidatePost) =>
                                      candidatePost.officers.some(
                                        (candidate) =>
                                          candidate.is_shift_incharge
                                      )
                                  )
                                }
                                onClick={() =>
                                  void setShiftIncharge(
                                    officer.id
                                  )
                                }
                                title={
                                  allPosts.some(
                                    (candidatePost) =>
                                      candidatePost.officers.some(
                                        (candidate) =>
                                          candidate.is_shift_incharge
                                      )
                                  )
                                    ? "A Shift Incharge is already deployed. Demote them first."
                                    : "Set as Shift Incharge"
                                }
                                className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                Set Incharge
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {tab ===
          "manage" && (
          <>
            {role !== "admin" ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">
                  Admin access required
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-900">
                  Viewer access can see deployments and submit urgent communications. Only an Amoomi Admin can add, remove or transfer officers.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <form
                  onSubmit={addOfficer}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <h3 className="text-sm font-bold text-slate-950">
                    Deploy officer
                  </h3>

                  <div className="mt-3 space-y-2">
                    {rememberedOfficers.length >
                      0 && (
                      <div className="rounded-xl border border-amber-300 bg-white p-3">
                        <label className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                          Quick assign previous officer
                        </label>

                        <div className="mt-2 flex gap-2">
                          <select
                            value={
                              rememberedOfficerKey
                            }
                            onChange={(
                              event
                            ) => {
                              const value =
                                event.target
                                  .value;

                              setRememberedOfficerKey(
                                value
                              );

                              const selected =
                                rememberedOfficers[
                                  Number(
                                    value
                                  )
                                ];

                              if (
                                selected
                              ) {
                                setOfficerName(
                                  selected.name
                                );

                                setOfficerPhone(
                                  selected.phone ??
                                    ""
                                );
                              }
                            }}
                            className="h-11 min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                          >
                            <option value="">
                              Select previous officer…
                            </option>

                            {rememberedOfficers.map(
                              (
                                officer,
                                index
                              ) => (
                                <option
                                  key={`${officer.name}-${officer.phone ?? index}`}
                                  value={
                                    index
                                  }
                                >
                                  {
                                    officer.name
                                  }
                                  {officer.phone
                                    ? ` — ${officer.phone}`
                                    : ""}
                                </option>
                              )
                            )}
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setRememberedOfficerKey(
                                ""
                              );
                              setOfficerName(
                                ""
                              );
                              setOfficerPhone(
                                ""
                              );
                            }}
                            className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Clear
                          </button>
                        </div>

                        <p className="mt-2 text-[11px] leading-4 text-slate-400">
                          Previous names and phone numbers are remembered from deployment history.
                        </p>
                      </div>
                    )}

                    <input
                      value={officerName}
                      onChange={(event) =>
                        setOfficerName(
                          event.target
                            .value
                        )
                      }
                      placeholder="Officer name"
                      maxLength={120}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />

                    <input
                      value={officerPhone}
                      onChange={(event) =>
                        setOfficerPhone(
                          event.target
                            .value
                        )
                      }
                      placeholder="Phone number (optional)"
                      maxLength={30}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    />

                    <button
                      type="submit"
                      disabled={
                        busy ||
                        !officerName.trim()
                      }
                      className="h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-amber-300 transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add to {post.name}
                    </button>
                  </div>
                </form>

                <div>
                  <h3 className="text-sm font-bold text-slate-950">
                    Manage current officers
                  </h3>

                  <div className="mt-3 space-y-3">
                    {post.officers.length ===
                    0 ? (
                      <p className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        No officers to manage at this post.
                      </p>
                    ) : (
                      post.officers.map(
                        (officer) => {
                          const otherPosts =
                            allPosts.filter(
                              (item) =>
                                item.id !==
                                post.id
                            );

                          return (
                            <div
                              key={officer.id}
                              className="rounded-2xl border border-slate-200 p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-950">
                                    {officer.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {officer.phone ||
                                      "No phone number"}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(
                                      {
                                        action:
                                          "removeOfficer",
                                        officerId:
                                          officer.id,
                                      },
                                      "Officer removed from deployment."
                                    )
                                  }
                                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="mt-3 flex gap-2">
                                <select
                                  value={
                                    transferTargets[
                                      officer.id
                                    ] ?? ""
                                  }
                                  onChange={(event) =>
                                    setTransferTargets(
                                      (current) => ({
                                        ...current,
                                        [officer.id]:
                                          event.target
                                            .value,
                                      })
                                    )
                                  }
                                  className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-amber-500"
                                >
                                  <option value="">
                                    Transfer to…
                                  </option>

                                  {otherPosts.map(
                                    (target) => (
                                      <option
                                        key={target.id}
                                        value={target.id}
                                      >
                                        {target.name}
                                      </option>
                                    )
                                  )}
                                </select>

                                <button
                                  type="button"
                                  disabled={
                                    busy ||
                                    !transferTargets[
                                      officer.id
                                    ]
                                  }
                                  onClick={() => {
                                    const toPostId =
                                      transferTargets[
                                        officer.id
                                      ];

                                    if (!toPostId) {
                                      return;
                                    }

                                    void action(
                                      {
                                        action:
                                          "transferOfficer",
                                        officerId:
                                          officer.id,
                                        toPostId,
                                      },
                                      "Officer transferred."
                                    );
                                  }}
                                  className="h-10 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Transfer
                                </button>
                              </div>
                            </div>
                          );
                        }
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "urgent" && (
          <div className="space-y-4">
            <form
              onSubmit={
                submitSecurityBreach
              }
              className="relative overflow-hidden rounded-2xl border-2 border-red-400 bg-gradient-to-br from-red-50 via-orange-50 to-red-100 p-4 shadow-sm"
            >
              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-400/20 blur-2xl" />

              <div className="relative">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg font-black text-white shadow-md">
                    !
                  </span>

                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-red-950">
                      Security Breach
                    </h3>

                    <p className="mt-0.5 text-xs leading-5 text-red-700">
                      Use this for an immediate security incident requiring rapid attention.
                    </p>
                  </div>
                </div>

                <textarea
                  value={
                    breachMessage
                  }
                  onChange={(
                    event
                  ) =>
                    setBreachMessage(
                      event.target
                        .value
                    )
                  }
                  maxLength={500}
                  rows={2}
                  placeholder="Optional message, e.g. unauthorised access at gate…"
                  className="mt-3 w-full resize-none rounded-xl border border-red-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-3 h-12 w-full animate-pulse rounded-xl bg-red-950 px-4 text-sm font-black uppercase tracking-wider text-white shadow-xl shadow-red-950/40 ring-2 ring-red-700 transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Raise Security Breach
                </button>

                {unresolvedBreaches.length >
                  0 && (
                  <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-wide text-red-700">
                    {
                      unresolvedBreaches.length
                    } active security breach{
                      unresolvedBreaches.length ===
                      1
                        ? ""
                        : "es"
                    } on this post
                  </p>
                )}
              </div>
            </form>

            <form
              onSubmit={submitUrgent}
              className="rounded-2xl border border-red-200 bg-red-50 p-4"
            >
              <h3 className="text-sm font-bold text-red-950">
                New urgent communication
              </h3>
              <p className="mt-1 text-xs leading-5 text-red-700">
                Submitting this makes the post marker pulse red until an Admin resolves it.
              </p>

              <textarea
                value={urgentMessage}
                onChange={(event) =>
                  setUrgentMessage(
                    event.target.value
                  )
                }
                maxLength={500}
                rows={3}
                placeholder="Describe the urgent issue or communication…"
                className="mt-3 w-full resize-none rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-red-500">
                  {urgentMessage.length}/500
                </span>

                <button
                  type="submit"
                  disabled={
                    busy ||
                    !urgentMessage.trim()
                  }
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Submit Urgent
                </button>
              </div>
            </form>

            <div>
              <h3 className="text-sm font-bold text-slate-950">
                Outstanding
              </h3>

              <div className="mt-2 space-y-2">
                {unresolved.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                    No outstanding urgent communications.
                  </div>
                ) : (
                  unresolved.map(
                    (message) => (
                      <div
                        key={message.id}
                        className={`rounded-2xl border p-3 ${
                          message.incident_type ===
                          "security_breach"
                            ? "border-red-500 bg-red-100 ring-2 ring-red-300"
                            : "border-red-200 bg-red-50"
                        }`}
                      >
                        {message.incident_type ===
                          "security_breach" && (
                          <div className="mb-2 inline-flex rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                            Security Breach
                          </div>
                        )}

                        <p className="text-sm leading-5 text-red-950">
                          {message.message}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-medium text-red-500">
                            {formatTime(
                              message.created_at
                            )}
                          </span>

                          {role === "admin" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void action(
                                  {
                                    action:
                                      "resolveUrgent",
                                    urgentId:
                                      message.id,
                                  },
                                  "Urgent communication resolved."
                                )
                              }
                              className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-red-700 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>
            </div>

            {resolved.length > 0 && (
              <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-600">
                  Resolved communications ({resolved.length})
                </summary>

                <div className="mt-3 space-y-2">
                  {resolved
                    .slice(0, 10)
                    .map(
                      (message) => (
                        <div
                          key={message.id}
                          className="rounded-xl bg-white px-3 py-2.5"
                        >
                          <p className="text-xs leading-5 text-slate-700">
                            {message.message}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Raised{" "}
                            {formatTime(
                              message.created_at
                            )}
                          </p>
                        </div>
                      )
                    )}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Amoomi {role}
        </span>

        <button
          type="button"
          onClick={() =>
            void onLogout()
          }
          className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
