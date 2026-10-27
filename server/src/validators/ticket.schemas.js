import { z } from 'zod';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../constants/tickets.js';
import { csvEnum, paginationSchema } from './common.schemas.js';

const messageBody = z
  .string({ error: 'Message is required' })
  .trim()
  .min(1, 'Message cannot be empty')
  .max(5000, 'Message must be 5000 characters or fewer');

export const createTicketSchema = z.object({
  // null / omitted means "General / Account Level"
  bookId: z.string().trim().min(1).max(20).nullish().transform((value) => value ?? null),
  subject: z
    .string({ error: 'Subject is required' })
    .trim()
    .min(5, 'Subject must be at least 5 characters')
    .max(150, 'Subject must be 150 characters or fewer'),
  description: z
    .string({ error: 'Description is required' })
    .trim()
    .min(20, 'Please describe the issue in at least 20 characters')
    .max(5000, 'Description must be 5000 characters or fewer'),
  attachmentName: z.string().trim().max(255).nullish().transform((value) => value ?? null),
});

export const listTicketsQuerySchema = z.object({
  status: csvEnum(TICKET_STATUSES).optional(),
  category: csvEnum(TICKET_CATEGORIES).optional(),
  priority: csvEnum(TICKET_PRIORITIES).optional(),
  assignedTo: z.union([z.enum(['me', 'unassigned']), z.coerce.number().int().positive()]).optional(),
  from: z.iso.date('from must be a date in YYYY-MM-DD format').optional(),
  to: z.iso.date('to must be a date in YYYY-MM-DD format').optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(['urgency', 'newest', 'oldest', 'updated']).default('urgency'),
  ...paginationSchema,
}).refine((q) => !q.from || !q.to || q.from <= q.to, {
  message: '`from` must be on or before `to`',
  path: ['from'],
});

export const updateTicketSchema = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    assignedTo: z.number().int().positive().nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one of: status, category, priority, assignedTo',
  });

export const createMessageSchema = z.object({
  body: messageBody,
  // Admin only: whether the reply started from the AI draft (used for reporting).
  aiAssisted: z.boolean().optional().default(false),
});

export const createNoteSchema = z.object({
  body: z
    .string({ error: 'Note is required' })
    .trim()
    .min(1, 'Note cannot be empty')
    .max(2000, 'Note must be 2000 characters or fewer'),
});
