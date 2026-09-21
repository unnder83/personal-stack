import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { createPost, getAdminPost, updatePost } from '../api/blog'
import type { PostInputPayload } from '../api/blog'
import { MarkdownEditor } from '../components/MarkdownEditor'
import { AppShell } from '../components/ui/AppShell'
import { Button } from '../components/ui/Button'
import { Surface } from '../components/ui/Surface'

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

  if (loading) {
    return (
      <AppShell>
        <p className="text-muted">加载中...</p>
      </AppShell>
    )
  }

  const inputClass =
    'mt-1 w-full rounded-card border border-border bg-bg/40 px-3 py-2 text-fg outline-none focus:border-accent'

  return (
    <AppShell>
      <Surface className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-semibold">
          {postId === null ? '新建文章' : '编辑文章'}
        </h1>
        {error !== '' && (
          <p role="alert" className="mb-4 text-sm text-accent-text">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-muted">标题</span>
            <input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">slug（留空自动生成）</span>
            <input
              value={form.slug}
              onChange={(e) => update('slug', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">摘要</span>
            <input
              value={form.summary}
              onChange={(e) => update('summary', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">标签（逗号分隔）</span>
            <input
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">状态</span>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as FormState['status'])}
              className={inputClass}
            >
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </label>
          <MarkdownEditor
            value={form.content_md}
            onChange={(value) => update('content_md', value)}
          />
          <Button type="submit" variant="primary">
            保存
          </Button>
        </form>
      </Surface>
    </AppShell>
  )
}
