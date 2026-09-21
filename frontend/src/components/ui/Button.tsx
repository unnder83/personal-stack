import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
}

export function Button({ variant = 'ghost', className = '', ...props }: ButtonProps) {
  const base = 'rounded-card px-3 py-2 text-sm transition-colors disabled:opacity-50'
  const styles =
    variant === 'primary'
      ? 'bg-accent text-accent-fg hover:opacity-90'
      : 'border border-border text-fg hover:bg-surface'
  return <button className={`${base} ${styles} ${className}`.trim()} {...props} />
}
