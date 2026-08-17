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
   * Return the current actionable Tasks assigned to one Cadence user.
   *
   * The concrete repository is responsible for ensuring Tasks are
   * returned only from projects where the user currently has
   * task.view.
   */
  listMyTasks(
    userId: string
  ): Promise<Task[]>;
}