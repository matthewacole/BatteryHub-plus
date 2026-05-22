export default function BuildingFilter({ active, onChange, buildings }: { active: string; onChange: (b: string) => void; buildings: string[] }) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      <button
        onClick={() => onChange('ALL')}
        className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
          active === 'ALL'
            ? 'bg-ai-blue text-white'
            : 'bg-surface-tertiary text-neutral-500 hover:bg-surface-tertiary/80'
        }`}
      >
        All Buildings
      </button>
      {buildings.map(b => (
        <button
          key={b}
          onClick={() => onChange(b)}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            active === b
              ? 'bg-ai-blue text-white'
              : 'bg-surface-tertiary text-neutral-500 hover:bg-surface-tertiary/80'
          }`}
        >
          {b}
        </button>
      ))}
    </div>
  )
}
