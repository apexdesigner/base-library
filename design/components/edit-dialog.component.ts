import { Component, component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedFormGroup } from '@business-objects-client';
import { EventEmitter } from '@angular/core';

/**
 * Edit Dialog
 *
 * A Material dialog for editing a business object inline. Opens as a modal,
 * auto-renders all fields using sf-fields, and optionally provides a delete
 * button. Used within list/table views to edit items without navigating away.
 */
@component({ isDialog: true })
export class EditDialogComponent extends Component {
  /** Object - The business object to edit */
  @property({ isInput: true })
  object!: PersistedFormGroup;

  /** Allow Delete - Show a delete button in the dialog actions */
  @property({ isInput: true })
  allowDelete = false;

  /** Deleted - Emitted after the object is deleted via the dialog */
  @property({ isOutput: true })
  deleted!: EventEmitter<void>;

  /** Delete - Delete the object and emit */
  async delete(): Promise<void> {
    await (this.object as any).delete();
    this.deleted.emit();
  }
}

applyTemplate(EditDialogComponent, [
  { 'mat-dialog-content': [{ element: 'sf-fields', attributes: { group: '<- object' } }] },
  {
    'mat-dialog-actions': [
      {
        if: 'allowDelete',
        contains: [
          {
            element: 'button',
            name: 'deleteButton',
            text: 'Delete',
            attributes: { 'mat-button': null, color: 'warn', click: '-> delete()' }
          }
        ]
      },
      { element: 'span', attributes: { grow: null } },
      {
        element: 'button',
        name: 'doneButton',
        text: 'Done',
        attributes: { 'mat-raised-button': null, click: '-> dialog.close()' }
      }
    ]
  }
]);
