import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'

export function inr(amount) {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

const toDate = (value) => (value instanceof Date ? value : parseISO(value))

export function formatDate(value) {
  return value ? format(toDate(value), 'd MMM yyyy') : '—'
}

export function formatDateTime(value) {
  return value ? format(toDate(value), 'd MMM yyyy, h:mm a') : '—'
}

export function timeAgo(value) {
  return value ? `${formatDistanceToNowStrict(toDate(value))} ago` : '—'
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

export const firstName = (name = '') => name.split(' ')[0]
