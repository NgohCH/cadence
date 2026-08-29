export interface CadenceUser {
  id: string
  display_name: string
  email: string
  status: 'active' | 'disabled'
  identity_provider: string
}
