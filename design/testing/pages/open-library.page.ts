import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { OpenLibraryAuthorPersistedArray } from '@business-objects-client';
import { SearchBarComponent } from '@components';

/**
 * Open Library
 *
 * Test page for the Open Library custom data source.
 * Search for authors and view their works.
 */
@page({ path: '/open-library' })
export class OpenLibraryPage extends Page {
  /** Authors - List of Open Library authors */
  @property({
    read: 'Automatically',
    include: { openLibraryWorks: {} },
  })
  authors!: OpenLibraryAuthorPersistedArray;
}

applyTemplate(OpenLibraryPage, [
  {
    element: 'flex-column',
    contains: [
      { h1: 'Open Library Authors' },
      {
        element: 'search-bar',
        attributes: { array: '<- authors' },
      },
      {
        if: '!authors.reading',
        name: 'loaded',
        contains: [
          {
            element: 'accordion',
            attributes: {
              array: '<- authors',
              hideAdd: '<- true',
            },
          },
        ],
      },
    ],
  },
]);
