import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function IconButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-secondary/40 text-third transition hover:border-secondary"
    >
      <Icon size={16} />
    </button>
  )
}

export function Toggle({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        selected ? 'border-third bg-third font-semibold text-main' : 'border-secondary/40 text-third hover:border-secondary'
      }`}
    >
      {children}
    </button>
  )
}

export function SourceOption({ icon: Icon, title, detail, onClick }: { icon: LucideIcon; title: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-4 rounded-xl border border-secondary/40 bg-main/40 px-4 py-3.5 text-left transition hover:border-secondary active:scale-[0.99]"
    >
      <Icon size={20} className="shrink-0" />
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-third/60">{detail}</span>
      </span>
    </button>
  )
}
