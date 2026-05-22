import { useState, useEffect, useRef } from 'react'
import { api, type ImportType } from '../../api'
import Configure from './Configure'

export default function Settings({ onManagedBuildingsChange }: { onManagedBuildingsChange: () => void }) {
  const [imports, setImports] = useState<ImportType[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [aiConfig, setAiConfig] = useState({ apiUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', apiKey: '' })
  const [models, setModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const urlTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    api.imports.list().then(setImports).catch(() => {})
    api.ai.config().then(setAiConfig).catch(() => {})
  }, [])

  useEffect(() => {
    if (urlTimer.current) clearTimeout(urlTimer.current)
    urlTimer.current = setTimeout(() => {
      if (!aiConfig.apiUrl) return
      setModelsLoading(true)
      api.ai.models().then(list => {
        setModels(list)
        if (list.length > 0 && !list.includes(aiConfig.model)) {
          const m = list[0]
          setAiConfig(prev => ({ ...prev, model: m }))
          api.ai.updateConfig({ ...aiConfig, model: m }).catch(() => {})
        }
      }).catch(() => setModels([])).finally(() => setModelsLoading(false))
    }, 400)
  }, [aiConfig.apiUrl])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      const result: any = await api.imports.upload(file)
      setMessage({ type: 'success', text: `Imported ${result.entriesImported} entries for week starting ${result.weekStart}` })
      api.imports.list().then(setImports)
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDeleteImport = async (id: number) => {
    try {
      await api.imports.delete(id)
      setImports(prev => prev.filter(i => i.id !== id))
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleSaveAiConfig = async () => {
    try {
      await api.ai.updateConfig(aiConfig)
      setMessage({ type: 'success', text: 'AI config saved' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleModelChange = (model: string) => {
    setAiConfig(prev => ({ ...prev, model }))
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-6">Settings</h2>
       {message && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-ai-green/5 text-ai-green border border-ai-green/20' : 'bg-ai-pink/5 text-ai-pink border border-ai-pink/20'
        }`}>
          {message.text}
        </div>
      )}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3">Import Schedule</h3>
          <div className="bg-white rounded-xl border border-border-light p-5 shadow-sm">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border-light rounded-xl py-8 cursor-pointer hover:border-ai-blue/30 transition-colors">
            <span className="text-2xl mb-2">📂</span>
            <span className="text-sm text-neutral-500">{uploading ? 'Uploading...' : 'Click to upload weekly Excel file'}</span>
            <span className="text-xs text-neutral-400 mt-1">.xlsx from 25Live</span>
            <input ref={fileRef} type="file" accept=".xml,.xlsx" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </section>
      <section className="mb-8">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3">Import History</h3>
        {imports.length === 0 ? (
          <p className="text-sm text-neutral-400">No imports yet.</p>
        ) : (
          <div className="space-y-2">
            {imports.map(imp => (
              <div key={imp.id} className="bg-white rounded-xl border border-border-light px-4 py-3 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-sm font-medium text-neutral-700">{imp.source_filename}</div>
                  <div className="text-xs text-neutral-400">{imp.uploaded_at} — Week: {imp.week_start}</div>
                </div>
                <button onClick={() => handleDeleteImport(imp.id)} className="text-xs px-3 py-1.5 rounded-full bg-ai-pink/10 text-ai-pink hover:bg-ai-pink/20 transition-colors">
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <Configure onManagedChange={onManagedBuildingsChange} />
      <section className="mb-8">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3">AI Configuration</h3>
        <div className="bg-white rounded-xl border border-border-light p-5 space-y-4 shadow-sm">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">API URL</label>
            <input
              type="text"
              value={aiConfig.apiUrl}
              onChange={e => setAiConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-border-light text-sm focus:outline-none focus:ring-2 focus:ring-ai-blue/30"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-400 block mb-1">Model</label>
            {modelsLoading ? (
              <div className="px-3 py-2 text-sm text-neutral-400">Loading models...</div>
            ) : models.length > 0 ? (
              <select
                value={aiConfig.model}
                onChange={e => handleModelChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border-light text-sm focus:outline-none focus:ring-2 focus:ring-ai-blue/30 bg-white"
              >
                {models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={aiConfig.model}
                onChange={e => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                placeholder="No models found — type manually"
                className="w-full px-3 py-2 rounded-lg border border-border-light text-sm focus:outline-none focus:ring-2 focus:ring-ai-blue/30"
              />
            )}
          </div>
          <div>
            <label className="text-xs text-neutral-400 block mb-1">API Key (Gemini)</label>
            <input
              type="password"
              value={aiConfig.apiKey}
              onChange={e => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your Gemini API key"
              className="w-full px-3 py-2 rounded-lg border border-border-light text-sm focus:outline-none focus:ring-2 focus:ring-ai-blue/30"
            />
          </div>
          <button onClick={handleSaveAiConfig} className="px-4 py-2 bg-ai-blue text-white rounded-lg text-sm hover:bg-ai-blue/90 transition-colors">
            Save
          </button>
        </div>
      </section>
    </div>
  )
}
