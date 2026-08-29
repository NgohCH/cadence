import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../../lib/api'
import type { ApiSuccess } from '../../types/api'
import type { MembershipCapabilities, ProjectMemberRow } from '../../types/members'

export interface MemberCandidate {
  person_id: string
  display_name: string
  affiliation: { classification: 'INTERNAL' | 'EXTERNAL'; organisation_name: string | null } | null
}

export function useProjectMembers(projectId: string) {
  const [members, setMembers] = useState<ProjectMemberRow[]>([])
  const [capabilities, setCapabilities] = useState<MembershipCapabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true); setError(null)
    void apiFetch<ApiSuccess<{ members: ProjectMemberRow[]; capabilities: MembershipCapabilities }>>(`/api/v1/projects/${projectId}/members`)
      .then((response) => { if (active) { setMembers(response.data.members); setCapabilities(response.data.capabilities) } })
      .catch((cause: unknown) => { if (active) { setMembers([]); setCapabilities(null); setError(cause instanceof Error ? cause.message : 'Unable to load project members.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, version])
  const refresh = useCallback(() => setVersion((value) => value + 1), [])
  const searchCandidates = useCallback(async (query: string) => {
    if (query.trim().length < 2) return []
    const response = await apiFetch<ApiSuccess<{ candidates: MemberCandidate[] }>>(`/api/v1/projects/${projectId}/member-candidates?query=${encodeURIComponent(query.trim())}`)
    return response.data.candidates
  }, [projectId])
  return { members, capabilities, loading, error, refresh, searchCandidates }
}
