import { BaseType, setPropertyDefaults } from '@apexdesigner/dsl';

/**
 * JSON
 *
 * Arbitrary JSON data stored as JSONB.
 */
export class Json extends BaseType<any> {}

setPropertyDefaults(Json, { column: 'jsonb', presentAs: 'json' });
