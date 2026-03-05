import { BaseType, applyValidation } from '@apexdesigner/dsl';

/**
 * Zip Code
 *
 * US ZIP code string with optional +4 format.
 */
export class ZipCode extends BaseType<string> {}

applyValidation(ZipCode, {
  pattern: '^\\d{5}(-\\d{4})?$',
  patternMessage: 'Must be a valid US ZIP code'
});
