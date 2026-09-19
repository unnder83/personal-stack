import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MarkdownView } from './MarkdownView'

describe('MarkdownView', () => {
  it('渲染 Markdown 标题与列表', () => {
    render(<MarkdownView content={'## 小标题\n\n- 一\n- 二'} />)

    expect(screen.getByRole('heading', { name: '小标题' })).toBeInTheDocument()
    expect(screen.getByText('一')).toBeInTheDocument()
  })

  it('不执行原始 HTML（防 XSS）', () => {
    render(<MarkdownView content={'<script>alert(1)</script>\n\n**加粗**'} />)

    expect(document.querySelector('script')).toBeNull()
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(screen.getByText('加粗')).toBeInTheDocument()
  })
})
