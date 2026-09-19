import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { createPost, getAdminPost, updatePost } from '../api/blog'
import type { PostInputPayload } from '../api/blog'
import { AdminHeader } from '../components/AdminHeader'
import { MarkdownEditor } from '../components/MarkdownEditor'

type FormState = {
  title: string
  slug: string
  summary: string
  tags: string
  status: 'draft' | 'published'
  content_md: string
}

const EMPTY: FormState = {
  title: '',
  slug: '',
  summary: '',
  tags: '',
  status: 'draft',
  content_md: '',
}

export default function PostFormPage() {
  const { id } = useParams()
  const postId = id === undefined ? null : Number(id)
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(postId !== null)

  useEffect(() => {
    if (postId === null) return
    let cancelled = false
    setLoading(true)
    getAdminPost(postId)
      .then((post) => {
        if (cancelled) return
        setForm({
          title: post.title,
          slug: post.slug,
          summary: post.summary ?? '',
          tags: post.tags.map((tag) => tag.name).join(', '),
          status: post.status === 'published' ? 'published' : 'draft',
          content_md: post.content_md,
        })
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
  }, [postId])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const payload: PostInputPayload = {
      title: form.title,
      slug: form.slug.trim() === '' ? null : form.slug.trim(),
      summary: form.summary.trim() === '' ? null : form.summary.trim(),
      content_md: form.content_md,
      status: form.status,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
    }
    try {
      if (postId === null) {
        await createPost(payload)
      } else {
        await updatePost(postId, payload)
      }
      navigate('/admin/posts')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  if (loading) return <p>加载中...</p>

  return (
    <main>
      <AdminHeader />
      <h1>{postId === null ? '新建文章' : '编辑文章'}</h1>
      {error !== '' && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          标题
          <input value={form.title} onChange={(e) => update('title', e.target.value)} />
        </label>
        <label>
          slug（留空自动生成）
          <input value={form.slug} onChange={(e) => update('slug', e.target.value)} />
        </label>
        <label>
          摘要
          <input value={form.summary} onChange={(e) => update('summary', e.target.value)} />
        </label>
        <label>
          标签（逗号分隔）
          <input value={form.tags} onChange={(e) => update('tags', e.target.value)} />
        </label>
        <label>
          状态
          <select
            value={form.status}
            onChange={(e) => update('status', e.target.value as FormState['status'])}
          >
            <option value="draft">草稿</option>
            <option value="published">发布</option>
          </select>
        </label>
        <MarkdownEditor
          value={form.content_md}
          onChange={(value) => update('content_md', value)}
        />
        <button type="submit">保存</button>
      </form>
    </main>
  )
}
