export type EventRow = {
  telegram_user_id: number;
  event_type: string;
  payload?: { project_id?: string; task_id?: string; title?: string } | null;
};

export type UserSession = {
  telegramUserId: number;
  activeProjectId: string | null;
  currentTaskId: string | null;
  awaitingResult: boolean;
};

/**
 * Resolve conversation state only from events owned by this Telegram user.
 * This deliberately replaces the v25 global `in_progress` lookup contract.
 */
export function resolveUserSession(telegramUserId: number, events: EventRow[]): UserSession {
  const own = events.filter((event) => event.telegram_user_id === telegramUserId);
  let activeProjectId: string | null = null;
  let currentTaskId: string | null = null;

  for (const event of own) {
    const projectId = event.payload?.project_id ?? null;
    const taskId = event.payload?.task_id ?? null;
    if (!activeProjectId && projectId) activeProjectId = projectId;

    if (event.event_type === "task.done" && taskId && taskId === currentTaskId) {
      currentTaskId = null;
      continue;
    }
    if (!currentTaskId && event.event_type === "task.started" && taskId) {
      currentTaskId = taskId;
      if (projectId) activeProjectId = projectId;
    }
  }

  return {
    telegramUserId,
    activeProjectId,
    currentTaskId,
    awaitingResult: Boolean(currentTaskId),
  };
}
