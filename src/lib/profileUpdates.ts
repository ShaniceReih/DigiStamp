import { useEffect, useState } from 'react'

const eventName = 'digistamp:profile-updated'
export function notifyProfileUpdated() {
  window.dispatchEvent(new Event(eventName))
  try { localStorage.setItem(eventName, `${Date.now()}-${Math.random()}`) } catch { /* Same-tab updates still work when storage is disabled. */ }
}

export function useProfileRevision() {
  const [revision,setRevision] = useState(0)
  useEffect(()=>{
    const refresh = ()=>setRevision(value=>value+1)
    const storage = (event: StorageEvent)=>{if(event.key===eventName)refresh()}
    const visible = ()=>{if(document.visibilityState==='visible')refresh()}
    window.addEventListener(eventName,refresh)
    window.addEventListener('focus',refresh)
    window.addEventListener('storage',storage)
    document.addEventListener('visibilitychange',visible)
    return ()=>{
      window.removeEventListener(eventName,refresh)
      window.removeEventListener('focus',refresh)
      window.removeEventListener('storage',storage)
      document.removeEventListener('visibilitychange',visible)
    }
  },[])
  return revision
}
