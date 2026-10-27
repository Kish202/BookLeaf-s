export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
export const UNRESOLVED_STATUSES = ['open', 'in_progress'];
export const RESOLVED_STATUSES = ['resolved', 'closed'];

export const TICKET_CATEGORIES = [
  'royalty_payments',
  'isbn_metadata',
  'printing_quality',
  'distribution_availability',
  'book_status_production',
  'general_inquiry',
];

export const CATEGORY_LABELS = {
  royalty_payments: 'Royalty & Payments',
  isbn_metadata: 'ISBN & Metadata Issues',
  printing_quality: 'Printing & Quality',
  distribution_availability: 'Distribution & Availability',
  book_status_production: 'Book Status & Production Updates',
  general_inquiry: 'General Inquiry',
};

// Ordered most to least urgent.
export const TICKET_PRIORITIES = ['critical', 'high', 'medium', 'low'];
