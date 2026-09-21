import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { listAdminPosts } from '../api/blog'
import { fetchUsage } from '../api/storage'
import { useAuth } from '../auth/AuthContext'
import { AppShell } from '../components/ui/AppShell'
import { Surface } from '../components/ui/Surface'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function ConsolePage() {
  const { user } = useAuth()
  const [postCount, setPostCount] = useState<number | null>(null)
  const [fileCount, setFileCount] = useState<number | null>(null)
  const [usedBytes, setUsedBytes] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    listAdminPosts({})
      .then((data) => {
        if (!cancelled) setPostCount(data.total)
      })
      .catch(() => undefined)
    fetchUsage()
      .then((usage) => {
        if (cancelled) return
        setFileCount(usage.file_count)
        setUsedBytes(usage.used_bytes)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <AppShell>
      <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">你好，{user?.username}</h1>
        <p className="mt-1 text-sm text-muted">欢迎回到 personal-stack</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Surface className="p-5">
          <p className="text-sm text-muted">文章</p>
          <p className="mt-2 text-3xl font-semibold">{postCount ?? '—'}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-sm text-muted">文件</p>
          <p className="mt-2 text-3xl font-semibold">{fileCount ?? '—'}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-sm text-muted">已用空间</p>
          <p className="mt-2 text-3xl font-semibold">
            {usedBytes === null ? '—' : formatSize(usedBytes)}
          </p>
        </Surface>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/admin/posts" className="block">
          <Surface className="h-full p-6 transition-opacity hover:opacity-90">
            <h2 className="text-lg font-semibold">博客管理</h2>
            <p className="mt-2 text-sm text-muted">写文章、管理标签与草稿</p>
          </Surface>
        </Link>
        <Link to="/drive" className="block">
          <Surface className="h-full p-6 transition-opacity hover:opacity-90">
            <h2 className="text-lg font-semibold">我的网盘</h2>
            <p className="mt-2 text-sm text-muted">上传、下载与管理文件</p>
          </Surface>
        </Link>
      </div>
      </section>
    </AppShell>
  )
}
