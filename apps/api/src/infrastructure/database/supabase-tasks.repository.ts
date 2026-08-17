import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  TasksPermissionDeniedError,
  TasksValidationError,
} from "../../modules/tasks/tasks.errors";

import type {
  TasksRepository,
} from "../../modules/tasks/tasks.repository";

import type {
  PersistTaskInput,
  Task,
  TaskCreationResult,
  TaskCreatorType,
  TaskPriority,
  TaskStatus,
} from "../../modules/tasks/tasks.types";


type TaskRow = {
  task_id: string;

  project_id: string;

  title: string;

  description: string | null;

  assigned_to: string | null;

  status: TaskStatus;

  priority: TaskPriority;

  due_date: string | null;

  completed_at: string | null;

  created_by: string | null;

  created_by_type:
    TaskCreatorType;

  created_at: string;

  updated_at: string;
};


type AuthoritativeTaskRow =
  TaskRow & {
    created: boolean;
  };


export class SupabaseTasksRepository
  implements TasksRepository
{
  constructor(
    private readonly db:
      SupabaseClient
  ) {}


  async createTask(
    input: PersistTaskInput
  ): Promise<TaskCreationResult> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "create_authoritative_task",
      {
        p_project_id:
          input.projectId,

        p_title:
          input.title,

        p_description:
          input.description,

        p_assigned_to:
          input.assignedTo,

        p_priority:
          input.priority,

        p_due_date:
          input.dueDate,

        p_created_by_user_id:
          input.createdByUserId,

        p_source_type:
          input.source.sourceType,

        p_source_id:
          input.source.sourceId,

        p_correlation_id:
          input.correlationId,

        p_causation_id:
          input.causationId,
      }
    );


    if (error) {
      this.throwMappedCreateError(
        error.message
      );
    }


    const rows =
      (data ?? []) as
        AuthoritativeTaskRow[];

    const row =
      rows[0];


    if (!row) {
      throw new Error(
        "Authoritative Task creation returned no row."
      );
    }


    return {
      task:
        this.mapTaskRow(
          row
        ),

      created:
        row.created,
    };
  }


  async listMyTasks(
    userId: string
  ): Promise<Task[]> {
    const {
      data,
      error,
    } = await this.db.rpc(
      "list_my_tasks",
      {
        p_user_id:
          userId,
      }
    );


    if (error) {
      throw new Error(
        `Failed to list My Tasks: ${error.message}`
      );
    }


    const rows =
      (data ?? []) as
        TaskRow[];


    return rows.map(
      (row) =>
        this.mapTaskRow(
          row
        )
    );
  }


  private mapTaskRow(
    row: TaskRow
  ): Task {
    return {
      id:
        row.task_id,

      projectId:
        row.project_id,

      title:
        row.title,

      description:
        row.description,

      assignedTo:
        row.assigned_to,

      status:
        row.status,

      priority:
        row.priority,

      dueDate:
        row.due_date,

      completedAt:
        row.completed_at,

      createdBy:
        row.created_by,

      createdByType:
        row.created_by_type,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at,
    };
  }


  private throwMappedCreateError(
    message: string
  ): never {
    if (
      message.includes(
        "TASK_CREATE_PERMISSION_DENIED"
      ) ||
      message.includes(
        "TASK_ASSIGN_PERMISSION_DENIED"
      )
    ) {
      throw new TasksPermissionDeniedError();
    }


    if (
      message.includes(
        "TASK_REFERENCE_MISSING"
      )
    ) {
      throw new TasksValidationError(
        "Required Task creation reference is missing."
      );
    }


    if (
      message.includes(
        "TASK_TITLE_REQUIRED"
      )
    ) {
      throw new TasksValidationError(
        "Task title is required."
      );
    }


    if (
      message.includes(
        "TASK_PRIORITY_INVALID"
      )
    ) {
      throw new TasksValidationError(
        "Task priority must be low, normal, high, or critical."
      );
    }


    if (
      message.includes(
        "TASK_SOURCE_INVALID"
      )
    ) {
      throw new TasksValidationError(
        "Unsupported Task creation source."
      );
    }


    if (
      message.includes(
        "TASK_ASSIGNEE_NOT_PROJECT_MEMBER"
      )
    ) {
      throw new TasksValidationError(
        "Assigned user must be an active project member."
      );
    }


    throw new Error(
      `Failed to create authoritative Task: ${message}`
    );
  }
}