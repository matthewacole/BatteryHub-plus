import { useState, useEffect, useRef } from 'react'
import { api, type ImportType } from '../../api'
import { exportData, importData } from '../../db'
import type { ForceMode } from '../../types'
import Configure from './Configure'

const FORCE_MODE_KEY = 'battery-hub-ui-mode'

export default function Settings({ onManagedBuildingsChange, forceMode, onForceModeChange }: { onManagedBuildingsChange: () => void; forceMode: ForceMode; onForceModeChange: (m: ForceMode) => void }) {
  const [imports, setImports] = useState<ImportType[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [confirmImport, setConfirmImport] = useState<any>(null)

  useEffect(() => {
    api.imports.list().then(setImports).catch(() => {})
  }, [])

  const VALID_EXTENSIONS = ['.xml', '.xlsx', '.xls']
  const VALID_MIMES = ['text/xml', 'application/xml', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!VALID_EXTENSIONS.includes(ext) && !VALID_MIMES.includes(file.type)) {
      setMessage({ type: 'error', text: 'Please select a .xlsx or .xml file from 25Live.' })
      if (fileRef.current) fileRef.current.value = ''
      return
    }
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

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `battery-hub-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage({ type: 'success', text: 'Data exported successfully' })
  }

  const handleImportSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target!.result as string)
        if (data.version !== 1) throw new Error('Unsupported export version')
        const summary = [
          `${data.data.imports?.length || 0} imports`,
          `${data.data.schedules?.length || 0} schedule entries`,
          `${data.data.batteryChecks?.length || 0} battery checks`,
        ].join(', ')
        setConfirmImport(data)
        setMessage({ type: 'success', text: `File valid — ${summary}. Click "Confirm Import" to apply.` })
      } catch (err: any) {
        setMessage({ type: 'error', text: `Invalid file: ${err.message}` })
      }
    }
    reader.readAsText(file)
    if (importFileRef.current) importFileRef.current.value = ''
  }

  const handleConfirmImport = () => {
    if (!confirmImport) return
    try {
      importData(confirmImport)
      setConfirmImport(null)
      setMessage({ type: 'success', text: 'Data imported successfully. Reloading...' })
      setTimeout(() => location.reload(), 1000)
    } catch (err: any) {
      setMessage({ type: 'error', text: `Import failed: ${err.message}` })
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Settings</h2>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <img src="/icons/icon-192.png" alt="" className="w-4 h-4" />
          <span>BatteryHub+</span>
          <span className="text-neutral-300">v1.5.0</span>
        </div>
      </div>
      <section className="mb-8">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3">Display Mode</h3>
        <div className="bg-white rounded-xl border border-border-light p-5 shadow-sm">
          <div className="flex gap-2">
            {(['auto', 'desktop', 'mobile'] as ForceMode[]).map(m => (
              <button
                key={m}
                onClick={() => { localStorage.setItem(FORCE_MODE_KEY, m); onForceModeChange(m) }}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  forceMode === m
                    ? 'bg-ai-blue text-white'
                    : 'bg-surface-tertiary text-neutral-500 hover:bg-surface-tertiary/80'
                }`}
              >
                {m === 'auto' ? 'Auto' : m === 'desktop' ? 'Desktop' : 'Mobile'}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-2">
            Auto adapts to screen size. Desktop forces the sidebar visible. Mobile forces the bottom nav.
          </p>
        </div>
      </section>
      {message && (
        <div className={`mb-4 px-4 py-2 rounded-xl text-sm ${
          message.type === 'success' ? 'bg-ai-green/5 text-ai-green border border-ai-green/20' : 'bg-ai-pink/5 text-ai-pink border border-ai-pink/20'
        }`}>
          {message.text}
        </div>
      )}
      {confirmImport && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-ai-yellow/10 border border-ai-yellow/30 text-sm flex items-center justify-between">
          <span className="text-neutral-700">Ready to import this backup file.</span>
          <div className="flex gap-2">
            <button onClick={() => setConfirmImport(null)} className="px-3 py-1.5 rounded-lg text-sm text-neutral-500 hover:text-text-primary transition-colors">
              Cancel
            </button>
            <button onClick={handleConfirmImport} className="px-3 py-1.5 rounded-lg text-sm text-white bg-ai-blue hover:bg-ai-blue/90 transition-colors">
              Confirm Import
            </button>
          </div>
        </div>
      )}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3">Import Schedule</h3>
          <div className="bg-white rounded-xl border border-border-light p-5 shadow-sm">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border-light rounded-xl py-8 cursor-pointer hover:border-ai-blue/30 transition-colors">
            <span className="text-2xl mb-2">📂</span>
            <span className="text-sm text-neutral-500">{uploading ? 'Importing...' : 'Click to upload weekly schedule file'}</span>
            <span className="text-xs text-neutral-400 mt-1">.xlsx or .xml from 25Live</span>
            <input ref={fileRef} type="file" accept=".xml,.xlsx,text/xml,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleUpload} className="hidden" disabled={uploading} />
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
        <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3">Data Management</h3>
        <div className="bg-white rounded-xl border border-border-light p-5 shadow-sm">
          <p className="text-sm text-neutral-500 mb-4">Export your data as a JSON backup or import a previous backup. Data is stored locally in this browser.</p>
          <div className="flex gap-3">
            <button onClick={handleExport} className="px-4 py-2 bg-ai-blue text-white rounded-lg text-sm hover:bg-ai-blue/90 transition-colors">
              Export Data
            </button>
            <label className="px-4 py-2 bg-ai-green/10 text-ai-green rounded-lg text-sm hover:bg-ai-green/20 transition-colors cursor-pointer">
              Import Data
              <input ref={importFileRef} type="file" accept=".json" onChange={handleImportSelect} className="hidden" />
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}
