import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { deletePost, listAdminPosts } from '../api/blog'
import type { PostAdminSummary } from '../api/blog'
import { AppShell } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Surface } from '../components/ui/Surface'

export default function AdminPostsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status')
  const [posts, setPosts] = useState<PostAdminSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAdminPosts({ status: status ?? undefined, page })
      .then((data) => {
        if (!cancelled) {
          setPosts(data.items)
          setTotal(data.total)
          setError('')
        }
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
  }, [status, page, reloadKey])

  async function handleDelete(id: number) {
    try {
      await deletePost(id)
      setError('')
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  function selectStatus(next: string | null) {
    const params = new URLSearchParams()
    if (next) params.set('status', next)
    setSearchParams(params)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">文章管理</h1>
          <Link to="/admin/posts/new">
            <Button variant="primary">新建文章</Button>
          </Link>
        </header>

        <nav className="flex flex-wrap gap-2">
          <Button onClick={() => selectStatus(null)} disabled={status === null}>
            全部
          </Button>
          <Button onClick={() => selectStatus('draft')} disabled={status === 'draft'}>
            草稿
          </Button>
          <Button
            onClick={() => selectStatus('published')}
            disabled={status === 'published'}
          >
            已发布
          </Button>
        </nav>

        {loading && <p className="text-muted">加载中...</p>}
        {error !== '' && (
          <p role="alert" className="text-accent">
            {error}
          </p>
        )}
        {!loading && posts.length === 0 && <p className="text-muted">暂无文章</p>}

        <Surface className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">标题</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">更新时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{post.title}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-card border border-border px-2 py-0.5 text-xs text-muted">
                      {post.status === 'published' ? '已发布' : '草稿'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{post.updated_at.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link
                        to={`/admin/posts/${post.id}/edit`}
                        className="text-accent hover:opacity-80"
                      >
                        编辑
                      </Link>
                      <Button onClick={() => handleDelete(post.id)}>删除</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>

        {totalPages > 1 && (
          <footer className="flex items-center justify-center gap-4 text-sm">
            <Button onClick={() => setPage(page - 1)} disabled={page <= 1}>
              上一页
            </Button>
            <span className="text-muted">
              第 {page} / {totalPages} 页
            </span>
            <Button onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              下一页
            </Button>
          </footer>
        )}
      </section>
    </AppShell>
  )
}
