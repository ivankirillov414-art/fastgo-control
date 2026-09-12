import { resolveUserSession } from "./user_scoped_session.ts";

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

const events = [
  { telegram_user_id: 101, event_type: "task.started", payload: { project_id: "arm", task_id: "measure" } },
  { telegram_user_id: 202, event_type: "task.started", payload: { project_id: "robot", task_id: "photo" } },
];

const first = resolveUserSession(101, events);
const second = resolveUserSession(202, events);
assert(first.activeProjectId === "arm", "user 101 project leaked");
assert(first.currentTaskId === "measure", "user 101 task leaked");
assert(second.activeProjectId === "robot", "user 202 project leaked");
assert(second.currentTaskId === "photo", "user 202 task leaked");

const completed = resolveUserSession(101, [
  { telegram_user_id: 101, event_type: "task.done", payload: { project_id: "arm", task_id: "measure" } },
  { telegram_user_id: 101, event_type: "task.started", payload: { project_id: "arm", task_id: "measure" } },
]);
assert(completed.activeProjectId === "arm", "project continuity lost after completion");
assert(completed.currentTaskId === null, "completed task still awaits result");
assert(completed.awaitingResult === false, "completed session still waiting");
