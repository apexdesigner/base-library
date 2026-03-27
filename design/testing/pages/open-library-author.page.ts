import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { OpenLibraryAuthorFormGroup } from '@business-objects-client';
import { OpenLibraryAuthorsPage } from '@pages';

/**
 * Open Library Author
 *
 * Detail page for an Open Library author showing their info and works.
 */
@page({
  path: '/open-library-authors/:author.id',
  parentPage: OpenLibraryAuthorsPage,
})
export class OpenLibraryAuthorPage extends Page {
  /** Author - The current author */
  @property({
    read: 'Automatically',
    include: { openLibraryWorks: {} },
  })
  author!: OpenLibraryAuthorFormGroup;
}

applyTemplate(OpenLibraryAuthorPage, [
  {
    if: 'author.reading',
    name: 'loading',
    contains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }],
  },
  {
    if: '!author.reading',
    name: 'loaded',
    contains: [
      {
        element: 'flex-column',
        contains: [
          { h1: '{{author.value.name}}' },
          {
            if: 'author.value.birthDate',
            name: 'birthDate',
            contains: [{ element: 'p', text: 'Born: {{author.value.birthDate}}' }],
          },
          {
            if: 'author.value.topWork',
            name: 'topWork',
            contains: [{ element: 'p', text: 'Top Work: {{author.value.topWork}}' }],
          },
          { h2: 'Works' },
          {
            element: 'dt-table',
            attributes: { dataSource: '<- author.value.openLibraryWorks' },
            contains: [
              { element: 'dt-column', name: 'title', attributes: { property: 'title', header: 'Title' } },
              { element: 'dt-column', name: 'firstPublishYear', attributes: { property: 'firstPublishYear', header: 'Published' } },
            ],
          },
        ],
      },
    ],
  },
]);
