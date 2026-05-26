import type { Tab, ForceMode } from '../../types'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◻' },
  { id: 'battery', label: 'Battery', icon: '⚡' },
  { id: 'details', label: 'Calendar', icon: '📅' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export default function MobileNav({ activeTab, onTabChange, forceMode }: { activeTab: Tab; onTabChange: (t: Tab) => void; forceMode: ForceMode }) {
  const hidden = forceMode === 'desktop' ? 'hidden' : forceMode === 'mobile' ? '' : 'md:hidden'
  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 flex bg-surface/95 backdrop-blur-lg border-t border-border-light pb-[env(safe-area-inset-bottom,0px)] ${hidden}`}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex-1 flex flex-col items-center py-1.5 text-[10px] transition-colors ${
            activeTab === t.id
              ? 'text-ai-blue'
              : 'text-neutral-400'
          }`}
        >
          <span className="text-xl leading-tight">{t.icon}</span>
          <span className="mt-0.5">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
