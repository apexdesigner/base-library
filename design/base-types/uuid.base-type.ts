import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';

/**
 * UUID
 *
 * Universally unique identifier string.
 */
export class Uuid extends BaseType<string> {}

setPropertyDefaults(Uuid, { column: 'UUID' });
