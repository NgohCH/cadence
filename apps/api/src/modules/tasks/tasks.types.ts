export type TaskStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled";


export type TaskPriority =
  | "low"
  | "normal"
  | "high"
  | "critical";


export type TaskCreatorType =
  | "human"
  | "agent"
  | "system";


/*
 * Identifies the business source from which an authoritative Task
 * was created.
 *
 * VS001-07 initially supports AI proposals as the source.
 *
 * Keeping this as a Tasks-owned type means callers provide
 * provenance without receiving access to Tasks persistence.
 */
export interface TaskCreationSource {
  sourceType:
    "ai_proposal";

  sourceId: string;
}


/*
 * Input accepted by TasksService.
 *
 * Authorization information is intentionally not supplied here.
 * The authenticated actor comes from RequestContext.
 */
export interface CreateTaskInput {
  projectId: string;

  title: string;

  description:
    string | null;

  assignedTo:
    string | null;

  priority?:
    TaskPriority;

  dueDate:
    string | null;

  source:
    TaskCreationSource;

  /*
   * Domain event that caused this task-creation command.
   *
   * For VS001-07 this will ultimately be the human proposal-review
   * event when available.
   */
  /*
   * Optional existing business correlation to continue.
   *
   * When materializing a reviewed AI proposal, this is the
   * correlation ID of the human review event.
   *
   * Direct Task creation falls back to RequestContext.correlationId.
   */
  correlationId?:
    string;
    causationId:
    string | null;
}
/*
 * Normalized persistence command produced only by TasksService.
 *
 * The repository must never decide who the authenticated actor is
 * or which permissions are required.
 */
export interface PersistTaskInput {
  projectId: string;

  title: string;

  description:
    string | null;

  assignedTo:
    string | null;

  priority:
    TaskPriority;

  dueDate:
    string | null;

  createdByUserId:
    string;

  source:
    TaskCreationSource;

  correlationId:
    string;

  causationId:
    string | null;
}


/*
 * Authoritative Task representation owned by the Tasks module.
 */
export interface Task {
  id: string;

  projectId: string;

  title: string;

  description:
    string | null;

  assignedTo:
    string | null;

  status:
    TaskStatus;

  priority:
    TaskPriority;

  dueDate:
    string | null;

  completedAt:
    string | null;

  createdBy:
    string | null;

  createdByType:
    TaskCreatorType;

  createdAt:
    string;

  updatedAt:
    string;
}


/*
 * `created` is important for retry safety.
 *
 * false means the same authoritative Task already existed for the
 * supplied source and was returned instead of creating a duplicate.
 */
export interface TaskCreationResult {
  task: Task;

  created: boolean;
}
