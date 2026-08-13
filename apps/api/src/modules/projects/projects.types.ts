export type ProjectLifecycleStatus =
  | "draft"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled";

export type ProjectHealthStatus =
  | "on_track"
  | "at_risk"
  | "delayed"
  | "blocked";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;

  lifecycleStatus: ProjectLifecycleStatus;
  healthStatus: ProjectHealthStatus;
  progressPercent: number;

  ownerUserId: string | null;

  startDate: string | null;
  targetDate: string | null;

  createdAt: string;
  updatedAt: string;
}

export type MilestoneStatus =
  | "upcoming"
  | "due_soon"
  | "slipped"
  | "completed";

export interface Milestone {
  id: string;
  projectId: string;

  title: string;
  description: string | null;

  ownerUserId: string | null;

  targetDate: string;
  status: MilestoneStatus;

  completedAt: string | null;
}

export type AlertSeverity =
  | "info"
  | "warning"
  | "critical";

export interface ProjectAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  dismissible: boolean;
}

export interface ProjectTaskCounts {
  pending: number;
  overdue: number;
}

export interface ProjectSummary {
  project: Project;

  myTasks: ProjectTaskCounts;

  blockers: number;

  nextMilestone: Milestone | null;

  alerts: ProjectAlert[];
}