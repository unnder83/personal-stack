export type Folder = {
  id: number
  name: string
  parent_id: number | null
  created_at: string
  updated_at: string
}

export type StoredFile = {
  id: number
  name: string
  folder_id: number | null
  size: number
  mime_type: string
  sha256: string
  created_at: string
}

export type FolderContents = {
  folder: Folder | null
  breadcrumb: Folder[]
  folders: Folder[]
  files: StoredFile[]
}

export type StorageUsage = {
  used_bytes: number
  file_count: number
}

export type FolderTreeNode = {
  id: number
  name: string
  parent_id: number | null
  path: string
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

export async function listFolder(parentId: number | null): Promise<FolderContents> {
  const search = new URLSearchParams()
  if (parentId !== null) search.set('parent_id', String(parentId))
  return (await ensureOk(await fetch(`/api/folders?${search.toString()}`))).json()
}

export async function fetchFolderTree(): Promise<FolderTreeNode[]> {
  return (await ensureOk(await fetch('/api/folders/tree'))).json()
}

export async function createFolder(name: string, parentId: number | null): Promise<Folder> {
  const response = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parent_id: parentId }),
  })
  return (await ensureOk(response)).json()
}

export async function updateFolder(
  id: number,
  payload: { name?: string; parent_id?: number | null },
): Promise<Folder> {
  const response = await fetch(`/api/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await ensureOk(response)).json()
}

export async function deleteFolder(id: number, recursive: boolean): Promise<void> {
  await ensureOk(await fetch(`/api/folders/${id}?recursive=${recursive}`, { method: 'DELETE' }))
}

export async function uploadFile(file: File, folderId: number | null): Promise<StoredFile> {
  const form = new FormData()
  form.append('file', file)
  if (folderId !== null) form.append('folder_id', String(folderId))
  return (await ensureOk(await fetch('/api/files/upload', { method: 'POST', body: form }))).json()
}

export async function updateFile(
  id: number,
  payload: { name?: string; folder_id?: number | null },
): Promise<StoredFile> {
  const response = await fetch(`/api/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return (await ensureOk(response)).json()
}

export async function deleteFile(id: number): Promise<void> {
  await ensureOk(await fetch(`/api/files/${id}`, { method: 'DELETE' }))
}

export async function fetchUsage(): Promise<StorageUsage> {
  return (await ensureOk(await fetch('/api/storage/usage'))).json()
}

export function downloadUrl(id: number): string {
  return `/api/files/${id}/download`
}
