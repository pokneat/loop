'use client'

import { useState } from 'react'

export default function TestClassifyPage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function runTest() {
    setLoading(true)
    setResult('Loading...')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: "Onboarding took forever and the tutorial videos were outdated.",
          customerLabel: "Test Customer 2",
        }),
      })
      const data = await res.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (err) {
      setResult('Error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <button onClick={runTest} disabled={loading} style={{ padding: '10px 20px', fontSize: 16 }}>
        {loading ? 'Testing...' : 'Test Classify + Theme'}
      </button>
      <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 16 }}>
        {result}
      </pre>
    </div>
  )
}


