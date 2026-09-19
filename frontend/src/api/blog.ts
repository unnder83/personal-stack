export type Tag = {
  id: number
  name: string
  slug: string
}

export type PostSummary = {
  id: number
  title: string
  slug: string
  summary: string | null
  published_at: string | null
  tags: Tag[]
}

export type PostDetail = PostSummary & {
  content_md: string
  status: string
  created_at: string
  updated_at: string
}

export type PostListResponse = {
  items: PostSummary[]
  total: number
  page: number
  page_size: number
}

async function ensureOk(response: Response): Promise<Response> {
  if (!response.ok) {
    let message = `请求失败（HTTP ${response.status}）`
    try {
      const data = await response.json()
      if (typeof data?.message === 'string') {
        message = data.message
      }
    } catch {
      // 非 JSON 响应
    }
    throw new Error(message)
  }
  return response
}

export async function listPosts(params: {
  tag?: string
  page?: number
  pageSize?: number
}): Promise<PostListResponse> {
  const search = new URLSearchParams()
  if (params.tag) search.set('tag', params.tag)
  search.set('page', String(params.page ?? 1))
  search.set('page_size', String(params.pageSize ?? 20))
  return (await ensureOk(await fetch(`/api/posts?${search.toString()}`))).json()
}

export async function getPost(slug: string): Promise<PostDetail> {
  return (await ensureOk(await fetch(`/api/posts/${encodeURIComponent(slug)}`))).json()
}

export async function listTags(): Promise<Tag[]> {
  return (await ensureOk(await fetch('/api/tags'))).json()
}

export type PostInputPayload = {
  title: string
  slug: string | null
  summary: string | null
  content_md: string
  status: 'draft' | 'published'
  tags: string[]
}

export type PostAdminSummary = {
  id: number
  title: string
  slug: string
  status: string
  published_at: string | null
  updated_at: string
}

export type PostAdminListResponse = {
  items: PostAdminSummary[]
  total: number
  page: number
  page_size: number
}

export async function listAdminPosts(params: {
  status?: string
  page?: number
}): Promise<PostAdminListResponse> {
  const search = new URLSearchParams()
  if (params.status) search.set('status', params.status)
  search.set('page', String(params.page ?? 1))
  return (await ensureOk(await fetch(`/api/admin/posts?${search.toString()}`))).json()
}

export async function getAdminPost(id: number): Promise<PostDetail> {
  return (await ensureOk(await fetch(`/api/admin/posts/${id}`))).json()
}

export async function createPost(payload: PostInputPayload): Promise<PostDetail> {
  const response = await fetch('/api/admin/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await ensureOk(response)).json()
}

export async function updatePost(id: number, payload: PostInputPayload): Promise<PostDetail> {
  const response = await fetch(`/api/admin/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await ensureOk(response)).json()
}

export async function deletePost(id: number): Promise<void> {
  await ensureOk(await fetch(`/api/admin/posts/${id}`, { method: 'DELETE' }))
}
