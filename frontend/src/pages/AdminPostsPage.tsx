import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { deletePost, listAdminPosts } from '../api/blog'
import type { PostAdminSummary } from '../api/blog'
import { AdminHeader } from '../components/AdminHeader'

export default function AdminPostsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status')
  const [posts, setPosts] = useState<PostAdminSummary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAdminPosts({ status: status ?? undefined })
      .then((data) => {
        if (!cancelled) setPosts(data.items)
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
  }, [status, reloadKey])

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
  }

  return (
    <main>
      <AdminHeader />
      <h1>文章管理</h1>
      <p>
        <Link to="/admin/posts/new">新建文章</Link>
        <button onClick={() => selectStatus(null)} disabled={status === null}>
          全部
        </button>
        <button onClick={() => selectStatus('draft')} disabled={status === 'draft'}>
          草稿
        </button>
        <button onClick={() => selectStatus('published')} disabled={status === 'published'}>
          已发布
        </button>
      </p>
      {loading && <p>加载中...</p>}
      {error !== '' && <p role="alert">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>状态</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <td>{post.title}</td>
              <td>{post.status === 'published' ? '已发布' : '草稿'}</td>
              <td>{post.updated_at.slice(0, 10)}</td>
              <td>
                <Link to={`/admin/posts/${post.id}/edit`}>编辑</Link>
                <button onClick={() => handleDelete(post.id)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && posts.length === 0 && <p>暂无文章</p>}
    </main>
  )
}
