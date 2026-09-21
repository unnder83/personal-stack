import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { listPosts, listTags } from '../api/blog'
import type { PostSummary, Tag } from '../api/blog'
import { AppShell } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Surface } from '../components/ui/Surface'

const PAGE_SIZE = 20

export default function BlogListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tag = searchParams.get('tag')
  const page = Number(searchParams.get('page') ?? '1')
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [total, setTotal] = useState(0)
  const [tags, setTags] = useState<Tag[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([listPosts({ tag: tag ?? undefined, page, pageSize: PAGE_SIZE }), listTags()])
      .then(([postPage, tagList]) => {
        if (cancelled) return
        setPosts(postPage.items)
        setTotal(postPage.total)
        setTags(tagList)
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
  }, [tag, page])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function selectTag(next: string | null) {
    const params = new URLSearchParams()
    if (next) params.set('tag', next)
    setSearchParams(params)
  }

  function gotoPage(next: number) {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(next))
    setSearchParams(params)
  }

  return (
    <AppShell>
      <section className="space-y-6">
        <header className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">博客</h1>
          <nav className="flex flex-wrap gap-2">
            <Button onClick={() => selectTag(null)} disabled={tag === null}>
              全部
            </Button>
            {tags.map((item) => (
              <Button
                key={item.slug}
                onClick={() => selectTag(item.slug)}
                disabled={tag === item.slug}
              >
                {item.name}
              </Button>
            ))}
          </nav>
        </header>

        {loading && <p className="text-muted">加载中...</p>}
        {error !== '' && (
          <p role="alert" className="text-accent">
            {error}
          </p>
        )}
        {!loading && posts.length === 0 && <p className="text-muted">还没有发布文章</p>}

        <div className="grid gap-4">
          {posts.map((post) => (
            <Surface key={post.id} className="p-6">
              <h2 className="text-lg font-semibold">
                <Link to={`/posts/${post.slug}`} className="hover:text-accent">
                  {post.title}
                </Link>
              </h2>
              {post.published_at && (
                <time className="mt-1 block text-xs text-muted">
                  {post.published_at.slice(0, 10)}
                </time>
              )}
              {post.summary && <p className="mt-3 text-sm text-muted">{post.summary}</p>}
              <p className="mt-3 flex gap-3 text-xs">
                {post.tags.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/?tag=${encodeURIComponent(item.slug)}`}
                    className="text-accent hover:opacity-80"
                  >
                    {item.name}
                  </Link>
                ))}
              </p>
            </Surface>
          ))}
        </div>

        {totalPages > 1 && (
          <footer className="flex items-center justify-center gap-4 text-sm">
            <Button onClick={() => gotoPage(page - 1)} disabled={page <= 1}>
              上一页
            </Button>
            <span className="text-muted">
              第 {page} / {totalPages} 页
            </span>
            <Button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages}>
              下一页
            </Button>
          </footer>
        )}
      </section>
    </AppShell>
  )
}
