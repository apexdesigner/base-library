import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';

/**
 * Currency
 *
 * Monetary currency value.
 */
export class Currency extends BaseType<number> {}

setPropertyDefaults(Currency, {
  presentAs: 'currency',
  column: { type: 'decimal', precision: 18, scale: 4 }
});
