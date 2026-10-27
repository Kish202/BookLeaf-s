// Display metadata for ticket enums. Colours map to the pastel palette in index.css.

export const STATUSES = {
  open: { label: 'Open', className: 'bg-sky text-sky-foreground' },
  in_progress: { label: 'In progress', className: 'bg-butter text-butter-foreground' },
  resolved: { label: 'Resolved', className: 'bg-mint text-mint-foreground' },
  closed: { label: 'Closed', className: 'bg-muted text-muted-foreground' },
}

export const PRIORITIES = {
  critical: { label: 'Critical', className: 'bg-destructive/15 text-destructive', dot: 'bg-destructive' },
  high: { label: 'High', className: 'bg-peach text-peach-foreground', dot: 'bg-peach-foreground' },
  medium: { label: 'Medium', className: 'bg-lavender text-lavender-foreground', dot: 'bg-lavender-foreground' },
  low: { label: 'Low', className: 'bg-mint text-mint-foreground', dot: 'bg-mint-foreground' },
}

export const CATEGORIES = {
  royalty_payments: { label: 'Royalty & Payments', emoji: '💸' },
  isbn_metadata: { label: 'ISBN & Metadata', emoji: '🏷️' },
  printing_quality: { label: 'Printing & Quality', emoji: '🖨️' },
  distribution_availability: { label: 'Distribution & Availability', emoji: '🚚' },
  book_status_production: { label: 'Book Status & Production', emoji: '🛠️' },
  general_inquiry: { label: 'General Inquiry', emoji: '💬' },
}

export const SOURCE_LABELS = {
  ai: 'AI',
  fallback: 'Keyword triage',
  admin: 'Set by admin',
}

export const UNRESOLVED = ['open', 'in_progress']
