import { InterfaceDefinition } from '@apexdesigner/dsl';

/**
 * Test Summary
 *
 * Summary information for a test item. Used to test interface definition
 * return types in behaviors.
 */
export class TestSummary extends InterfaceDefinition {
  /** Name - Item name */
  name?: string;

  /** Count - Number of related items */
  count?: number;

  /** Status - Current status */
  status?: string;
}
