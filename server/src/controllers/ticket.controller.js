import * as ticketService from '../services/ticket.service.js';

export async function list(req, res) {
  res.json(await ticketService.listTickets(req.user, req.validated.query));
}

export async function get(req, res) {
  res.json({ data: await ticketService.getTicket(req.user, req.validated.params.id) });
}

export async function create(req, res) {
  const ticket = await ticketService.createTicket(req.user, req.validated.body);
  res.status(201).location(`/api/tickets/${ticket.id}`).json({ data: ticket });
}

export async function update(req, res) {
  res.json({ data: await ticketService.updateTicket(req.user, req.validated.params.id, req.validated.body) });
}

export async function addMessage(req, res) {
  const result = await ticketService.addMessage(req.user, req.validated.params.id, req.validated.body);
  res.status(201).json({ data: result });
}

export async function addNote(req, res) {
  const note = await ticketService.addNote(req.user, req.validated.params.id, req.validated.body.body);
  res.status(201).json({ data: note });
}
