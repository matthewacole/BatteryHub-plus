import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fade, setFade] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setFade(true), 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface transition-opacity duration-500 ${
        fade ? 'opacity-0' : 'opacity-100'
      }`}
      onTransitionEnd={() => fade && onDone()}
    >
      <img src="icons/icon-192.png" alt="" className="w-16 h-16 mb-4" />
      <div className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">BatteryHub+</div>
    </div>
  )
}
