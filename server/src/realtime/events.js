import { EventEmitter } from 'node:events';

// In-process pub/sub. Events only carry ids; clients re-fetch through the REST
// API, so access control stays in one place. A multi-instance deployment would
// swap this for Postgres LISTEN/NOTIFY or Redis.
const bus = new EventEmitter();
bus.setMaxListeners(0);

/**
 * audience: 'admins' for staff-only changes (classification, internal notes),
 * 'all' for changes the ticket's author should also see.
 */
export function publish({ type, ticketId, authorId, audience = 'all', ...extra }) {
  bus.emit('event', { type, ticketId, authorId, audience, ...extra, at: new Date().toISOString() });
}

function canReceive(user, event) {
  if (user.role === 'admin') return true;
  return event.audience === 'all' && event.authorId === user.authorId;
}

/** Subscribes a user to the events they are allowed to see; returns an unsubscribe function. */
export function subscribe(user, onEvent) {
  const listener = (event) => {
    if (canReceive(user, event)) {
      const { audience: _audience, authorId: _authorId, ...payload } = event;
      onEvent(payload);
    }
  };
  bus.on('event', listener);
  return () => bus.off('event', listener);
}
