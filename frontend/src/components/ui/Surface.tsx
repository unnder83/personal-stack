import type { HTMLAttributes } from 'react'

export function Surface({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-border bg-surface shadow-card backdrop-blur-card ${className}`.trim()}
      {...props}
    />
  )
}
