import { Component, property, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray, PersistedFormGroup } from '@business-objects-client';
import { ImportTsvDialogComponent } from '@components';

/**
 * Import Tsv Button
 *
 * An icon button that opens a dialog for importing tab-separated values
 * into a business object array.
 */
export class ImportTsvButtonComponent extends Component {
  /** The persisted array to import items into. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Parent business object for setting foreign key relationships. */
  @property({ isInput: true })
  parentObject?: PersistedFormGroup;

  /** Custom TSV template for the import dialog. */
  @property({ isInput: true })
  customTemplate?: string;

  /** Custom function to override standard TSV parsing. */
  @property({ isInput: true })
  tsvHandler?: (rows: string[][]) => Promise<void>;

  /** Import Dialog Reference */
  importDialog!: ImportTsvDialogComponent;
}

applyTemplate(ImportTsvButtonComponent, [
  {
    element: 'import-tsv-dialog',
    name: 'importDialog',
    referenceable: true,
    attributes: {
      array: '<- array',
      parentObject: '<- parentObject',
      customTemplate: '<- customTemplate',
      tsvHandler: '<- tsvHandler'
    }
  },
  {
    element: 'button',
    name: 'importButton',
    attributes: {
      'mat-icon-button': null,
      matTooltip: 'Import',
      click: '-> importDialog.open()'
    },
    contains: [{ 'mat-icon': 'upload' }]
  }
]);
