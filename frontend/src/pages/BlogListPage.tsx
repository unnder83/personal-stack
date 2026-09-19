import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { listPosts, listTags } from '../api/blog'
import type { PostSummary, Tag } from '../api/blog'

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
    <main>
      <header>
        <h1>personal-stack 博客</h1>
        <Link to="/admin/posts">管理后台</Link>
      </header>

      <nav>
        <button onClick={() => selectTag(null)} disabled={tag === null}>
          全部
        </button>
        {tags.map((item) => (
          <button key={item.slug} onClick={() => selectTag(item.slug)} disabled={tag === item.slug}>
            {item.name}
          </button>
        ))}
      </nav>

      {loading && <p>加载中...</p>}
      {error !== '' && <p role="alert">{error}</p>}
      {!loading && posts.length === 0 && <p>还没有发布文章</p>}

      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h2>
              <Link to={`/posts/${post.slug}`}>{post.title}</Link>
            </h2>
            {post.published_at && <time>{post.published_at.slice(0, 10)}</time>}
            {post.summary && <p>{post.summary}</p>}
            <p>
              {post.tags.map((item) => (
                <Link key={item.slug} to={`/?tag=${item.slug}`}>
                  {item.name}
                </Link>
              ))}
            </p>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <footer>
          <button onClick={() => gotoPage(page - 1)} disabled={page <= 1}>
            上一页
          </button>
          <span>
            第 {page} / {totalPages} 页
          </span>
          <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages}>
            下一页
          </button>
        </footer>
      )}
    </main>
  )
}
