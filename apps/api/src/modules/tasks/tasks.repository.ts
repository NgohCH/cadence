import type {
  PersistTaskInput,
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
}
