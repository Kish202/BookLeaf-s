import * as authService from '../services/auth.service.js';

export async function login(req, res) {
  const { email, password } = req.validated.body;
  const result = await authService.login(email, password);
  res.json(result);
}

export async function me(req, res) {
  const user = await authService.getUserById(req.user.id);
  res.json({ user });
}
