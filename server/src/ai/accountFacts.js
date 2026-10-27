// Turns raw book rows into short, pre-computed facts for the prompt. Doing the
// date and threshold maths here keeps the model from getting it wrong and keeps
// the prompt small.

const PAYOUT_WINDOW_DAYS = 45;
const MIN_PAYOUT = 1000;
const PRODUCTION_STAGES = [
  'Manuscript Received',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
];

const inr = (amount) => `Rs ${Number(amount).toLocaleString('en-IN')}`;

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function quarterLabel(startMonth, year) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[startMonth]}-${months[startMonth + 2]} ${year}`;
}

const previousQuarter = ({ startMonth, year }) =>
  startMonth === 0 ? { startMonth: 9, year: year - 1 } : { startMonth: startMonth - 3, year };

// Day 0 of the month after the quarter is the quarter's last day.
const payoutDeadline = ({ startMonth, year }) => new Date(Date.UTC(year, startMonth + 3, PAYOUT_WINDOW_DAYS));

/** Payout deadlines for the last completed quarter and the current one. */
export function royaltySchedule(today = new Date()) {
  const currentQ = { startMonth: Math.floor(today.getUTCMonth() / 3) * 3, year: today.getUTCFullYear() };
  const previousQ = previousQuarter(currentQ);

  const previous = { label: quarterLabel(previousQ.startMonth, previousQ.year), payoutBy: payoutDeadline(previousQ) };
  const current = { label: quarterLabel(currentQ.startMonth, currentQ.year), payoutBy: payoutDeadline(currentQ) };

  // Early in a quarter the previous quarter's payout is not yet due.
  const twoBackQ = previousQuarter(previousQ);
  const lastPassed =
    previous.payoutBy <= today
      ? previous
      : { label: quarterLabel(twoBackQ.startMonth, twoBackQ.year), payoutBy: payoutDeadline(twoBackQ) };

  return { previous, current, lastPassed };
}

const nextPayout = (schedule, today) => (schedule.previous.payoutBy > today ? schedule.previous : schedule.current);

function royaltyFacts(book, schedule) {
  if (book.total_copies_sold === 0 && Number(book.total_royalty_earned) === 0) {
    return ['No sales or royalties recorded yet.'];
  }

  const pending = Number(book.royalty_pending);
  const facts = [
    `Copies sold: ${book.total_copies_sold}; author royalty per copy: ${inr(book.author_royalty_per_copy)}.`,
    `Royalty earned: ${inr(book.total_royalty_earned)}; paid: ${inr(book.royalty_paid)}; pending: ${inr(pending)}.`,
    book.last_royalty_payout_date
      ? `Last payout: ${formatDate(new Date(book.last_royalty_payout_date))}.`
      : 'No royalty payout has been made for this book yet.',
  ];

  if (pending > 0 && pending < MIN_PAYOUT) {
    facts.push(
      `BELOW THRESHOLD: pending ${inr(pending)} is under the ${inr(MIN_PAYOUT)} minimum payout. It is not paid in the next payout; it keeps rolling over each quarter and is paid in the first payout after the accumulated balance reaches ${inr(MIN_PAYOUT)}.`,
    );
  }

  const lastPayout = book.last_royalty_payout_date ? new Date(book.last_royalty_payout_date) : null;
  const { lastPassed } = schedule;
  if (pending >= MIN_PAYOUT && (!lastPayout || lastPayout < lastPassed.payoutBy)) {
    facts.push(
      `POSSIBLY OVERDUE: ${lastPassed.label} royalties were due by ${formatDate(lastPassed.payoutBy)} (already passed) and no payout is recorded since, although the pending balance is above the threshold. Needs verification by the finance team.`,
    );
  }
  return facts;
}

function productionFacts(book) {
  const stage = book.status.replace(/^In Production - /, '');
  const index = PRODUCTION_STAGES.indexOf(stage);
  const facts = [`Book is not published yet. Current production stage: ${stage}.`];
  if (index >= 0) {
    facts.push(`Remaining stages: ${PRODUCTION_STAGES.slice(index + 1).join(' -> ')}.`);
  }
  if (stage === 'Cover Design' || stage === 'Proofreading') {
    facts.push(`${stage} commonly waits on author approval or revision rounds.`);
  }
  facts.push(
    'Not recorded here: when this stage started, what was last sent to the author, the cause of any delay, or how long each stage takes.',
    'Handling: state the current stage and remaining stages, mention collaboratively that this stage often involves author approval, and say the production team will confirm the exact status and a specific completion date within 48 hours.',
  );
  return facts;
}

// Royalty figures only help on money questions; elsewhere they distract the
// model into raising unrelated issues and cost tokens.
const ROYALTY_CATEGORIES = new Set(['royalty_payments', 'general_inquiry']);

/** Facts about the single book the ticket is about (or the author's catalogue for general tickets). */
export function buildAccountFacts({ authorName, category, book, otherBooks = [], today = new Date() }) {
  const includeRoyalties = ROYALTY_CATEGORIES.has(category);
  const schedule = royaltySchedule(today);
  const upcoming = nextPayout(schedule, today);
  const lines = [`Today: ${formatDate(today)}.`, `Author: ${authorName}.`];
  if (includeRoyalties) {
    lines.push(
      `Next scheduled royalty payout (upcoming, not yet due): ${upcoming.label} royalties, to be paid by ${formatDate(upcoming.payoutBy)}.`,
    );
  }

  if (book) {
    const isPublished = book.status === 'Published & Live';
    lines.push(`Book: "${book.title}" (ISBN ${book.isbn ?? 'not assigned'}, ${book.genre ?? 'genre n/a'}). Status: ${book.status}.`);
    if (isPublished) {
      lines.push(
        `Published ${book.publication_date ? formatDate(new Date(book.publication_date)) : 'date unknown'}; MRP ${inr(book.mrp)}; printed by ${book.print_partner ?? 'n/a'}.`,
        `Available on: ${book.available_on?.length ? book.available_on.join(', ') : 'no platforms listed'}.`,
        ...(includeRoyalties ? royaltyFacts(book, schedule) : []),
      );
    } else {
      lines.push(...productionFacts(book));
    }
  } else if (otherBooks.length) {
    // General ticket: a one-line summary per book is enough context.
    lines.push('Ticket is not about a specific book. Author catalogue:');
    for (const b of otherBooks) {
      lines.push(`- "${b.title}": ${b.status}${includeRoyalties ? `; royalty pending ${inr(b.royalty_pending)}` : ''}.`);
    }
  }

  return lines.join('\n');
}
