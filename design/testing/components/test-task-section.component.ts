import { Component, component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { TestTaskFormGroup, TestTask } from '@business-objects-client';

/**
 * Test Task Section
 *
 * Custom section component for TestTask entities in accordions and forms.
 * Displays task fields in a compact layout.
 */
@component({ sectionEntity: TestTask })
export class TestTaskSectionComponent extends Component {
  /** Group - The form group for the task */
  @property({ isInput: true })
  group!: TestTaskFormGroup;

  /** Hide Help Texts */
  @property({ isInput: true })
  hideHelpTexts?: boolean;

  /** Placeholders */
  @property({ isInput: true })
  placeholders?: any;
}

applyTemplate(TestTaskSectionComponent, [
  {
    element: 'flex-row',
    attributes: { gap: '<- 16' },
    contains: [
      { element: 'sf-field', name: 'statusField', attributes: { control: '<- group.controls.status', style: 'flex: 1' } },
      { element: 'sf-field', name: 'nameField', attributes: { control: '<- group.controls.name', style: 'flex: 2' } }
    ]
  }
]);
