type Props = { kind?: 'stamp' | 'check' | 'star' | 'cafe' | 'home' | 'gift' | 'play' | 'user' | 'qr' | 'receipt' }

export default function StampIcon({ kind = 'stamp' }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === 'stamp' && <><path d="M8 12V9a4 4 0 0 1 8 0v3l4 4v3H4v-3l4-4Z" /><path d="M4 22h16M9 16h6" /></>}
      {kind === 'check' && <path d="m6 12 4 4 8-8" strokeWidth="2" />}
      {kind === 'star' && <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />}
      {kind === 'cafe' && <><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8ZM17 9h1a3 3 0 1 1 0 6h-1M3 22h16M8 3v2M12 2v3" /></>}
      {kind === 'home' && <><path d="m3 10 9-7 9 7v11H3V10Z" /><path d="M9 21v-8h6v8" /></>}
      {kind === 'gift' && <><path d="M3 8h18v5H3zM5 13v8h14v-8M12 8v13" /><path d="M12 8H8a3 3 0 1 1 3-3l1 3ZM12 8h4a3 3 0 1 0-3-3l-1 3Z" /></>}
      {kind === 'play' && <><rect x="3" y="6" width="18" height="13" rx="4" /><path d="M7 12h4M9 10v4M16 11h.01M18 14h.01" /></>}
      {kind === 'user' && <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
      {kind === 'receipt' && <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" /><path d="M9 7h6M9 11h6M9 15h3" /></>}
      {kind === 'qr' && <><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6zM12 3v9H3M12 15v6M21 12h-6" /></>}
    </svg>
  )
}
