"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useEditorAccess } from "@/components/editor/EditorAccessProvider";
import { supabase } from "@/lib/supabase";

import type { UrgentTask } from "@/types/site";

interface UrgentTasksListProps {
  areaId: string;
  areaName: string;
}

function formatCompletedTime(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(dateString));
}

export default function UrgentTasksList({
  areaId,
  areaName,
}: UrgentTasksListProps) {
  const { canEdit } = useEditorAccess();

  const [tasks, setTasks] =
    useState<UrgentTask[]>([]);

  const [taskText, setTaskText] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [adding, setAdding] =
    useState(false);

  /*
   * LOAD TASKS
   */
  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from("urgent_tasks")
      .select("*")
      .eq("area_id", areaId)
      .order("completed", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Failed to load urgent tasks:",
        error
      );

      return;
    }

    setTasks(
      (data ?? []) as UrgentTask[]
    );
  }, [areaId]);

  useEffect(() => {
    let cancelled = false;

    async function initialise() {
      setLoading(true);

      const { data, error } =
        await supabase
          .from("urgent_tasks")
          .select("*")
          .eq("area_id", areaId)
          .order("completed", {
            ascending: true,
          })
          .order("created_at", {
            ascending: true,
          });

      if (cancelled) return;

      if (error) {
        console.error(
          "Failed to load urgent tasks:",
          error
        );

        setLoading(false);
        return;
      }

      setTasks(
        (data ?? []) as UrgentTask[]
      );

      setLoading(false);
    }

    void initialise();

    return () => {
      cancelled = true;
    };
  }, [areaId]);

  /*
   * REALTIME
   */
  useEffect(() => {
    const channel = supabase
      .channel(
        `urgent-tasks-${areaId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "urgent_tasks",
        },
        () => {
          void loadTasks();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        channel
      );
    };
  }, [areaId, loadTasks]);

  /*
   * ADD TASK
   */
  async function addTask(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!canEdit) {
      alert(
        "Enable editing before adding an urgent task."
      );
      return;
    }

    const cleanTask =
      taskText.trim();

    if (!cleanTask) return;

    setAdding(true);

    try {
      const response = await fetch(
        "/api/urgent-tasks",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            areaId,
            taskText: cleanTask,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "The urgent task could not be added."
        );
      }

      setTasks((current) => [
        ...current,
        data.task as UrgentTask,
      ]);

      setTaskText("");
    } catch (error) {
      console.error(
        "Failed to add urgent task:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "The urgent task could not be added."
      );
    } finally {
      setAdding(false);
    }
  }

  /*
   * COMPLETE / REOPEN TASK
   */
  async function toggleTask(
    task: UrgentTask,
    completed: boolean
  ) {
    if (!canEdit) {
      alert(
        "Enable editing before changing an urgent task."
      );
      return;
    }

    const previousTask = task;

    const optimisticTask: UrgentTask = {
      ...task,
      completed,
      completed_at:
        completed
          ? new Date().toISOString()
          : null,
      updated_at:
        new Date().toISOString(),
    };

    setTasks((current) =>
      current.map(
        (currentTask) =>
          currentTask.id === task.id
            ? optimisticTask
            : currentTask
      )
    );

    try {
      const response = await fetch(
        `/api/urgent-tasks/${encodeURIComponent(
          task.id
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            completed,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "The urgent task could not be updated."
        );
      }

      setTasks((current) =>
        current.map(
          (currentTask) =>
            currentTask.id === task.id
              ? (data.task as UrgentTask)
              : currentTask
        )
      );
    } catch (error) {
      console.error(
        "Failed to update urgent task:",
        error
      );

      setTasks((current) =>
        current.map(
          (currentTask) =>
            currentTask.id === task.id
              ? previousTask
              : currentTask
        )
      );

      alert(
        error instanceof Error
          ? error.message
          : "The urgent task could not be updated."
      );
    }
  }

  /*
   * REMOVE TASK
   */
  async function removeTask(
    task: UrgentTask
  ) {
    if (!canEdit) {
      alert(
        "Enable editing before removing an urgent task."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Remove "${task.task_text}" from ${areaName}?`
      );

    if (!confirmed) return;

    const previousTasks = tasks;

    setTasks((current) =>
      current.filter(
        (currentTask) =>
          currentTask.id !== task.id
      )
    );

    try {
      const response = await fetch(
        `/api/urgent-tasks/${encodeURIComponent(
          task.id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            "The urgent task could not be removed."
        );
      }
    } catch (error) {
      console.error(
        "Failed to remove urgent task:",
        error
      );

      setTasks(previousTasks);

      alert(
        error instanceof Error
          ? error.message
          : "The urgent task could not be removed."
      );
    }
  }

  const outstandingTasks =
    tasks.filter(
      (task) => !task.completed
    );

  const completedTasks =
    tasks.filter(
      (task) => task.completed
    );

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            Urgent Tasks
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Record issues or fixes that
            need attention before this
            area is ready.
          </p>
        </div>

        {outstandingTasks.length >
          0 && (
          <div className="flex min-w-8 items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
            {
              outstandingTasks.length
            }
          </div>
        )}
      </div>

      <form
        onSubmit={addTask}
        className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3"
      >
        <label className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Add Urgent Task
        </label>

        <textarea
          value={taskText}
          onChange={(event) =>
            setTaskText(
              event.target.value
            )
          }
          rows={2}
          disabled={!canEdit}
          placeholder={
            canEdit
              ? "e.g. Connect rear lighting"
              : "Enable editing to add a task"
          }
          className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-red-400 disabled:cursor-not-allowed disabled:bg-slate-100"
        />

        <button
          type="submit"
          disabled={
            adding ||
            !taskText.trim() ||
            !canEdit
          }
          className="mt-2 min-h-11 w-full rounded-lg bg-red-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {adding
            ? "Adding..."
            : "Add Urgent Task"}
        </button>
      </form>

      <div className="mt-5">
        {loading && (
          <p className="text-sm text-slate-500">
            Loading tasks...
          </p>
        )}

        {!loading &&
          tasks.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center">
              <div className="text-xl text-green-600">
                ✓
              </div>

              <p className="mt-2 text-sm font-medium text-slate-700">
                No urgent tasks
              </p>

              <p className="mt-1 text-xs text-slate-500">
                There are currently no
                recorded fixes for this
                area.
              </p>
            </div>
          )}

        {outstandingTasks.length >
          0 && (
          <div className="grid gap-2">
            {outstandingTasks.map(
              (task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-red-200 bg-white p-3"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={
                        !canEdit
                      }
                      onChange={() =>
                        toggleTask(
                          task,
                          true
                        )
                      }
                      aria-label={`Complete ${task.task_text}`}
                      className="mt-1 h-5 w-5 shrink-0 disabled:cursor-not-allowed"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-5 text-slate-900">
                        {
                          task.task_text
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        !canEdit
                      }
                      onClick={() =>
                        removeTask(
                          task
                        )
                      }
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {completedTasks.length >
          0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Completed
            </p>

            <div className="grid gap-2">
              {completedTasks.map(
                (task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked
                        disabled={
                          !canEdit
                        }
                        onChange={() =>
                          toggleTask(
                            task,
                            false
                          )
                        }
                        aria-label={`Reopen ${task.task_text}`}
                        className="mt-1 h-5 w-5 shrink-0 disabled:cursor-not-allowed"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-500 line-through">
                          {
                            task.task_text
                          }
                        </p>

                        {task.completed_at && (
                          <p className="mt-1 text-xs text-slate-400">
                            Completed{" "}
                            {formatCompletedTime(
                              task.completed_at
                            )}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={
                          !canEdit
                        }
                        onClick={() =>
                          removeTask(
                            task
                          )
                        }
                        className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}