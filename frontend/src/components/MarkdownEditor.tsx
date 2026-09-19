import MDEditor from '@uiw/react-md-editor'

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: MarkdownEditorProps) {
  return (
    <div data-color-mode="light">
      <MDEditor value={value} onChange={(next) => onChange(next ?? '')} height={400} />
    </div>
  )
}
