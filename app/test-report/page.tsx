'use client'
import { useState } from 'react'

export default function TestReportPage() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  async function runTest() {
    setLoading(true)
    setResult('Generating... this may take a few seconds')
    try {
      const periodEnd = new Date()
      const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000)

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
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
        {loading ? 'Generating...' : 'Test Generate Report'}
      </button>
      <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 16 }}>
        {result}
      </pre>
    </div>
  )
}