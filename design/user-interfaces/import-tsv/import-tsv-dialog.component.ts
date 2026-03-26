import { Component, component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray, PersistedFormGroup } from '@business-objects-client';
import { BusinessObjectService } from '@services';
import createDebug from 'debug';

const debug = createDebug('ImportTsvDialogComponent');

/**
 * Import Tsv Dialog
 *
 * A Material dialog that handles TSV file upload, parsing, column matching,
 * and importing records into a business object array.
 */
@component({ isDialog: true })
export class ImportTsvDialogComponent extends Component {
  /** The persisted array to import items into. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Parent business object for setting foreign key relationships. */
  @property({ isInput: true })
  parentObject?: PersistedFormGroup;

  /** Custom TSV template text shown in the dialog. */
  @property({ isInput: true })
  customTemplate?: string;

  /** Custom function to override standard TSV parsing. */
  @property({ isInput: true })
  tsvHandler?: (rows: string[][]) => Promise<void>;

  /** Business Object Service */
  businessObjectService!: BusinessObjectService;

  /** TSV Text */
  tsvText = '';

  /** Importing */
  importing = false;

  /** Result Message */
  resultMessage = '';

  /** Import - Parse TSV and create records */
  async import(): Promise<void> {
    if (!this.tsvText.trim()) return;

    this.importing = true;
    this.resultMessage = '';

    try {
      const lines = this.tsvText.trim().split('\n');
      const rows = lines.map((line) => line.split('\t'));

      if (this.tsvHandler) {
        await this.tsvHandler(rows);
        this.resultMessage = 'Import complete (custom handler).';
      } else {
        const headers = rows[0];
        const dataRows = rows.slice(1);
        let count = 0;

        for (const row of dataRows) {
          const data: Record<string, any> = {};
          headers.forEach((header, i) => {
            if (i < row.length && row[i] !== '') {
              data[header.trim()] = row[i];
            }
          });

          if (this.parentObject) {
            const fk = this.array.entityName.charAt(0).toLowerCase() + this.array.entityName.slice(1) + 'Id';
            if ((this.parentObject as any).value?.id) {
              data[fk] = (this.parentObject as any).value.id;
            }
          }

          await this.array.add(data);
          count++;
        }

        this.resultMessage = 'Imported ' + count + ' record(s).';
      }
    } catch (err: any) {
      this.resultMessage = 'Error: ' + (err.message || err);
      debug('import error %o', err);
    } finally {
      this.importing = false;
    }
  }
}

applyTemplate(ImportTsvDialogComponent, [
  {
    'mat-dialog-content': [
      {
        if: 'customTemplate',
        name: 'templateHint',
        contains: [{ element: 'p', text: '{{customTemplate}}' }],
      },
      {
        element: 'mat-form-field',
        attributes: { style: 'width: 100%' },
        contains: [
          { 'mat-label': 'Paste TSV data' },
          {
            element: 'textarea',
            name: 'tsvInput',
            attributes: { matInput: null, rows: '<- 10', ngModel: '<-> tsvText' },
          },
        ],
      },
      {
        if: 'resultMessage',
        name: 'result',
        contains: [{ element: 'p', text: '{{resultMessage}}' }],
      },
      {
        if: 'importing',
        name: 'progress',
        contains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }],
      },
    ],
  },
  {
    'mat-dialog-actions': [
      {
        element: 'button',
        name: 'cancelButton',
        text: 'Close',
        attributes: { 'mat-button': null, click: '-> dialog.close()' },
      },
      { element: 'span', attributes: { grow: null } },
      {
        element: 'button',
        name: 'importButton',
        text: 'Import',
        attributes: { 'mat-raised-button': null, color: 'primary', click: '-> import()', disabled: '<- importing || !tsvText.trim()' },
      },
    ],
  },
]);
