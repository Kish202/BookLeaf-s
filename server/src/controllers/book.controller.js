import * as bookService from '../services/book.service.js';

export async function list(req, res) {
  res.json(await bookService.listBooks(req.user, req.validated.query));
}

export async function get(req, res) {
  res.json({ data: await bookService.getBook(req.user, req.validated.params.id) });
}
