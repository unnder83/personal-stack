import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getPost } from '../api/blog'
import type { PostDetail } from '../api/blog'
import { MarkdownView } from '../components/MarkdownView'

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

  if (loading) return <p>加载中...</p>
  if (error !== '' || post === null) return <p role="alert">{error || '文章不存在'}</p>

  return (
    <main>
      <p>
        <Link to="/">← 返回列表</Link>
      </p>
      <h1>{post.title}</h1>
      {post.published_at && <time>{post.published_at.slice(0, 10)}</time>}
      <p>
        {post.tags.map((tag) => (
          <Link key={tag.slug} to={`/?tag=${encodeURIComponent(tag.slug)}`}>
            {tag.name}
          </Link>
        ))}
      </p>
      <MarkdownView content={post.content_md} />
    </main>
  )
}
