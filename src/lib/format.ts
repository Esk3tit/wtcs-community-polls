export function formatTimeRemaining(closesAt: string): string {
  const now = new Date()
  const closes = new Date(closesAt)
  const diffMs = closes.getTime() - now.getTime()

  if (diffMs <= 0) return 'Closed'
  if (diffMs < 60 * 60 * 1000) return 'Closes soon'

  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} left`

  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} left`
}

export function calcPercentage(count: number, total: number): number {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}
