import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';

/**
 * Status
 *
 * A status string that auto-formats to Capital Case.
 */
export class Status extends BaseType<string> {}

setPropertyDefaults(Status, { autoFormat: 'capitalCase' });
