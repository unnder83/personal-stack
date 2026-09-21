import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { FolderContents, FolderTreeNode, StorageUsage } from '../api/storage'
import { AppShell } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Surface } from '../components/ui/Surface'
import {
  createFolder,
  deleteFile,
  deleteFolder,
  downloadUrl,
  fetchFolderTree,
  fetchUsage,
  listFolder,
  updateFile,
  updateFolder,
  uploadFile,
} from '../api/storage'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function DrivePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const folderParam = searchParams.get('folder')
  const currentFolderId = folderParam === null ? null : Number(folderParam)
  const [contents, setContents] = useState<FolderContents | null>(null)
  const [tree, setTree] = useState<FolderTreeNode[]>([])
  const [usage, setUsage] = useState<StorageUsage>({ used_bytes: 0, file_count: 0 })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listFolder(currentFolderId), fetchFolderTree(), fetchUsage()])
      .then(([folderContents, folderTree, storageUsage]) => {
        if (cancelled) return
        setContents(folderContents)
        setTree(folderTree)
        setUsage(storageUsage)
        setError('')
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentFolderId, reloadKey])

  function reload() {
    setReloadKey((key) => key + 1)
  }

  function openFolder(id: number | null) {
    const params = new URLSearchParams()
    if (id !== null) params.set('folder', String(id))
    setSearchParams(params)
  }

  async function handleCreateFolder() {
    const name = window.prompt('文件夹名称')
    if (!name) return
    try {
      await createFolder(name, currentFolderId)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      await uploadFile(file, currentFolderId)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      event.target.value = ''
    }
  }

  async function handleRenameFolder(id: number, currentName: string) {
    const name = window.prompt('新的文件夹名', currentName)
    if (!name || name === currentName) return
    try {
      await updateFolder(id, { name })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败')
    }
  }

  async function handleMoveFolder(id: number) {
    const options = tree.map((node) => `${node.id}: ${node.path}`).join('\n')
    const answer = window.prompt(`输入目标文件夹 ID（留空表示根目录）：\n${options}`)
    if (answer === null) return
    const target = answer.trim() === '' ? null : Number(answer)
    if (target !== null && Number.isNaN(target)) return
    try {
      await updateFolder(id, { parent_id: target })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '移动失败')
    }
  }

  async function handleDeleteFolder(id: number, name: string) {
    if (!window.confirm(`删除文件夹「${name}」？其中的内容也会被删除。`)) return
    try {
      await deleteFolder(id, true)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  async function handleRenameFile(id: number, currentName: string) {
    const name = window.prompt('新的文件名', currentName)
    if (!name || name === currentName) return
    try {
      await updateFile(id, { name })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败')
    }
  }

  async function handleMoveFile(id: number) {
    const options = tree.map((node) => `${node.id}: ${node.path}`).join('\n')
    const answer = window.prompt(`输入目标文件夹 ID（留空表示根目录）：\n${options}`)
    if (answer === null) return
    const target = answer.trim() === '' ? null : Number(answer)
    if (target !== null && Number.isNaN(target)) return
    try {
      await updateFile(id, { folder_id: target })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '移动失败')
    }
  }

  async function handleDeleteFile(id: number, name: string) {
    if (!window.confirm(`删除文件「${name}」？`)) return
    try {
      await deleteFile(id)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">我的网盘</h1>
          <p className="text-sm text-muted">
            已用 {formatSize(usage.used_bytes)} / {usage.file_count} 个文件
          </p>
        </header>

        <nav aria-label="面包屑" className="flex flex-wrap gap-2">
          <Button onClick={() => openFolder(null)}>根目录</Button>
          {contents?.breadcrumb.map((item) => (
            <Button key={item.id} onClick={() => openFolder(item.id)}>
              {item.name}
            </Button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="primary" onClick={handleCreateFolder}>
            新建文件夹
          </Button>
          <label className="flex items-center gap-2 text-muted">
            上传文件
            <input type="file" aria-label="上传文件" onChange={handleUpload} />
          </label>
        </div>

        {loading && <p className="text-muted">加载中...</p>}
        {error !== '' && (
          <p role="alert" className="text-accent">
            {error}
          </p>
        )}
        {!loading &&
          contents &&
          contents.folders.length === 0 &&
          contents.files.length === 0 && <p className="text-muted">空目录</p>}

        <Surface className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">名称</th>
                <th className="px-4 py-3 font-medium">大小</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {contents?.folders.map((folder) => (
                <tr key={`folder-${folder.id}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openFolder(folder.id)}
                      className="hover:text-accent"
                    >
                      {folder.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted">—</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleRenameFolder(folder.id, folder.name)}>
                        重命名
                      </Button>
                      <Button onClick={() => handleMoveFolder(folder.id)}>移动</Button>
                      <Button onClick={() => handleDeleteFolder(folder.id, folder.name)}>
                        删除文件夹 {folder.name}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {contents?.files.map((file) => (
                <tr key={`file-${file.id}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <a href={downloadUrl(file.id)} className="text-accent hover:opacity-80">
                      {file.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatSize(file.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => handleRenameFile(file.id, file.name)}>
                        重命名
                      </Button>
                      <Button onClick={() => handleMoveFile(file.id)}>移动</Button>
                      <Button onClick={() => handleDeleteFile(file.id, file.name)}>
                        删除 {file.name}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </section>
    </AppShell>
  )
}
