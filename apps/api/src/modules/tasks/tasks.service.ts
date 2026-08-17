import type {
  RequestContext,
} from "../../bootstrap/request-context";

import {
  RbacService,
} from "../rbac/rbac.service";

import {
  TasksPermissionDeniedError,
  TasksProjectNotFoundError,
  TasksValidationError,
} from "./tasks.errors";

import type {
  TasksRepository,
} from "./tasks.repository";

import type {
  CreateTaskInput,
  Task,
  TaskCreationResult,
  TaskPriority,
} from "./tasks.types";


export class TasksService {
  constructor(
    private readonly rbacService:
      RbacService,

    private readonly repository:
      TasksRepository
  ) {}


  async createTask(
    context: RequestContext,
    input: CreateTaskInput
  ): Promise<TaskCreationResult> {
    /*
     * TasksService is the authoritative command boundary.
     *
     * Callers may request Task creation, but they do not decide:
     *
     * - who the creator is
     * - which permissions are required
     * - how values are normalized
     * - how the Task is persisted
     */
    const title =
      input.title.trim();


    if (title.length === 0) {
      throw new TasksValidationError(
        "Task title is required."
      );
    }


    const description =
      input.description === null
        ? null
        : (
            input.description.trim()
              .length === 0
              ? null
              : input.description.trim()
          );


    const priority =
      input.priority ??
      "normal";


    if (
      !this.isTaskPriority(
        priority
      )
    ) {
      throw new TasksValidationError(
        "Task priority must be low, normal, high, or critical."
      );
    }


    const assignedTo =
      input.assignedTo === null
        ? null
        : input.assignedTo.trim();


    if (
      input.assignedTo !== null &&
      assignedTo?.length === 0
    ) {
      throw new TasksValidationError(
        "Assigned user ID must not be empty."
      );
    }


    let dueDate:
      string | null =
        null;


    if (input.dueDate !== null) {
      const candidate =
        input.dueDate.trim();


      if (candidate.length === 0) {
        throw new TasksValidationError(
          "Task due date must not be empty."
        );
      }


      const timestamp =
        Date.parse(
          candidate
        );


      if (
        Number.isNaN(
          timestamp
        )
      ) {
        throw new TasksValidationError(
          "Task due date is invalid."
        );
      }


      dueDate =
        new Date(
          timestamp
        ).toISOString();
    }


    /*
     * VS001-07 supports AI proposals as the authoritative
     * creation source.
     *
     * The runtime check remains necessary because external HTTP
     * input cannot be trusted merely because TypeScript has a union.
     */
    if (
      input.source.sourceType !==
      "ai_proposal"
    ) {
      throw new TasksValidationError(
        "Unsupported task creation source."
      );
    }


    const sourceId =
      input.source.sourceId.trim();


    if (sourceId.length === 0) {
      throw new TasksValidationError(
        "Task creation source ID is required."
      );
    }


    /*
     * Resolve project membership before authorising the command.
     */
    const access =
      await this.rbacService
        .getProjectAccess(
          context.actorUserId,
          input.projectId
        );


    if (!access) {
      throw new TasksProjectNotFoundError();
    }


    /*
     * Creating an authoritative Task always requires task.create.
     */
    if (
      !access.permissions.includes(
        "task.create"
      )
    ) {
      throw new TasksPermissionDeniedError();
    }


    /*
     * Assignment is independently privileged.
     *
     * A caller who may create Tasks does not automatically gain
     * authority to assign them.
     */
    if (
      assignedTo !== null &&
      !access.permissions.includes(
        "task.assign"
      )
    ) {
      throw new TasksPermissionDeniedError();
    }


    /*
     * The authenticated human actor becomes the authoritative
     * creator. The AI proposal remains provenance, not authority.
     */
    return this.repository
      .createTask({
        projectId:
          input.projectId,

        title,

        description,

        assignedTo,

        priority,

        dueDate,

        createdByUserId:
          context.actorUserId,

        source: {
          sourceType:
            "ai_proposal",

          sourceId,
        },

        correlationId:
          input.correlationId ??
          context.correlationId,

        causationId:
          input.causationId,
      });
  }


    async listMyTasks(
      context: RequestContext
    ): Promise<Task[]> {
      /*
      * /me/tasks is self-scoped.
      *
      * The caller does not supply a user ID. The authenticated
      * RequestContext is the sole identity source.
      *
      * Repository persistence/query logic additionally limits
      * visibility to projects where this user currently holds
      * task.view.
      */
      return this.repository
        .listMyTasks(
          context.actorUserId
        );
    }
  private isTaskPriority(
    value: string
  ): value is TaskPriority {
    return (
      value === "low" ||
      value === "normal" ||
      value === "high" ||
      value === "critical"
    );
  }
}
