import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';

/**
 * Percentage
 *
 * Numeric percentage value.
 */
export class Percentage extends BaseType<number> {}

setPropertyDefaults(Percentage, { presentAs: 'percentage' });
