"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useEditorAccess } from "@/components/editor/EditorAccessProvider";

interface UrgentTask {
  id: string;
  area_id: string;
  task_text: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
}

interface UrgentTasksListProps {
  areaId: string;
  areaName: string;
}

interface RestrictedTaskAccessState {
  authorised: boolean;
  username: string | null;
}

interface SmsResult {
  attempted?: boolean;
  sent?: boolean;
  error?: string | null;
}

type AccessGroup =
  | "lajna"
  | "ansar";

function formatTaskDate(
  value?: string
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        "Europe/London",
    }
  ).format(date);
}

function StatusIcon({
  completed,
}: {
  completed: boolean;
}) {
  if (completed) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M5 10.2 8.2 13.4 15 6.6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
      <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
    </span>
  );
}

export default function UrgentTasksList({
  areaId,
  areaName,
}: UrgentTasksListProps) {
  const {
    canEdit,
  } =
    useEditorAccess();

  const [
    tasks,
    setTasks,
  ] =
    useState<UrgentTask[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    newTask,
    setNewTask,
  ] =
    useState("");

  const [
    adding,
    setAdding,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    notice,
    setNotice,
  ] =
    useState<
      string | null
    >(null);

  const [
    showResolved,
    setShowResolved,
  ] =
    useState(false);

  const [
    lajnaAccess,
    setLajnaAccess,
  ] =
    useState<RestrictedTaskAccessState>({
      authorised: false,
      username: null,
    });

  const [
    ansarAccess,
    setAnsarAccess,
  ] =
    useState<RestrictedTaskAccessState>({
      authorised: false,
      username: null,
    });

  const [
    checkingLajna,
    setCheckingLajna,
  ] =
    useState(false);

  const [
    checkingAnsar,
    setCheckingAnsar,
  ] =
    useState(false);

  const [
    showLajnaLogin,
    setShowLajnaLogin,
  ] =
    useState(false);

  const [
    showAnsarLogin,
    setShowAnsarLogin,
  ] =
    useState(false);

  const [
    username,
    setUsername,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    signingIn,
    setSigningIn,
  ] =
    useState(false);

  const [
    loginError,
    setLoginError,
  ] =
    useState<
      string | null
    >(null);

  const normalizedAreaName =
    areaName
      .trim()
      .toLowerCase();

  const isLajnaArea =
    normalizedAreaName.startsWith(
      "lajna"
    );

  const isAnsarArea =
    normalizedAreaName.startsWith(
      "ansar"
    );

  const restrictedGroup:
    AccessGroup | null =
    isLajnaArea
      ? "lajna"
      : isAnsarArea
        ? "ansar"
        : null;

  const activeRestrictedAccess =
    restrictedGroup ===
    "lajna"
      ? lajnaAccess
      : restrictedGroup ===
          "ansar"
        ? ansarAccess
        : null;

  const canAddTask =
    canEdit ||
    Boolean(
      activeRestrictedAccess
        ?.authorised
    );

  const outstandingTasks =
    useMemo(
      () =>
        tasks.filter(
          (task) =>
            !task.completed
        ),
      [
        tasks,
      ]
    );

  const resolvedTasks =
    useMemo(
      () =>
        tasks.filter(
          (task) =>
            task.completed
        ),
      [
        tasks,
      ]
    );

  const loadTasks =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          const response =
            await fetch(
              `/api/urgent-tasks?areaId=${encodeURIComponent(
                areaId
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            (await response
              .json()
              .catch(
                () => null
              )) as
              | {
                  success?: boolean;
                  tasks?: UrgentTask[];
                  error?: string;
                }
              | null;

          if (
            !response.ok
          ) {
            throw new Error(
              data?.error ??
                "Urgent tasks could not be loaded."
            );
          }

          setTasks(
            data?.tasks ??
              []
          );
        } catch (
          loadError
        ) {
          console.error(
            "Failed to load urgent tasks:",
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Urgent tasks could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        areaId,
      ]
    );

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          void loadTasks();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    loadTasks,
  ]);

  useEffect(() => {
    if (
      canEdit ||
      !isLajnaArea
    ) {
      return;
    }

    let cancelled =
      false;

    async function checkAccess() {
      setCheckingLajna(
        true
      );

      try {
        const response =
          await fetch(
            "/api/lajna-access",
            {
              cache:
                "no-store",
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as
            | {
                authorised?: boolean;
                username?: string | null;
              }
            | null;

        if (!cancelled) {
          setLajnaAccess({
            authorised:
              Boolean(
                response.ok &&
                  data?.authorised
              ),
            username:
              data?.username ??
              null,
          });
        }
      } catch {
        if (!cancelled) {
          setLajnaAccess({
            authorised: false,
            username: null,
          });
        }
      } finally {
        if (!cancelled) {
          setCheckingLajna(
            false
          );
        }
      }
    }

    void checkAccess();

    return () => {
      cancelled =
        true;
    };
  }, [
    canEdit,
    isLajnaArea,
  ]);

  useEffect(() => {
    if (
      canEdit ||
      !isAnsarArea
    ) {
      return;
    }

    let cancelled =
      false;

    async function checkAccess() {
      setCheckingAnsar(
        true
      );

      try {
        const response =
          await fetch(
            "/api/ansar-access",
            {
              cache:
                "no-store",
            }
          );

        const data =
          (await response
            .json()
            .catch(
              () => null
            )) as
            | {
                authorised?: boolean;
                username?: string | null;
              }
            | null;

        if (!cancelled) {
          setAnsarAccess({
            authorised:
              Boolean(
                response.ok &&
                  data?.authorised
              ),
            username:
              data?.username ??
              null,
          });
        }
      } catch {
        if (!cancelled) {
          setAnsarAccess({
            authorised: false,
            username: null,
          });
        }
      } finally {
        if (!cancelled) {
          setCheckingAnsar(
            false
          );
        }
      }
    }

    void checkAccess();

    return () => {
      cancelled =
        true;
    };
  }, [
    canEdit,
    isAnsarArea,
  ]);

  function resetLoginForm() {
    setUsername("");
    setPassword("");
    setLoginError(null);
  }

  async function signInRestricted(
    event: FormEvent<HTMLFormElement>,
    group: AccessGroup
  ) {
    event.preventDefault();

    if (
      !username.trim() ||
      !password
    ) {
      setLoginError(
        "Enter your username and password."
      );
      return;
    }

    setSigningIn(true);
    setLoginError(null);

    try {
      const response =
        await fetch(
          group === "lajna"
            ? "/api/lajna-access"
            : "/api/ansar-access",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                username:
                  username.trim(),
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
              success?: boolean;
              authorised?: boolean;
              username?: string | null;
              error?: string;
            }
          | null;

      if (
        !response.ok ||
        !data?.authorised
      ) {
        throw new Error(
          data?.error ??
            "The username or password was not accepted."
        );
      }

      const access = {
        authorised: true,
        username:
          data.username ??
          username.trim(),
      };

      if (
        group === "lajna"
      ) {
        setLajnaAccess(
          access
        );
        setShowLajnaLogin(
          false
        );
      } else {
        setAnsarAccess(
          access
        );
        setShowAnsarLogin(
          false
        );
      }

      setPassword("");
      setNotice(
        `${
          group ===
          "lajna"
            ? "Lajna"
            : "Ansar"
        } urgent-task access enabled.`
      );
    } catch (
      signInError
    ) {
      setLoginError(
        signInError instanceof
          Error
          ? signInError.message
          : "Task access could not be enabled."
      );
    } finally {
      setSigningIn(false);
    }
  }

  async function signOutRestricted(
    group: AccessGroup
  ) {
    try {
      await fetch(
        group === "lajna"
          ? "/api/lajna-access"
          : "/api/ansar-access",
        {
          method:
            "DELETE",
        }
      );
    } finally {
      if (
        group === "lajna"
      ) {
        setLajnaAccess({
          authorised: false,
          username: null,
        });
      } else {
        setAnsarAccess({
          authorised: false,
          username: null,
        });
      }

      resetLoginForm();
      setNotice(null);
    }
  }

  async function addTask() {
    const taskText =
      newTask.trim();

    if (
      !taskText ||
      !canAddTask
    ) {
      return;
    }

    setAdding(true);
    setError(null);
    setNotice(null);

    try {
      const response =
        await fetch(
          "/api/urgent-tasks",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                areaId,
                taskText,
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
              success?: boolean;
              task?: UrgentTask;
              error?: string;
              adminSms?: SmsResult;
            }
          | null;

      if (
        !response.ok ||
        !data?.task
      ) {
        throw new Error(
          data?.error ??
            "The urgent task could not be added."
        );
      }

      setTasks(
        (current) => [
          data.task as UrgentTask,
          ...current,
        ]
      );

      setNewTask("");

      if (
        !canEdit &&
        data.adminSms
          ?.attempted
      ) {
        if (
          data.adminSms
            .sent
        ) {
          setNotice(
            "Urgent task raised. Site Ops has been notified by SMS."
          );
        } else {
          setNotice(
            "Urgent task raised successfully."
          );

          setError(
            data.adminSms
              .error ??
              "The task was raised, but the Site Ops SMS could not be sent."
          );
        }
      } else {
        setNotice(
          "Urgent task added."
        );
      }
    } catch (
      addError
    ) {
      console.error(
        "Failed to add urgent task:",
        addError
      );

      setError(
        addError instanceof
          Error
          ? addError.message
          : "The urgent task could not be added."
      );
    } finally {
      setAdding(false);
    }
  }

  async function toggleTask(
    task: UrgentTask
  ) {
    if (!canEdit) {
      return;
    }

    const nextCompleted =
      !task.completed;

    const previousTasks =
      tasks;

    setError(null);
    setNotice(null);

    setTasks(
      (current) =>
        current.map(
          (currentTask) =>
            currentTask.id ===
            task.id
              ? {
                  ...currentTask,
                  completed:
                    nextCompleted,
                }
              : currentTask
        )
    );

    try {
      const response =
        await fetch(
          `/api/urgent-tasks/${encodeURIComponent(
            task.id
          )}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                completed:
                  nextCompleted,
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
              task?: UrgentTask;
              error?: string;
              sms?: SmsResult;
            }
          | null;

      if (
        !response.ok
      ) {
        throw new Error(
          data?.error ??
            "The urgent task could not be updated."
        );
      }

      if (
        data?.task
      ) {
        setTasks(
          (current) =>
            current.map(
              (
                currentTask
              ) =>
                currentTask.id ===
                task.id
                  ? (data.task as UrgentTask)
                  : currentTask
            )
        );
      }

      if (
        nextCompleted
      ) {
        if (
          data?.sms
            ?.attempted
        ) {
          if (
            data.sms.sent
          ) {
            setNotice(
              "Task resolved. The reporter has been notified by SMS."
            );
          } else {
            setNotice(
              "Task resolved."
            );

            setError(
              data.sms.error ??
                "The task was resolved, but its SMS notification could not be sent."
            );
          }
        } else {
          setNotice(
            "Task resolved."
          );
        }
      } else {
        setNotice(
          "Task reopened."
        );
      }
    } catch (
      updateError
    ) {
      setTasks(
        previousTasks
      );

      setError(
        updateError instanceof
          Error
          ? updateError.message
          : "The urgent task could not be updated."
      );
    }
  }

  async function removeTask(
    task: UrgentTask
  ) {
    if (!canEdit) {
      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${task.task_text}"?`
      );

    if (!confirmed) {
      return;
    }

    const previousTasks =
      tasks;

    setError(null);
    setNotice(null);

    setTasks(
      (current) =>
        current.filter(
          (
            currentTask
          ) =>
            currentTask.id !==
            task.id
        )
    );

    try {
      const response =
        await fetch(
          `/api/urgent-tasks/${encodeURIComponent(
            task.id
          )}`,
          {
            method:
              "DELETE",
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

      if (
        !response.ok
      ) {
        throw new Error(
          data?.error ??
            "The urgent task could not be removed."
        );
      }

      setNotice(
        "Urgent task removed."
      );
    } catch (
      deleteError
    ) {
      setTasks(
        previousTasks
      );

      setError(
        deleteError instanceof
          Error
          ? deleteError.message
          : "The urgent task could not be removed."
      );
    }
  }

  const checkingRestrictedAccess =
    (
      isLajnaArea &&
      checkingLajna
    ) ||
    (
      isAnsarArea &&
      checkingAnsar
    );

  const restrictedAccessAuthorised =
    Boolean(
      activeRestrictedAccess
        ?.authorised
    );

  const accessLabel =
    restrictedGroup ===
    "lajna"
      ? "Lajna"
      : restrictedGroup ===
          "ansar"
        ? "Ansar"
        : null;

  const accent =
    restrictedGroup ===
    "lajna"
      ? {
          border:
            "border-pink-200",
          soft:
            "bg-pink-50",
          text:
            "text-pink-800",
          button:
            "bg-pink-600 hover:bg-pink-700",
          ring:
            "focus:border-pink-400 focus:ring-pink-100",
        }
      : {
          border:
            "border-blue-200",
          soft:
            "bg-blue-50",
          text:
            "text-blue-800",
          button:
            "bg-blue-600 hover:bg-blue-700",
          ring:
            "focus:border-blue-400 focus:ring-blue-100",
        };

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* HEADER */}
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M10 2.8 17 15H3L10 2.8Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 7v3.8M10 13.3v.1"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>

              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-950">
                  Urgent Tasks
                </h3>

                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {areaName}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              outstandingTasks.length >
              0
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {outstandingTasks.length >
            0
              ? `${outstandingTasks.length} open`
              : "All clear"}
          </div>
        </div>

        {!canEdit &&
          restrictedAccessAuthorised &&
          accessLabel && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />

                  <p className="truncate text-xs font-semibold text-slate-800">
                    {accessLabel} task access active
                  </p>
                </div>

                <p className="mt-0.5 truncate pl-4 text-[11px] text-slate-500">
                  {activeRestrictedAccess
                    ?.username ??
                    "Restricted user"}{" "}
                  · SMS notifications enabled
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  restrictedGroup
                    ? void signOutRestricted(
                        restrictedGroup
                      )
                    : undefined
                }
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                Log out
              </button>
            </div>
          )}
      </div>

      <div className="p-4">
        {/* FEEDBACK */}
        {notice && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path
                d="M5 10.2 8.2 13.4 15 6.6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <span>
              {notice}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            >
              <path
                d="M10 3.3 17 15.5H3L10 3.3Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M10 7.2v3.5M10 13.1v.1"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>

            <span>
              {error}
            </span>
          </div>
        )}

        {/* CREATE TASK */}
        {canAddTask && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="mb-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Raise an urgent task
              </p>

              {!canEdit &&
                restrictedAccessAuthorised && (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Site Ops will be notified immediately. Your registered phone will receive an SMS when the issue is resolved.
                  </p>
                )}
            </div>

            <textarea
              value={
                newTask
              }
              onChange={(
                event
              ) => {
                setNewTask(
                  event.target.value
                );

                if (error) {
                  setError(null);
                }

                if (notice) {
                  setNotice(null);
                }
              }}
              maxLength={
                500
              }
              rows={
                3
              }
              placeholder="Describe the issue clearly, including the exact location if useful…"
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm font-medium leading-5 text-slate-950 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />

            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-slate-400">
                {
                  newTask.length
                }
                /500
              </span>

              <button
                type="button"
                disabled={
                  adding ||
                  !newTask.trim()
                }
                onClick={() =>
                  void addTask()
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {adding && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                )}

                {adding
                  ? "Raising task…"
                  : "Raise urgent task"}
              </button>
            </div>
          </div>
        )}

        {/* RESTRICTED LOGIN */}
        {!canEdit &&
          restrictedGroup &&
          !restrictedAccessAuthorised &&
          !checkingRestrictedAccess && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              {(
                restrictedGroup ===
                  "lajna"
                  ? !showLajnaLogin
                  : !showAnsarLogin
              ) ? (
                <div>
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent.soft} ${accent.text}`}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-4.5 w-4.5"
                        aria-hidden="true"
                      >
                        <path
                          d="M6.5 8V6.5a3.5 3.5 0 0 1 7 0V8M5.2 8h9.6v8H5.2V8Z"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {accessLabel} Task Access
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Sign in to raise urgent tasks for this area. Site Ops is alerted immediately and your registered phone is notified when the issue is resolved.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetLoginForm();

                      if (
                        restrictedGroup ===
                        "lajna"
                      ) {
                        setShowLajnaLogin(
                          true
                        );
                      } else {
                        setShowAnsarLogin(
                          true
                        );
                      }
                    }}
                    className={`mt-3 h-10 w-full rounded-xl text-sm font-bold text-white transition ${accent.button}`}
                  >
                    Sign in to raise a task
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(
                    event
                  ) =>
                    void signInRestricted(
                      event,
                      restrictedGroup
                    )
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {accessLabel} Task Access
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Enter your site task credentials.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        resetLoginForm();

                        if (
                          restrictedGroup ===
                          "lajna"
                        ) {
                          setShowLajnaLogin(
                            false
                          );
                        } else {
                          setShowAnsarLogin(
                            false
                          );
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-lg text-slate-400 transition hover:bg-white hover:text-slate-700"
                      aria-label={`Close ${accessLabel} login`}
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <input
                      type="text"
                      autoComplete="username"
                      value={
                        username
                      }
                      onChange={(
                        event
                      ) => {
                        setUsername(
                          event.target.value
                        );
                        setLoginError(
                          null
                        );
                      }}
                      placeholder="Username"
                      className={`h-11 rounded-xl border bg-white px-3.5 text-sm font-medium text-slate-950 outline-none transition ${accent.border} ${accent.ring} focus:ring-2`}
                    />

                    <input
                      type="password"
                      autoComplete="current-password"
                      value={
                        password
                      }
                      onChange={(
                        event
                      ) => {
                        setPassword(
                          event.target.value
                        );
                        setLoginError(
                          null
                        );
                      }}
                      placeholder="Password"
                      className={`h-11 rounded-xl border bg-white px-3.5 text-sm font-medium text-slate-950 outline-none transition ${accent.border} ${accent.ring} focus:ring-2`}
                    />
                  </div>

                  {loginError && (
                    <p className="mt-2 text-xs font-semibold text-red-600">
                      {loginError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      signingIn
                    }
                    className={`mt-3 h-11 w-full rounded-xl text-sm font-bold text-white transition disabled:opacity-50 ${accent.button}`}
                  >
                    {signingIn
                      ? "Signing in…"
                      : "Sign in"}
                  </button>
                </form>
              )}
            </div>
          )}

        {checkingRestrictedAccess &&
          !canEdit &&
          restrictedGroup && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-medium text-slate-500">
              Checking {accessLabel} task access…
            </div>
          )}

        {/* OUTSTANDING TASKS */}
        <div className="mt-4">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Open issues
              </p>

              <p className="mt-0.5 text-[11px] text-slate-400">
                Issues that still require action
              </p>
            </div>

            {outstandingTasks.length >
              0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
                {
                  outstandingTasks.length
                }
              </span>
            )}
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-5 text-center text-xs font-medium text-slate-500">
              Loading urgent tasks…
            </div>
          ) : outstandingTasks.length ===
            0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="flex items-center gap-3">
                <StatusIcon
                  completed
                />

                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    No open urgent issues
                  </p>

                  <p className="mt-0.5 text-xs text-emerald-700">
                    This area currently has no unresolved urgent tasks.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {outstandingTasks.map(
                (
                  task
                ) => {
                  const createdAt =
                    formatTaskDate(
                      task.created_at
                    );

                  return (
                    <article
                      key={
                        task.id
                      }
                      className="rounded-2xl border border-red-200 bg-red-50/70 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                    >
                      <div className="flex items-start gap-3">
                        <StatusIcon
                          completed={
                            false
                          }
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                              Urgent
                            </span>

                            {createdAt && (
                              <span className="text-[11px] font-medium text-slate-400">
                                Raised {
                                  createdAt
                                }
                              </span>
                            )}
                          </div>

                          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold leading-5 text-slate-900">
                            {
                              task.task_text
                            }
                          </p>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="mt-3 flex items-center justify-end gap-2 border-t border-red-200/70 pt-3">
                          <button
                            type="button"
                            onClick={() =>
                              void removeTask(
                                task
                              )
                            }
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-white hover:text-red-700"
                          >
                            Remove
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void toggleTask(
                                task
                              )
                            }
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                          >
                            <svg
                              viewBox="0 0 20 20"
                              fill="none"
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            >
                              <path
                                d="M5 10.2 8.2 13.4 15 6.6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>

                            Mark resolved
                          </button>
                        </div>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* RESOLVED TASKS */}
        {!loading &&
          resolvedTasks.length >
            0 && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() =>
                  setShowResolved(
                    (current) =>
                      !current
                  )
                }
                className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left transition hover:bg-slate-50"
              >
                <div>
                  <p className="text-xs font-bold text-slate-700">
                    Resolved tasks
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {
                      resolvedTasks.length
                    }{" "}
                    completed
                  </p>
                </div>

                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`h-4 w-4 text-slate-400 transition ${
                    showResolved
                      ? "rotate-180"
                      : ""
                  }`}
                  aria-hidden="true"
                >
                  <path
                    d="m6 8 4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {showResolved && (
                <div className="mt-2 space-y-2">
                  {resolvedTasks.map(
                    (
                      task
                    ) => {
                      const updatedAt =
                        formatTaskDate(
                          task.updated_at ??
                            task.created_at
                        );

                      return (
                        <article
                          key={
                            task.id
                          }
                          className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-start gap-3">
                            <StatusIcon
                              completed
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                  Resolved
                                </span>

                                {updatedAt && (
                                  <span className="text-[11px] font-medium text-slate-400">
                                    {
                                      updatedAt
                                    }
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5 text-slate-600">
                                {
                                  task.task_text
                                }
                              </p>
                            </div>
                          </div>

                          {canEdit && (
                            <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-slate-200 pt-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  void removeTask(
                                    task
                                  )
                                }
                                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-white hover:text-red-600"
                              >
                                Remove
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void toggleTask(
                                    task
                                  )
                                }
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                              >
                                Reopen
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    </section>
  );
}
