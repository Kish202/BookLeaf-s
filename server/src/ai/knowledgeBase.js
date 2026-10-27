// BookLeaf knowledge base, split by ticket category so each draft request only
// carries the policy it needs (a full-KB prompt is roughly 3x the tokens).

export const COMPANY_OVERVIEW = `BookLeaf Publishing is a self-publishing company operating in India and the US.
- Packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium, paid, with marketing and distribution add-ons).
- BookLeaf handles cover design, typesetting, ISBN assignment, printing, distribution and royalty management.
- In-house printing facility and warehouse in Delhi; print partners Repro India and Epitome Books.`;

export const TONE_GUIDELINES = `- Empathetic and professional. Authors are partners, not customers to be managed.
- Acknowledge the author's concern before moving to solutions.
- Be specific: use the actual numbers, dates and statuses from ACCOUNT FACTS instead of vague reassurance.
- If something is BookLeaf's fault (delayed royalties, ISBN error), own it directly. No corporate deflection.
- If the issue needs escalation or investigation, give a clear timeline (e.g. "within 48 hours"), never an open-ended promise.
- Never blame the author, even when a delay is on their side; frame it collaboratively.
- Always end with a clear next step for the author and/or the BookLeaf team.`;

const POLICIES = {
  royalty_payments: `ROYALTY POLICY
- 80/20 split: 80% of net profit per book goes to the author, 20% to BookLeaf.
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart) and shipping charges.
- Royalties are calculated quarterly and paid within 45 days of the quarter ending.
- Minimum payout threshold is Rs 1,000; smaller balances roll over to the next quarter.
- Payouts go by bank transfer to the account linked in the author's dashboard.
- Authors can see a detailed royalty breakdown, with sales per platform, in their dashboard.`,

  isbn_metadata: `ISBN POLICY
- Every BookLeaf book gets a unique ISBN assigned by BookLeaf, registered under BookLeaf's publisher imprint.
- Authors who want an ISBN under their own imprint must obtain it independently.
- ISBN errors (duplicate, wrong book linked, mismatch between listing and print) are high priority and escalated to the production team.
METADATA
- Metadata (description, author bio, etc.) can be updated after a book is live, via the dashboard or by emailing the BookLeaf team.
- Changes typically reflect on platforms within 3-5 business days.`,

  printing_quality: `PRINTING & QUALITY
- Most orders are printed in-house in Delhi; overflow or special formats go to Repro India or Epitome Books.
- Standard print turnaround: 5-7 business days from order confirmation.
- Quality issues (misprints, binding defects, colour inconsistency): BookLeaf arranges a free reprint after verification.
- The author may need to share photos of the defective copy for verification.`,

  distribution_availability: `DISTRIBUTION & AVAILABILITY
- Books are listed on Amazon India, Flipkart, Amazon US, Amazon UK and the BookLeaf Store.
- New listings typically go live within 7-10 business days after publication is complete.
- "Unavailable" on a platform usually means a stock sync issue; BookLeaf can trigger a re-sync that takes 24-48 hours.`,

  book_status_production: `PRODUCTION STAGES
- Manuscript Received -> Editing (if opted) -> Cover Design -> Typesetting -> Proofreading -> ISBN Assignment -> Printing -> Distribution Setup -> Published & Live.
- Authors are emailed at each stage.
- Delays usually happen at Cover Design (waiting for author approval) and Proofreading (revision rounds).`,
};

// General questions can touch any area, so they get a one-line summary of each policy.
POLICIES.general_inquiry = `POLICY SUMMARY
- Royalties: 80% of net profit (MRP minus printing, platform commission, shipping) to the author; calculated quarterly, paid within 45 days of quarter end; Rs 1,000 minimum payout, smaller balances roll over.
- ISBN: assigned by BookLeaf under its imprint; errors are escalated to production as high priority.
- Metadata updates (description, bio): via dashboard or email; reflect on platforms in 3-5 business days.
- Printing: 5-7 business days; free reprint for verified quality defects.
- Distribution: Amazon India, Flipkart, Amazon US, Amazon UK, BookLeaf Store; new listings live in 7-10 business days; "unavailable" is usually a stock sync fixed within 24-48 hours.
- Production: Manuscript -> Editing -> Cover Design -> Typesetting -> Proofreading -> ISBN -> Printing -> Distribution Setup -> Published & Live.`;

// One calibration example per category, taken from BookLeaf's own guidance.
const EXAMPLES = {
  royalty_payments: `Query: "I published my book 4 months ago and still haven't received any royalty."
Good reply: acknowledges the frustration, explains the quarterly cycle and 45-day payout window, asks the author to confirm bank details are linked, gives the specific next payout date, and if the payment is genuinely overdue escalates with a 48-hour resolution timeline.

Query: "I sold 200 copies but only received Rs 3,000."
Good reply: explains net profit (MRP minus printing, platform commission, shipping) without being defensive, and offers a detailed line-by-line royalty breakdown.`,

  isbn_metadata: `Query: "My book shows a different ISBN on Amazon than on the physical copy."
Good reply: treats it as high priority, acknowledges it is a serious data issue that BookLeaf owns, confirms immediate escalation to the production team, and commits to a 48-hour resolution.`,

  printing_quality: `Query: "My author copies arrived with blurry images and misaligned pages."
Good reply: apologises sincerely, asks for photos of the defective copies, confirms a free reprint once verified, and gives a 5-7 business day reprint timeline.`,

  distribution_availability: `Query: "My book is published but shows 'Currently Unavailable' on Amazon."
Good reply: explains this is typically a stock sync issue, confirms a re-sync is being triggered with the distribution team, and sets a 24-48 hour expectation.`,

  book_status_production: `Query: "It's been 3 weeks and my book is still in typesetting."
Good reply: states the actual current stage, is honest about the reason for any delay (e.g. waiting on proof approval) without blaming the author, and gives a specific updated timeline.`,

  general_inquiry: `Query: "Can I update my book description on Amazon after it's live?"
Good reply: yes, via the dashboard or by emailing the team; changes reflect on platforms within 3-5 business days.`,
};

export function knowledgeFor(category) {
  const key = POLICIES[category] ? category : 'general_inquiry';
  return { policy: POLICIES[key], example: EXAMPLES[key] };
}
