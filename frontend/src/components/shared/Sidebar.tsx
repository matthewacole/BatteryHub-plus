import type { Tab, ForceMode } from '../../types'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◻' },
  { id: 'battery', label: 'Battery Check', icon: '⚡' },
  { id: 'details', label: 'Calendar', icon: '📅' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export default function Sidebar({ activeTab, onTabChange, forceMode }: { activeTab: Tab; onTabChange: (t: Tab) => void; forceMode: ForceMode }) {
  const hidden = forceMode === 'mobile' ? 'hidden' : forceMode === 'desktop' ? '' : 'hidden md:flex'
  return (
    <nav className={`w-56 bg-surface border-r border-border-light flex-col py-4 shrink-0 ${hidden}`}>
      <div className="px-5 mb-6">
        <h1 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">BatteryHub+</h1>
      </div>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors text-left ${
            activeTab === t.id
              ? 'bg-surface-secondary text-text-primary font-medium border-l-2 border-ai-blue'
              : 'text-neutral-500 hover:text-text-primary hover:bg-surface-secondary'
          }`}
        >
          <span className="text-lg">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
