'use client'

import { useState, useRef, useEffect } from 'react'

interface Source {
  id: string
  content: string
  sentiment: string | null
  featureArea: string | null
  relevance: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isError?: boolean
}

const SUGGESTED_QUESTIONS = [
  'What are users saying about onboarding?',
  'Are there any reliability or crash issues?',
  'What do users think about pricing?',
]

export default function AskLoopPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 45000)

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, topK: 5 }),
        signal: controller.signal,
      })
      const json = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: json.error?.message ?? 'Something went wrong.', isError: true },
        ])
        return
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: json.data.answer, sources: json.data.sources },
      ])
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'This is taking longer than expected. Please try again.'
          : 'Failed to reach the server. Please try again.'
      setMessages((prev) => [...prev, { role: 'assistant', content: message, isError: true }])
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] max-w-3xl mx-auto">
      <div className="px-4 sm:px-8 py-6 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">Ask LOOP</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ask questions about your feedback in plain English. Answers are grounded in your actual data.
        </p>
      </div>

      <div
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Try asking:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendQuestion(q)}
                  className="text-left text-sm px-4 py-2.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 transition text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={msg.role === 'user' ? 'max-w-[80%]' : 'max-w-[85%] w-full'}>
              {msg.role === 'user' ? (
                <div className="bg-gray-900 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm ${
                      msg.isError
                        ? 'bg-red-50 border border-red-200 text-red-700'
                        : 'bg-white border border-gray-200 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="space-y-1.5 pl-1">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        Based on {msg.sources.length} feedback item{msg.sources.length > 1 ? 's' : ''}
                      </p>
                      {msg.sources.map((src, idx) => (
                        <div
                          key={src.id + idx}
                          className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
                        >
                          <span className="font-medium text-gray-400">[{idx + 1}]</span> {src.content}
                          {src.featureArea && (
                            <span className="ml-2 text-gray-400">· {src.featureArea}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-400">
              Searching feedback…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 sm:px-8 py-4 border-t border-gray-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendQuestion(input)
          }}
          className="flex gap-2"
        >
          <input
            aria-label="Ask a question about your feedback"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your feedback…"
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-gray-900 transition"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  )
}