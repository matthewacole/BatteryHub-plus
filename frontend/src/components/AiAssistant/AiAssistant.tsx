import { useState, useRef, useEffect } from 'react'
import { api } from '../../api'

const SUGGESTIONS = [
  'Which rooms exceed 6 hours tomorrow?',
  'Which rooms need night-before checks?',
  'How many batteries are needed this week?',
  'Show empty rooms between 1 and 3 PM.',
  "What's the busiest day this week?",
]

export default function AiAssistant({ tab, building }: { tab: string; building: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSend = async (q?: string) => {
    const text = (q || query).trim()
    if (!text || loading) return
    setQuery('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)
    try {
      const result = await api.ai.ask(text, { tab, building: building === 'ALL' ? undefined : building })
      setMessages(prev => [...prev, { role: 'assistant', text: result.answer }])
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`fixed bottom-0 right-0 z-50 transition-all ${open ? 'w-[480px]' : 'w-full'}`} style={{ left: open ? 'auto' : '224px' }}>
      {!open ? (
        <div className="bg-white border-t border-border-light px-6 py-3 flex items-center gap-3" style={{ borderTop: '3px solid transparent', borderImage: 'linear-gradient(90deg, #007AFF, #5856D6, #FF375F) 1' }}>
          <input
            type="text"
            placeholder="Ask about schedules..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (setOpen(true), handleSend())}
            className="flex-1 bg-surface-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ai-blue/30"
          />
          <button onClick={() => { setOpen(true); if (query) handleSend() }} className="text-sm text-neutral-400 hover:text-text-primary">
            ▲
          </button>
        </div>
      ) : (
        <div className="bg-white border-t border-l border-border-light rounded-tl-xl shadow-lg flex flex-col h-[400px]" style={{ borderTop: '3px solid transparent', borderImage: 'linear-gradient(90deg, #007AFF, #5856D6, #FF375F) 1' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <span className="text-sm font-medium text-neutral-600">AI Assistant</span>
            <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-700">▼ Minimize</button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            {messages.length === 0 && (
              <div className="text-neutral-400 text-xs py-4 space-y-2">
                <p>Try asking:</p>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => handleSend(s)} className="block w-full text-left px-3 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-500 text-xs">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`${m.role === 'user' ? 'text-neutral-800' : 'text-neutral-600'}`}>
                {m.role === 'user' && <span className="font-medium text-xs text-neutral-400 block mb-1">You</span>}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
            ))}
            {loading && <div className="text-neutral-400 italic">Thinking...</div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-border-light px-4 py-3 flex gap-2">
            <input
              type="text"
              placeholder="Ask a question..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-surface-secondary rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-ai-blue/30"
            />
            <button onClick={() => handleSend()} disabled={loading} className="px-4 py-2 rounded-xl text-sm text-white transition-colors disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
