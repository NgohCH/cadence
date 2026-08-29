import type {
  RequestContext,
} from "../../bootstrap/request-context";

import type {
  EffectiveProjectAuthorisation,
} from "../project-membership/project-authorisation.types";
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


export interface TasksAuthorisationService {
  getEffectiveProjectAuthorisation(
    personId: string,
    projectId: string
  ): Promise<EffectiveProjectAuthorisation>;
}

export class TasksService {
  constructor(
    private readonly authorisationService:
      TasksAuthorisationService,

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
    const authorisation =
      await this.authorisationService
        .getEffectiveProjectAuthorisation(
          context.actorPersonId,
          input.projectId
        );


    if (
      authorisation.membershipIds.length === 0
    ) {
      throw new TasksProjectNotFoundError();
    }


    /*
     * Creating an authoritative Task always requires task.create.
     */
    if (
      !authorisation.permissions.includes(
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
      !authorisation.permissions.includes(
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
     * actorUserId determines whose Tasks are assigned.
     * actorPersonId determines project authority.
     *
     * The repository returns only current actionable Tasks
     * assigned to the authenticated Cadence user. It does not
     * decide project authorization.
     */
    const candidates =
      await this.repository
        .listMyTasks(
          context.actorUserId
        );


    if (
      candidates.length === 0
    ) {
      return [];
    }


    /*
     * Authorize once per distinct project rather than once per Task.
     *
     * ProjectAuthorisationService is the sole project permission
     * authority. Assignment alone does not grant task.view.
     */
    const projectIds =
      [
        ...new Set(
          candidates.map(
            (task) =>
              task.projectId
          )
        ),
      ];


    const decisions =
      await Promise.all(
        projectIds.map(
          async (
            projectId
          ) => {
            const authorisation =
              await this.authorisationService
                .getEffectiveProjectAuthorisation(
                  context.actorPersonId,
                  projectId
                );


            const allowed =
              authorisation
                .membershipIds
                .length > 0 &&
              authorisation
                .permissions
                .includes(
                  "task.view"
                );


            return {
              projectId,
              allowed,
            };
          }
        )
      );


    const visibleProjectIds =
      new Set(
        decisions
          .filter(
            (decision) =>
              decision.allowed
          )
          .map(
            (decision) =>
              decision.projectId
          )
      );


    return candidates.filter(
      (task) =>
        visibleProjectIds.has(
          task.projectId
        )
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
