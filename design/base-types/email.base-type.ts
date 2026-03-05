import { BaseType, applyValidation } from '@apexdesigner/dsl';

/**
 * Email
 *
 * Email address string.
 */
export class Email extends BaseType<string> {}

applyValidation(Email, {
  pattern: '^[^@]+@[^@]+\\.[^@]+$',
  patternMessage: 'Must be a valid email address'
});
