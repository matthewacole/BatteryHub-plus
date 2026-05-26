import { getBatteryChecks } from './db'

export function updateBadge() {
  try {
    if (!('setAppBadge' in navigator)) return
    const pending = getBatteryChecks({ completed: 0 }).length
    if (pending > 0) {
      navigator.setAppBadge(pending)
    } else {
      navigator.clearAppBadge()
    }
  } catch {
    // Badge API not supported
  }
}
