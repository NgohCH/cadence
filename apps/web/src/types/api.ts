export interface ApiMeta {
  correlation_id: string
  request_id: string
  next_cursor: string | null
}

export interface ApiSuccess<T> {
  success: true
  data: T
  meta: ApiMeta
}
