import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { API_URL, tokenStore } from '@/lib/api'

const MAX_RETRY_MS = 30_000

/** Splits an SSE byte stream into { event, data } messages. */
function parseEvents(buffer) {
  const messages = []
  const blocks = buffer.split('\n\n')
  const rest = blocks.pop()
  for (const block of blocks) {
    let event = 'message'
    let data = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data += line.slice(5).trim()
    }
    if (data) messages.push({ event, data: JSON.parse(data) })
  }
  return { messages, rest }
}

/**
 * Subscribes to /api/events and refreshes affected queries when tickets change.
 * Uses fetch rather than EventSource so the token travels in a header instead
 * of the URL (where it would end up in access logs).
 */
export function useLiveEvents({ enabled, onEvent }) {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    let retryMs = 1000
    let retryTimer

    async function connect() {
      try {
        const response = await fetch(`${API_URL}/events`, {
          headers: { Authorization: `Bearer ${tokenStore.get()}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        })
        if (!response.ok || !response.body) throw new Error(`Event stream failed (${response.status})`)

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          const { messages, rest } = parseEvents(buffer + value)
          buffer = rest
          for (const { event, data } of messages) {
            if (event === 'ready') {
              setConnected(true)
              retryMs = 1000
              // Catch up on anything missed while disconnected.
              queryClient.invalidateQueries({ queryKey: ['tickets'] })
              queryClient.invalidateQueries({ queryKey: ['ticket'] })
              continue
            }
            queryClient.invalidateQueries({ queryKey: ['tickets'] })
            queryClient.invalidateQueries({ queryKey: ['ticket', data.ticketId] })
            onEventRef.current?.(event, data)
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.warn('Live updates disconnected:', err.message)
      }
      setConnected(false)
      if (!controller.signal.aborted) {
        retryTimer = setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
      }
    }

    connect()
    return () => {
      controller.abort()
      clearTimeout(retryTimer)
      setConnected(false)
    }
  }, [enabled, queryClient])

  return { connected }
}
