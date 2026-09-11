"use client";

import {
  useCallback,
  useEffect,
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

interface LajnaAccessState {
  authorised: boolean;
  username: string | null;
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
    useState<
      UrgentTask[]
    >([]);

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

  /*
   * Restricted Lajna access state.
   *
   * This NEVER changes the existing
   * EditorAccessProvider / canEdit value.
   */
  const [
    lajnaAccess,
    setLajnaAccess,
  ] =
    useState<LajnaAccessState>({
      authorised: false,
      username: null,
    });

  const [
    checkingLajna,
    setCheckingLajna,
  ] =
    useState(false);

  const [
    showLajnaLogin,
    setShowLajnaLogin,
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

  /*
   * UI check only.
   *
   * Security is NOT based on this.
   * The API independently checks the
   * database area name before allowing
   * the task to be inserted.
   */
  const isLajnaArea =
    areaName
      .trim()
      .toLowerCase()
      .startsWith(
        "lajna"
      );

  /*
   * Full site editors can already edit
   * everything.
   *
   * Lajna users can add only on Lajna
   * areas.
   */
  const canAddTask =
    canEdit ||
    (
      isLajnaArea &&
      lajnaAccess.authorised
    );

  /*
   * LOAD TASKS
   */
  const loadTasks =
    useCallback(
      async () => {
        setLoading(
          true
        );

        setError(
          null
        );

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
          setLoading(
            false
          );
        }
      },
      [areaId]
    );

  useEffect(() => {
  const timeout = window.setTimeout(() => {
    void loadTasks();
  }, 0);

  return () => {
    window.clearTimeout(timeout);
  };
}, [loadTasks]);

  /*
   * CHECK WHETHER THIS BROWSER ALREADY
   * HAS A LAJNA TASK SESSION.
   *
   * Only necessary while looking at a
   * Lajna area and when the user is not
   * already a full editor.
   */
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

        if (
          !cancelled
        ) {
          setLajnaAccess({
            authorised:
              Boolean(
                data?.authorised
              ),
            username:
              data?.username ??
              null,
          });
        }
      } catch {
        if (
          !cancelled
        ) {
          setLajnaAccess({
            authorised:
              false,
            username:
              null,
          });
        }
      } finally {
        if (
          !cancelled
        ) {
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

  /*
   * LAJNA LOGIN
   */
  async function signInLajna(
    event: React.FormEvent
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

    setSigningIn(
      true
    );

    setLoginError(
      null
    );

    try {
      const response =
        await fetch(
          "/api/lajna-access",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  username:
                    username.trim(),
                  password,
                }
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

      setLajnaAccess({
        authorised:
          true,
        username:
          data.username ??
          username.trim(),
      });

      setPassword(
        ""
      );

      setShowLajnaLogin(
        false
      );
    } catch (
      signInError
    ) {
      setLoginError(
        signInError instanceof
          Error
          ? signInError.message
          : "Lajna task access could not be enabled."
      );
    } finally {
      setSigningIn(
        false
      );
    }
  }

  /*
   * LAJNA LOGOUT
   */
  async function signOutLajna() {
    try {
      await fetch(
        "/api/lajna-access",
        {
          method:
            "DELETE",
        }
      );
    } finally {
      setLajnaAccess({
        authorised:
          false,
        username:
          null,
      });

      setUsername(
        ""
      );

      setPassword(
        ""
      );
    }
  }

  /*
   * ADD URGENT TASK
   */
  async function addTask() {
    const taskText =
      newTask.trim();

    if (
      !taskText ||
      !canAddTask
    ) {
      return;
    }

    setAdding(
      true
    );

    setError(
      null
    );

    try {
      const response =
        await fetch(
          "/api/urgent-tasks",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  areaId,
                  taskText,
                }
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
              success?: boolean;
              task?: UrgentTask;
              error?: string;
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

      setNewTask(
        ""
      );
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
      setAdding(
        false
      );
    }
  }

  /*
   * EXISTING ADMIN-ONLY UPDATE
   *
   * Lajna users cannot complete/reopen
   * existing tasks. This keeps their
   * permission specifically to RAISING
   * urgent tasks.
   */
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
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  completed:
                    nextCompleted,
                }
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
              task?: UrgentTask;
              error?: string;
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

  /*
   * EXISTING ADMIN-ONLY DELETE
   */
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

  const outstandingCount =
    tasks.filter(
      (task) =>
        !task.completed
    ).length;

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Urgent Tasks
          </h3>

          <p className="mt-0.5 text-xs text-slate-500">
            {outstandingCount}{" "}
            outstanding
          </p>
        </div>

        {!canEdit &&
          isLajnaArea &&
          lajnaAccess.authorised && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-pink-700">
                Lajna Access
              </span>

              <button
                type="button"
                onClick={() =>
                  void signOutLajna()
                }
                className="text-[11px] font-semibold text-slate-400 transition hover:text-slate-700"
              >
                Log out
              </button>
            </div>
          )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* ADD TASK */}
      {canAddTask && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <textarea
            value={
              newTask
            }
            onChange={(
              event
            ) =>
              setNewTask(
                event.target
                  .value
              )
            }
            maxLength={
              500
            }
            rows={
              3
            }
            placeholder="Describe the urgent issue…"
            className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
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
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {adding
                ? "Adding…"
                : "Add Urgent Task"}
            </button>
          </div>
        </div>
      )}

      {/* LAJNA LOGIN */}
      {!canEdit &&
        isLajnaArea &&
        !lajnaAccess.authorised &&
        !checkingLajna && (
          <div className="mt-3">
            {!showLajnaLogin ? (
              <button
                type="button"
                onClick={() => {
                  setShowLajnaLogin(
                    true
                  );

                  setLoginError(
                    null
                  );
                }}
                className="w-full rounded-xl border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm font-semibold text-pink-700 transition hover:bg-pink-100"
              >
                Lajna Task Access
              </button>
            ) : (
              <form
                onSubmit={
                  signInLajna
                }
                className="rounded-xl border border-pink-200 bg-pink-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-pink-900">
                      Lajna Task Access
                    </p>

                    <p className="mt-0.5 text-xs leading-5 text-pink-700">
                      Sign in to raise urgent tasks for Lajna areas.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowLajnaLogin(
                        false
                      );

                      setLoginError(
                        null
                      );
                    }}
                    className="text-lg leading-none text-pink-400 hover:text-pink-700"
                    aria-label="Close Lajna login"
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
                    ) =>
                      setUsername(
                        event.target
                          .value
                      )
                    }
                    placeholder="Username"
                    className="h-10 rounded-xl border border-pink-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                  />

                  <input
                    type="password"
                    autoComplete="current-password"
                    value={
                      password
                    }
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target
                          .value
                      )
                    }
                    placeholder="Password"
                    className="h-10 rounded-xl border border-pink-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                  />
                </div>

                {loginError && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {
                      loginError
                    }
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    signingIn
                  }
                  className="mt-3 h-10 w-full rounded-xl bg-pink-600 text-sm font-semibold text-white transition hover:bg-pink-700 disabled:opacity-50"
                >
                  {signingIn
                    ? "Signing in…"
                    : "Sign in"}
                </button>
              </form>
            )}
          </div>
        )}

      {checkingLajna &&
        !canEdit &&
        isLajnaArea && (
          <p className="mt-3 text-xs text-slate-400">
            Checking Lajna task access…
          </p>
        )}

      {/* TASK LIST */}
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-xs text-slate-500">
            Loading urgent tasks…
          </div>
        ) : tasks.length ===
          0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
            No urgent tasks recorded.
          </div>
        ) : (
          tasks.map(
            (task) => (
              <div
                key={
                  task.id
                }
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  task.completed
                    ? "border-slate-200 bg-slate-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() =>
                      void toggleTask(
                        task
                      )
                    }
                    aria-label={
                      task.completed
                        ? "Reopen urgent task"
                        : "Complete urgent task"
                    }
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
                      task.completed
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-red-300 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </button>
                ) : (
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      task.completed
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-5 ${
                      task.completed
                        ? "text-slate-500 line-through"
                        : "font-medium text-red-900"
                    }`}
                  >
                    {
                      task.task_text
                    }
                  </p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() =>
                      void removeTask(
                        task
                      )
                    }
                    aria-label="Remove urgent task"
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 transition hover:bg-white hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            )
          )
        )}
      </div>
    </section>
  );
}