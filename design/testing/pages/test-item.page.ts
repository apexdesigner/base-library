import { Page, page, property, method, applyTemplate } from '@apexdesigner/dsl/page';
import { TestItemFormGroup } from '@business-objects-client';
import { EditDialogComponent } from '@components';
import { ErrorDialogComponent } from '@components';
import { TestItemsPage } from '@pages';
import createDebug from 'debug';

const debug = createDebug('TestItemPage');

/**
 * Test Item
 *
 * Test item detail page.
 */
@page({
  path: '/test-items/:testItem.id',
  parentPage: TestItemsPage
})
export class TestItemPage extends Page {
  /** Test Item - Current test item record */
  @property({
    read: 'Automatically',
    save: 'Automatically',
    include: { testSetting: {}, testItemDetail: {} }
  })
  testItem!: TestItemFormGroup;

  /** Test Error Messages */
  testErrors: string[] = ['First error message', 'Second error message'];

  /** Edit Dialog Reference */
  editDialog!: EditDialogComponent;

  /** Error Dialog Reference */
  errorDialog!: ErrorDialogComponent;

  /** On Confirm Test - Log that the confirm directive fired */
  onConfirmTest(): void {
    debug('confirm directive fired');
  }
}

applyTemplate(TestItemPage, [
  {
    if: '!testItem.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          { h1: '{{testItem.value.name}}' },
          { element: 'sf-fields', name: 'topFields', attributes: { group: '<- testItem' } },
          {
            element: 'edit-dialog',
            name: 'editDialog',
            referenceable: true,
            attributes: { object: '<- testItem', allowDelete: '<- true' },
          },
          {
            element: 'button',
            name: 'openEditDialog',
            text: 'Test Edit Dialog',
            attributes: { 'mat-raised-button': null, click: '-> editDialog.open()' },
          },
          {
            element: 'error-dialog',
            name: 'errorDialog',
            referenceable: true,
            attributes: { messages: '<- testErrors' },
          },
          {
            element: 'button',
            name: 'openErrorDialog',
            text: 'Test Error Dialog',
            attributes: { 'mat-raised-button': null, color: 'warn', click: '-> errorDialog.open()' },
          },
          {
            element: 'button',
            name: 'confirmTest',
            text: 'Test Confirm',
            attributes: {
              'mat-raised-button': null,
              color: 'accent',
              confirm: '-> onConfirmTest()',
              confirmMessage: 'Are you sure you want to do this?',
            },
          },
          {
            if: 'testItem.controls.testItemDetail',
            name: 'detailSection',
            contains: [{ h2: 'Detail' }, { element: 'sf-fields', name: 'detailFields', attributes: { group: '<- testItem.controls.testItemDetail' } }]
          },
          {
            if: 'testItem.value.testSetting',
            name: 'settingSection',
            contains: [
              {
                element: 'div',
                contains: [
                  { strong: 'Setting:' },
                  {
                    element: 'a',
                    text: '{{testItem.value.testSetting.name}}',
                    attributes: { routerLink: "<- '/test-settings/' + testItem.value.testSetting.id" }
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    elseContains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }]
  }
]);
