'use client'

import { useEffect, useState } from 'react'

interface LiveClockProps {
  timezone: string
  initialTime: string
}

export function LiveClock({ timezone, initialTime }: LiveClockProps) {
  const [time, setTime] = useState(initialTime)

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    })
    const updateTime = () => setTime(formatter.format(new Date()))

    updateTime()
    const interval = window.setInterval(updateTime, 1000)
    return () => window.clearInterval(interval)
  }, [timezone])

  return (
    <time className="tabular-nums" aria-label="Current time">
      {time}
    </time>
  )
}