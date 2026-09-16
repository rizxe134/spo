import type { ButtonHTMLAttributes } from 'react'

type Tone = 'default' | 'primary' | 'danger' | 'ghost' | 'warn'

const tones: Record<Tone, string> = {
  default: 'bg-panel-2 text-paper border border-line hover:bg-[#2a2f3d]',
  primary: 'bg-go text-ink border border-transparent hover:brightness-110',
  danger: 'bg-err/15 text-err border border-err/40 hover:bg-err/25',
  ghost: 'bg-transparent text-paper border border-transparent hover:bg-white/5',
  warn: 'bg-pin text-ink border border-transparent hover:brightness-110'
}

export function Button({
  tone = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45 ${tones[tone]} ${className}`}
      {...props}
    />
  )
}
