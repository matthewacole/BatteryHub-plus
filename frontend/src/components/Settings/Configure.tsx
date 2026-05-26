import { useState, useEffect } from 'react'
import type { Room } from '../../types'
import { api } from '../../api'

export default function Configure({ onManagedChange }: { onManagedChange: () => void }) {
  const [groups, setGroups] = useState<{ building: string; rooms: Room[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    api.rooms.managed.list().then(setGroups).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggleBuilding = async (building: string, allRooms: Room[], currentManaged: boolean) => {
    const updates = allRooms.map(r => ({ roomId: r.room_id, managed: !currentManaged }))
    await api.rooms.managed.update(updates)
    setGroups(prev => prev.map(g => {
      if (g.building !== building) return g
      return { ...g, rooms: g.rooms.map(r => ({ ...r, managed: currentManaged ? 0 : 1 })) }
    }))
    onManagedChange()
  }

  const toggleRoom = async (roomId: string, currentManaged: boolean) => {
    await api.rooms.managed.update([{ roomId, managed: !currentManaged }])
    setGroups(prev => prev.map(g => ({
      ...g,
      rooms: g.rooms.map(r => r.room_id === roomId ? { ...r, managed: currentManaged ? 0 : 1 } : r),
    })))
    onManagedChange()
  }

  const changeRoomType = async (roomId: string, roomType: string) => {
    await api.rooms.managed.update([{ roomId, roomType }])
    setGroups(prev => prev.map(g => ({
      ...g,
      rooms: g.rooms.map(r => r.room_id === roomId ? { ...r, room_type: roomType as 'small' | 'large', battery_req: roomType === 'large' ? 6 : 4 } : r),
    })))
  }

  if (loading) return <div className="text-sm text-neutral-400 py-4">Loading rooms...</div>

  return (
    <section className="mb-8">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between w-full text-sm font-medium text-neutral-500 uppercase tracking-wider mb-3"
      >
        <span>Configure Rooms</span>
        <span className={`text-xs transition-transform ${collapsed ? '' : 'rotate-180'}`}>▼</span>
      </button>
      {!collapsed && (
        <div className="space-y-3">
        {groups.map(g => {
          const managedCount = g.rooms.filter(r => r.managed).length
          const allManaged = managedCount === g.rooms.length
          return (
            <div key={g.building} className="bg-card rounded-xl border border-border-light overflow-hidden shadow-sm">
              <div className="px-4 py-3 flex items-center justify-between bg-surface-secondary border-b border-border-light">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm text-text-primary">{g.building}</span>
                  <span className="text-xs text-neutral-400">{managedCount}/{g.rooms.length} managed</span>
                </div>
                <button
                  onClick={() => toggleBuilding(g.building, g.rooms, allManaged)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    allManaged ? 'bg-ai-green/10 text-ai-green' : 'bg-surface-tertiary text-neutral-500 hover:bg-surface-tertiary/80'
                  }`}
                >
                  {allManaged ? 'All On' : 'All Off'}
                </button>
              </div>
              <div className="divide-y divide-border-light/50">
                {g.rooms.map(r => (
                  <div key={r.room_id} className="px-4 py-2 flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!r.managed}
                        onChange={() => toggleRoom(r.room_id, !!r.managed)}
                        className="sr-only"
                      />
                          <span className={`w-8 h-5 rounded-full transition-colors relative ${
                        r.managed ? 'bg-ai-green' : 'bg-neutral-200'
                      }`}>
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${
                          r.managed ? 'translate-x-3' : ''
                        }`} />
                      </span>
                      <span className="text-sm text-text-primary">{r.room_id}</span>
                    </label>
                    <select
                      value={r.room_type}
                      onChange={e => changeRoomType(r.room_id, e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-border-light bg-card text-neutral-500"
                    >
                      <option value="small">Small (4 bat)</option>
                      <option value="large">Large (6 bat)</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      )}
    </section>
  )
}
