import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../validators/common.schemas.js';
import {
  createMessageSchema,
  createNoteSchema,
  createTicketSchema,
  listTicketsQuerySchema,
  updateTicketSchema,
} from '../validators/ticket.schemas.js';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listTicketsQuerySchema }), ticketController.list);
router.post('/', authorize('author'), validate({ body: createTicketSchema }), ticketController.create);
router.get('/:id', validate({ params: idParamSchema }), ticketController.get);
router.patch(
  '/:id',
  authorize('admin'),
  validate({ params: idParamSchema, body: updateTicketSchema }),
  ticketController.update,
);
router.post(
  '/:id/messages',
  validate({ params: idParamSchema, body: createMessageSchema }),
  ticketController.addMessage,
);
router.post(
  '/:id/notes',
  authorize('admin'),
  validate({ params: idParamSchema, body: createNoteSchema }),
  ticketController.addNote,
);

export default router;
