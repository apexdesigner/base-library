import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';

/**
 * Duration
 *
 * Time duration value.
 */
export class Duration extends BaseType<string> {}

setPropertyDefaults(Duration, { presentAs: 'duration' });
