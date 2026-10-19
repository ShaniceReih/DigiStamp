type Props = { kind?: 'stamp' | 'check' | 'star' | 'cafe' }

export default function StampIcon({ kind = 'stamp' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'stamp' && <><path d="M8 12V9a4 4 0 0 1 8 0v3l4 4v3H4v-3l4-4Z" /><path d="M4 22h16M9 16h6" /></>}
      {kind === 'check' && <path d="m6 12 4 4 8-8" strokeWidth="2" />}
      {kind === 'star' && <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />}
      {kind === 'cafe' && <><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h1a3 3 0 1 1 0 6h-1M3 22h16M8 3v2M12 2v3" /></>}
    </svg>
  )
}
