// Deterministic classifier used when the LLM is unavailable. Also gives every
// ticket a category and priority the instant it is created, before the LLM
// result arrives.

const CATEGORY_RULES = [
  ['isbn_metadata', /\bisbn\b|metadata|wrong (book|author|title)|book description|author bio|\bblurb\b|imprint/],
  ['royalty_payments', /royalt|payout|payment|paid|\bpay\b|bank|earning|money|statement|rs\.?\s?\d|₹|\binr\b/],
  ['printing_quality', /print(ing)? quality|misprint|blurr|binding|pages? (missing|torn|misaligned)|defect|damaged|smudge|colou?r|reprint|author cop/],
  ['distribution_availability', /unavailable|out of stock|not (listed|available|showing)|amazon|flipkart|listing|distribution|buy (my|the) book/],
  ['book_status_production', /status|typesetting|proofread|cover design|editing|manuscript|production|when will .* (be )?(published|live|ready)|delay/],
];

const CRITICAL = /legal|lawyer|lawsuit|fraud|scam|police|consumer court|(\d+|several|many) months? .*(no|not|without|haven'?t).*(royalt|pay)|(no|not|haven'?t).*(royalt|pay).*(\d+|several|many) months?|wrong (book|author) (linked|listed|sold)/;
const HIGH = /\bisbn\b.*(wrong|different|mismatch|duplicate|error|incorrect)|(wrong|different|mismatch|duplicate|incorrect).*\bisbn\b|overdue|not received|haven'?t received|misprint|defect|damaged|blurr|unavailable|out of stock|urgent|asap|immediately/;
const LOW = /how (do|can) i|can i (update|change)|author bio|\bbio\b|description|curious|just wondering|quick question|general question/;

export function classifyByKeywords(subject, description) {
  const text = `${subject}\n${description}`.toLowerCase();

  const category = CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? 'general_inquiry';

  let priority = 'medium';
  if (CRITICAL.test(text)) priority = 'critical';
  else if (HIGH.test(text)) priority = 'high';
  else if (LOW.test(text)) priority = 'low';

  return { category, priority, reasoning: 'Keyword-based classification (AI unavailable or pending).' };
}
