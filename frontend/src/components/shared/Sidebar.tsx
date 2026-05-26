import type { Tab, ForceMode } from '../../types'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '🏠' },
  { id: 'battery', label: 'Check', icon: '⚡' },
  { id: 'details', label: 'Classrooms', icon: '🏫' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar({ activeTab, onTabChange, forceMode }: { activeTab: Tab; onTabChange: (t: Tab) => void; forceMode: ForceMode }) {
  const hidden = forceMode === 'mobile' ? 'hidden' : forceMode === 'desktop' ? '' : 'hidden md:flex'
  return (
    <nav className={`w-44 bg-surface border-r border-border-light flex-col py-4 shrink-0 ${hidden}`}>
      <div className="px-3 mb-6 flex items-center gap-2">
        <img src="icons/icon-192.png" alt="" className="w-5 h-5" />
        <h1 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">BatteryHub+</h1>
      </div>
      <div className="px-2 space-y-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors w-full rounded-full ${
              activeTab === t.id
                ? 'bg-ai-blue text-white font-medium'
                : 'text-neutral-500 hover:bg-surface-tertiary'
            }`}
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
