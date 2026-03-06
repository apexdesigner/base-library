import { Response } from 'express';
import { hasRole } from '../functions/has-role.js';

/**
 * Check that the current user has at least one of the given roles.
 * Returns true if the request was rejected (caller should return early).
 */
export function missingRole(res: Response, ...roleNames: string[]): boolean {
  if (roleNames.some(name => hasRole(name))) return false;

  res.status(403).json({ error: 'Forbidden' });
  return true;
}
