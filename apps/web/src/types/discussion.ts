export interface DiscussionMessage {
  id: string
  project_id: string
  author_user_id: string | null
  author_type: 'human' | 'agent' | 'system'
  thread_parent_id: string | null
  current_version: number
  content: string
  created_at: string
  edited_at: string | null
}