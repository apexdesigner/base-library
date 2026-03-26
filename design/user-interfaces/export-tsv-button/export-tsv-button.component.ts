import { Component, property, method, applyTemplate } from '@apexdesigner/dsl/component';
import { PersistedArray, PersistedFormArray } from '@business-objects-client';
import { BusinessObjectService } from '@services';
import createDebug from 'debug';

const debug = createDebug('ExportTsvButtonComponent');

/**
 * Export Tsv Button
 *
 * An icon button that exports a business object array to a tab-separated
 * values (TSV) file. Downloads the file directly in the browser.
 */
export class ExportTsvButtonComponent extends Component {
  /** The persisted array to export. */
  @property({ isInput: true })
  array!: PersistedArray<any> | PersistedFormArray;

  /** Business Object Service */
  businessObjectService!: BusinessObjectService;

  /** Export - Build TSV and trigger download */
  export(): void {
    const metadata = this.businessObjectService.getMetadata(this.array.entityName);
    if (!metadata) {
      debug('no metadata for %s', this.array.entityName);
      return;
    }

    const properties = metadata.properties;
    const headers = properties.map((p) => p.name);
    const items = Array.isArray(this.array) ? this.array : (this.array as any).getRawValue();

    const rows = items.map((item: any) =>
      properties.map((p) => {
        const value = item[p.name];
        if (value == null) return '';
        const str = String(value);
        if (str.includes('\t') || str.includes('\n') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }),
    );

    const tsv = [headers.join('\t'), ...rows.map((r: string[]) => r.join('\t'))].join('\n');
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (metadata.displayName || this.array.entityName) + '.tsv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

applyTemplate(ExportTsvButtonComponent, [
  {
    element: 'button',
    name: 'exportButton',
    attributes: {
      'mat-icon-button': null,
      matTooltip: 'Export',
      click: '-> export()',
    },
    contains: [{ 'mat-icon': 'download' }],
  },
]);
