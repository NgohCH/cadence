export type MemberRole =
  | 'PROJECT_SPONSOR'
  | 'PROJECT_OWNER'
  | 'PROJECT_MANAGER'
  | 'PROJECT_MEMBER'
  | 'PROJECT_OBSERVER'
  | 'PROJECT_AUDITOR'

export interface ProjectMemberRow {
  membership_id: string
  person_id: string
  display_name: string
  project_id: string
  roles: MemberRole[]
  affiliation: {
    classification: 'INTERNAL' | 'EXTERNAL'
    organisation_name: string | null
    effective_from: string
    effective_to: string | null
  } | null
  effective_from: string
  effective_to: string | null
  status: 'ACTIVE' | 'ENDED'
}

export interface MembershipCapabilities {
  can_invite_member: boolean
  can_change_ordinary_role: boolean
  can_transfer_sponsor: boolean
  can_transfer_owner: boolean
  can_transfer_manager: boolean
  can_remove_member: boolean
}
