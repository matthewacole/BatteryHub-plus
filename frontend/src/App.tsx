import { useState, useEffect } from 'react'
import type { Tab, ForceMode, DarkMode } from './types'
import { api } from './api'
import { updateBadge } from './badge'
import Sidebar from './components/shared/Sidebar'
import MobileNav from './components/shared/MobileNav'
import Dashboard from './components/Dashboard/Dashboard'
import BatteryCheck from './components/BatteryCheck/BatteryCheck'
import ClassDetails from './components/ClassDetails/ClassDetails'
import Settings from './components/Settings/Settings'
import SplashScreen from './components/shared/SplashScreen'

const FORCE_MODE_KEY = 'battery-hub-ui-mode'
const DARK_MODE_KEY = 'battery-hub-dark-mode'

function getStoredForceMode(): ForceMode {
  try {
    const v = localStorage.getItem(FORCE_MODE_KEY)
    if (v === 'desktop' || v === 'mobile') return v
  } catch {}
  return 'auto'
}

function getStoredDarkMode(): DarkMode {
  try {
    const v = localStorage.getItem(DARK_MODE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

function applyDarkMode(mode: DarkMode) {
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL')
  const [managedBuildings, setManagedBuildings] = useState<string[]>([])
  const [forceMode, setForceMode] = useState<ForceMode>(getStoredForceMode)
  const [darkMode, setDarkMode] = useState<DarkMode>(getStoredDarkMode)

  useEffect(() => {
    updateBadge()
    api.rooms.managed.buildings().then(setManagedBuildings).catch(() => {})
  }, [])

  useEffect(() => {
    applyDarkMode(darkMode)
  }, [darkMode])

  useEffect(() => {
    if (darkMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyDarkMode('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [darkMode])

  const handleDarkModeChange = (m: DarkMode) => {
    localStorage.setItem(DARK_MODE_KEY, m)
    setDarkMode(m)
  }

  const buildings = managedBuildings

  return (
    <>
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
      <div className="flex h-screen bg-surface-secondary text-text-primary overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} forceMode={forceMode} />
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} forceMode={forceMode} />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {activeTab === 'dashboard' && (
            <Dashboard buildingFilter={buildingFilter} onBuildingFilter={setBuildingFilter} buildings={buildings} />
          )}
          {activeTab === 'battery' && (
            <BatteryCheck buildingFilter={buildingFilter} onBuildingFilter={setBuildingFilter} buildings={buildings} />
          )}
          {activeTab === 'details' && (
            <ClassDetails buildingFilter={buildingFilter} onBuildingFilter={setBuildingFilter} buildings={buildings} />
          )}
          {activeTab === 'settings' && <Settings onManagedBuildingsChange={() => api.rooms.managed.buildings().then(setManagedBuildings).catch(() => {})} forceMode={forceMode} onForceModeChange={setForceMode} darkMode={darkMode} onDarkModeChange={handleDarkModeChange} />}
        </div>
      </main>
    </div>
    </>
  )
}
