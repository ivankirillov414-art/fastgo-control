export type Intent = "next" | "result" | "create_project" | "list_projects" | "command" | "freeform";

export type ConversationState = {
  activeProjectId?: string | null;
  currentTaskId?: string | null;
  awaitingResult?: boolean;
};

const normalized = (text: string) => text.toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ").trim();

export function routeTelegramMessage(text: string, state: ConversationState): Intent {
  const value = normalized(text);
  if (value.startsWith("/")) return "command";
  if (["проекты", "мои проекты", "покажи проекты"].includes(value)) return "list_projects";
  if (/(создай проект|создать проект|новый проект)/u.test(value)) return "create_project";
  if (/(что дальше|что теперь|дальше|следующ|что делать)/u.test(value)) return "next";
  if (state.awaitingResult && state.currentTaskId) return "result";
  return "freeform";
}

// Production contract:
// 1. `next` resolves explicit project, then user's recent project.
// 2. selected task becomes `in_progress` before it is shown to the user.
// 3. while a task is in progress, a normal freeform reply is its result.
// 4. result closes exactly that task and writes Keeper memory + task.done event.
// 5. commands/project creation/project listing are never consumed as results.
