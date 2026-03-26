import { Component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedFormGroup } from '@business-objects-client';
import { BusinessObjectService } from '@services';
import { Router } from '@angular/router';

/**
 * Delete Button
 *
 * An icon button that deletes a business object with a confirmation prompt.
 * After deletion, navigates to the specified route.
 */
export class DeleteButtonComponent extends Component {
  /** Object - The business object to delete */
  @property({ isInput: true })
  object!: PersistedFormGroup;

  /** After Delete Route - Path to navigate to after deletion */
  @property({ isInput: true })
  afterDeleteRoute!: string;

  /** Router */
  router!: Router;

  /** Business Object Service */
  businessObjectService!: BusinessObjectService;

  /** Deleting */
  deleting = false;

  /** Delete - Delete the object and navigate */
  async delete(): Promise<void> {
    this.deleting = true;
    try {
      const entityClass = await this.businessObjectService.loadEntity(this.object.constructor.name.replace(/FormGroup$/, ''));
      await entityClass.deleteById(this.object.value.id);
      if (this.afterDeleteRoute) {
        this.router.navigateByUrl(this.afterDeleteRoute);
      }
    } finally {
      this.deleting = false;
    }
  }
}

applyTemplate(DeleteButtonComponent, [
  {
    if: '!deleting',
    name: 'ready',
    contains: [
      {
        element: 'button',
        name: 'deleteButton',
        attributes: {
          'mat-icon-button': null,
          color: 'warn',
          confirm: '-> delete()',
          confirmMessage: '<- "Are you sure you want to delete this?"',
          disabled: '<- object?.disabled',
        },
        contains: [{ 'mat-icon': 'delete_outline' }],
      },
    ],
  },
  {
    if: 'deleting',
    name: 'spinner',
    contains: [{ element: 'mat-spinner', attributes: { diameter: '<- 24' } }],
  },
]);
