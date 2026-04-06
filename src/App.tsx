import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

function App() {
  const [info, setInfo] = useState<string>('Click to test login...')

  useEffect(() => {
    // Check if we're on a callback (has code in URL params)
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))

    if (params.has('code') || hashParams.has('access_token')) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const result = [
          `Session exists: ${!!session}`,
          `provider_token: ${session?.provider_token ?? 'NULL'}`,
          `provider_token type: ${typeof session?.provider_token}`,
          `provider_token length: ${session?.provider_token?.length ?? 0}`,
          `user.id: ${session?.user?.id ?? 'none'}`,
        ].join('\n')
        setInfo(result)
        console.log('SPIKE RESULT:', result)
        console.log('Full session:', JSON.stringify(session, null, 2))
      })
    }
  }, [])

  const handleLogin = async () => {
    setInfo('Redirecting to Discord...')
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin,
        scopes: 'identify email',
      },
    })
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
      <h1>Provider Token Spike</h1>
      <button onClick={handleLogin} style={{ padding: '1rem', fontSize: '1.2rem' }}>
        Test Discord Login
      </button>
      <div style={{ marginTop: '1rem', background: '#f0f0f0', padding: '1rem' }}>
        {info}
      </div>
    </div>
  )
}

export default App
