import { useState, useEffect } from 'react'
import type { Tab } from './types'
import { api } from './api'
import Sidebar from './components/shared/Sidebar'
import MobileNav from './components/shared/MobileNav'
import Dashboard from './components/Dashboard/Dashboard'
import BatteryCheck from './components/BatteryCheck/BatteryCheck'
import ClassDetails from './components/ClassDetails/ClassDetails'
import Settings from './components/Settings/Settings'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL')
  const [managedBuildings, setManagedBuildings] = useState<string[]>([])

  useEffect(() => {
    api.rooms.managed.buildings().then(setManagedBuildings).catch(() => {})
  }, [])

  const buildings = managedBuildings

  return (
    <div className="flex h-screen bg-surface-secondary text-text-primary overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
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
          {activeTab === 'settings' && <Settings onManagedBuildingsChange={() => api.rooms.managed.buildings().then(setManagedBuildings).catch(() => {})} />}
        </div>
      </main>
    </div>
  )
}
