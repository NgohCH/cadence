export type TaskStatus =
  | 'open'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type TaskPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'critical'

export type TaskCreatorType =
  | 'human'
  | 'agent'
  | 'system'

export interface MyTask {
  id: string
  project_id: string
  title: string
  description: string | null
  assigned_to: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  created_by: string | null
  created_by_type: TaskCreatorType
  created_at: string
  updated_at: string
}

export interface MyTasksResponse {
  tasks: MyTask[]
}