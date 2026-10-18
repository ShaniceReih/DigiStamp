
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [status, setStatus] = useState('Checking Supabase...')

  useEffect(() => {
    async function checkConnection() {
      try {
        const { error } = await supabase.auth.getSession()

        if (error) {
          setStatus(`Connection error: ${error.message}`)
        } else {
          setStatus('Supabase client initialized successfully!')
        }
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : 'Unknown error'
        )
      }
    }

    checkConnection()
  }, [])

  return (
    <main style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>DigiStamp</h1>
      <p>Scan. Play. Earn. Return.</p>
      <h2>{status}</h2>
    </main>
  )
}

export default App
