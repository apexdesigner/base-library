import { BaseType, applyValidation } from '@apexdesigner/dsl';

/**
 * Semantic Version
 *
 * Version string in semver format.
 */
export class SemanticVersion extends BaseType<string> {}

applyValidation(SemanticVersion, {
  pattern: '^\\d+\\.\\d+\\.\\d+(-[\\w.]+)?(\\+[\\w.]+)?$',
  patternMessage: 'Must be a valid semantic version (e.g. 1.2.3)'
});
