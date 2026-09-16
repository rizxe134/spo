import type { InputHTMLAttributes } from 'react'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 w-full rounded-md border border-line bg-ink px-3 text-sm text-paper outline-none placeholder:text-muted focus:border-pin ${className}`}
      {...props}
    />
  )
}
