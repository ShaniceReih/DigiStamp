import { useState } from 'react'

export default function ProfileAvatar({ name, src, large = false }: { name: string; src?: string | null; large?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  return <span className={`profile-avatar${large ? ' profile-avatar-large' : ''}`}>
    {src && src !== failedSource ? <img src={src} alt="" onError={()=>setFailedSource(src)} /> : <span aria-hidden="true">{name.trim().slice(0,1).toUpperCase() || 'D'}</span>}
  </span>
}
