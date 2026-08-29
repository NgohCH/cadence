export type ProjectLifecycleStatus =
  | 'draft'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled'

export type ProjectHealthStatus =
  | 'on_track'
  | 'at_risk'
  | 'delayed'
  | 'blocked'

export type MilestoneStatus =
  | 'upcoming'
  | 'due_soon'
  | 'slipped'
  | 'completed'

export type AlertSeverity =
  | 'info'
  | 'warning'
  | 'critical'

export interface ProjectSummaryResponse {
  project: {
    id: string
    name: string
    description: string | null
    goal: string | null
    lifecycle_status: ProjectLifecycleStatus
    health_status: ProjectHealthStatus
    progress_percent: number
    owner_user_id: string | null
    start_date: string | null
    target_date: string | null
    created_at: string
    updated_at: string
  }

  my_tasks: {
    pending: number
    overdue: number
  }

  blockers: number

  next_milestone: {
    id: string
    project_id: string
    title: string
    description: string | null
    owner_user_id: string | null
    target_date: string
    status: MilestoneStatus
    completed_at: string | null
  } | null

  alerts: {
    id: string
    severity: AlertSeverity
    title: string
    message: string
    dismissible: boolean
  }[]
}