import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProjectWorkspaceReadRepository,
} from "../../modules/projects/projects.repository";

import type {
  Milestone,
  Project,
  ProjectAlert,
  ProjectSummary,
  ProjectTaskCounts,
} from "../../modules/projects/projects.types";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  lifecycle_status: Project["lifecycleStatus"];
  progress_percent: number;
  owner_user_id: string;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectHealthRow = {
  health_status: Project["healthStatus"];
};

type MilestoneRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  owner_user_id: string | null;
  target_date: string;
  status: Milestone["status"];
  completed_at: string | null;
};

type AlertRow = {
  id: string;
  severity: ProjectAlert["severity"];
  title: string;
  message: string;
  dismissible: boolean;
};

export class SupabaseProjectsRepository
  implements ProjectWorkspaceReadRepository
{
  constructor(
    private readonly db: SupabaseClient
  ) {}

  async getSummary(
    projectId: string,
    userId: string
  ): Promise<ProjectSummary | null> {
    const project =
      await this.getProject(projectId);

    if (!project) {
      return null;
    }

    const healthStatus =
      await this.getProjectHealth(
        projectId
      );

    const myTasks =
      await this.getMyTaskCounts(
        projectId,
        userId
      );

    const blockers =
      await this.getActiveBlockerCount(
        projectId
      );

    const nextMilestone =
      await this.getNextMilestone(
        projectId
      );

    const alerts =
      await this.getAlerts(
        projectId,
        userId
      );

    return {
      project: {
        ...project,
        healthStatus,
      },
      myTasks,
      blockers,
      nextMilestone,
      alerts,
    };
  }

  private async getProject(
    projectId: string
  ): Promise<Omit<Project, "healthStatus"> | null> {
    const {
      data,
      error,
    } = await this.db
      .from("projects")
      .select(`
        id,
        name,
        description,
        goal,
        lifecycle_status,
        progress_percent,
        owner_user_id,
        start_date,
        target_date,
        created_at,
        updated_at
      `)
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const row = data as ProjectRow;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      goal: row.goal,
      lifecycleStatus: row.lifecycle_status,
      progressPercent: row.progress_percent,
      ownerUserId: row.owner_user_id,
      startDate: row.start_date,
      targetDate: row.target_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async getProjectHealth(
    projectId: string
  ): Promise<Project["healthStatus"]> {
    const {
      data,
      error,
    } = await this.db
      .from("project_health")
      .select("health_status")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Project health state not found."
      );
    }

    const row =
      data as ProjectHealthRow;

    return row.health_status;
  }

  private async getMyTaskCounts(
    projectId: string,
    userId: string
  ): Promise<ProjectTaskCounts> {
    const {
      count: pendingCount,
      error: pendingError,
    } = await this.db
      .from("tasks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("project_id", projectId)
      .eq("assigned_to", userId)
      .in("status", [
        "open",
        "in_progress",
      ]);

    if (pendingError) {
      throw pendingError;
    }

    const now =
      new Date().toISOString();

    const {
      count: overdueCount,
      error: overdueError,
    } = await this.db
      .from("tasks")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("project_id", projectId)
      .eq("assigned_to", userId)
      .in("status", [
        "open",
        "in_progress",
      ])
      .not("due_date", "is", null)
      .lt("due_date", now);

    if (overdueError) {
      throw overdueError;
    }

    return {
      pending: pendingCount ?? 0,
      overdue: overdueCount ?? 0,
    };
  }

  private async getActiveBlockerCount(
    projectId: string
  ): Promise<number> {
    const {
      count,
      error,
    } = await this.db
      .from("blockers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("project_id", projectId)
      .in("status", [
        "open",
        "monitoring",
      ]);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  private async getNextMilestone(
    projectId: string
  ): Promise<Milestone | null> {
    const {
      data,
      error,
    } = await this.db
      .from("milestones")
      .select(`
        id,
        project_id,
        title,
        description,
        owner_user_id,
        target_date,
        status,
        completed_at
      `)
      .eq("project_id", projectId)
      .neq("status", "completed")
      .not("target_date", "is", null)
      .order("target_date", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const row =
      data as MilestoneRow;

    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      ownerUserId: row.owner_user_id,
      targetDate: row.target_date,
      status: row.status,
      completedAt: row.completed_at,
    };
  }

  private async getAlerts(
    projectId: string,
    userId: string
  ): Promise<ProjectAlert[]> {
    const now =
      new Date().toISOString();

    const {
      data,
      error,
    } = await this.db
      .from("alerts")
      .select(`
        id,
        severity,
        title,
        message,
        dismissible
      `)
      .eq("project_id", projectId)
      .is("dismissed_at", null)
      .lte("starts_at", now)
      .or(
        `expires_at.is.null,expires_at.gt.${now}`
      )
      .or(
        `user_id.is.null,user_id.eq.${userId}`
      );

    if (error) {
      throw error;
    }

    const rows =
      (data ?? []) as AlertRow[];

    return rows.map(
      (row) => ({
        id: row.id,
        severity: row.severity,
        title: row.title,
        message: row.message,
        dismissible: row.dismissible,
      })
    );
  }
}