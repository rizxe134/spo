import type { ButtonHTMLAttributes } from 'react'

type Tone = 'default' | 'primary' | 'danger' | 'ghost' | 'warn'

const tones: Record<Tone, string> = {
  default: 'bg-panel-2 text-paper border border-line hover:border-pin/50 hover:bg-[#142014]',
  primary: 'bg-go text-ink border border-transparent hover:brightness-110',
  danger: 'bg-err/15 text-err border border-err/40 hover:bg-err/25',
  ghost: 'bg-transparent text-paper border border-transparent hover:bg-pin/10 hover:text-pin',
  warn: 'bg-pin text-ink border border-transparent hover:brightness-110 shadow-[0_0_12px_rgba(61,255,106,0.28)]'
}

export function Button({
  tone = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pin disabled:cursor-not-allowed disabled:opacity-45 ${tones[tone]} ${className}`}
      {...props}
    />
  )
}
