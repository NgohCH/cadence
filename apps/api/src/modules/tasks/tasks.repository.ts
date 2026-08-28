import type {
  PersistTaskInput,
  Task,
  TaskCreationResult,
} from "./tasks.types";


/*
 * Persistence boundary owned by the Tasks module.
 *
 * Other modules must not receive or call this repository directly.
 * They request authoritative Task operations through TasksService.
 */
export interface TasksRepository {
  createTask(
    input: PersistTaskInput
  ): Promise<TaskCreationResult>;


  /*
   * Return current actionable Tasks assigned to one Cadence user.
   *
   * This is a data-scoping boundary, not an authorization boundary.
   * Project visibility is determined by TasksService through the
   * canonical project authorization service.
   */
  listMyTasks(
    userId: string
  ): Promise<Task[]>;
}