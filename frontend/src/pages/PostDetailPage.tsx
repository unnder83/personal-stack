import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getPost } from '../api/blog'
import type { PostDetail } from '../api/blog'
import { MarkdownView } from '../components/MarkdownView'
import { AppShell } from '../components/ui/AppShell'
import { Surface } from '../components/ui/Surface'

export default function PostDetailPage() {
  const { slug = '' } = useParams()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPost(slug)
      .then((data) => {
        if (!cancelled) {
          setPost(data)
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
  }, [slug])

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted">加载中...</p>
      </AppShell>
    )
  }
  if (error !== '' || post === null) {
    return (
      <AppShell>
        <p role="alert" className="text-accent-text">
          {error || '文章不存在'}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <article className="space-y-6">
        <Link to="/blog" className="text-sm text-muted hover:text-fg">
          ← 返回列表
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
          {post.published_at && (
            <time className="text-xs text-muted">{post.published_at.slice(0, 10)}</time>
          )}
          <p className="flex gap-3 text-xs">
            {post.tags.map((tag) => (
              <Link
                key={tag.slug}
                to={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                className="text-accent-text hover:opacity-80"
              >
                {tag.name}
              </Link>
            ))}
          </p>
        </header>
        <Surface className="p-6 md:p-8">
          <MarkdownView content={post.content_md} />
        </Surface>
      </article>
    </AppShell>
  )
}
