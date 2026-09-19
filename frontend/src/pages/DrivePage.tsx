import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import type { FolderContents, FolderTreeNode, StorageUsage } from '../api/storage'
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
    <main>
      <header>
        <h1>我的网盘</h1>
        <Link to="/">返回博客</Link>
      </header>

      <p>
        已用 {formatSize(usage.used_bytes)} / {usage.file_count} 个文件
      </p>

      <nav aria-label="面包屑">
        <button onClick={() => openFolder(null)}>根目录</button>
        {contents?.breadcrumb.map((item) => (
          <button key={item.id} onClick={() => openFolder(item.id)}>
            {item.name}
          </button>
        ))}
      </nav>

      <p>
        <button onClick={handleCreateFolder}>新建文件夹</button>
        <label>
          上传文件
          <input type="file" aria-label="上传文件" onChange={handleUpload} />
        </label>
      </p>

      {loading && <p>加载中...</p>}
      {error !== '' && <p role="alert">{error}</p>}
      {!loading && contents && contents.folders.length === 0 && contents.files.length === 0 && (
        <p>空目录</p>
      )}

      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>大小</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {contents?.folders.map((folder) => (
            <tr key={`folder-${folder.id}`}>
              <td>
                <button onClick={() => openFolder(folder.id)}>{folder.name}</button>
              </td>
              <td>—</td>
              <td>
                <button onClick={() => handleRenameFolder(folder.id, folder.name)}>重命名</button>
                <button onClick={() => handleMoveFolder(folder.id)}>移动</button>
                <button onClick={() => handleDeleteFolder(folder.id, folder.name)}>
                  删除文件夹 {folder.name}
                </button>
              </td>
            </tr>
          ))}
          {contents?.files.map((file) => (
            <tr key={`file-${file.id}`}>
              <td>
                <a href={downloadUrl(file.id)}>{file.name}</a>
              </td>
              <td>{formatSize(file.size)}</td>
              <td>
                <button onClick={() => handleRenameFile(file.id, file.name)}>重命名</button>
                <button onClick={() => handleMoveFile(file.id)}>移动</button>
                <button onClick={() => handleDeleteFile(file.id, file.name)}>
                  删除 {file.name}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
