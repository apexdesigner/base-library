import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { OpenLibraryAuthorPersistedArray } from '@business-objects-client';
import { FavoriteAuthor } from '@business-objects-client';
import createDebug from 'debug';

const debug = createDebug('OpenLibraryAuthorsPage');

/**
 * Open Library Authors
 *
 * Test page for the Open Library custom data source.
 * Search for authors and mark favorites (cross-data-source reference).
 */
@page({ path: '/open-library-authors' })
export class OpenLibraryAuthorsPage extends Page {
  /** Authors - List of Open Library authors with favorite status included */
  @property({ read: 'On Demand', include: { favoriteAuthor: {} } })
  authors!: OpenLibraryAuthorPersistedArray;

  /** Search Text */
  searchText = '';

  /** Search - Search authors by name */
  async search(): Promise<void> {
    const text = this.searchText.trim();
    debug('text %j', text);

    if (!text) return;

    this.authors.readFilter = { ...this.authors.readFilter, where: { name: { ilike: '%' + text + '%' } } };
    await this.authors.read();
  }

  /** Toggle Favorite - Add or remove a favorite for an author */
  async toggleFavorite(author: any): Promise<void> {
    debug('author.id %j', author.id);
    debug('author.favoriteAuthor %j', author.favoriteAuthor);

    if (author.favoriteAuthor) {
      await FavoriteAuthor.deleteById(author.favoriteAuthor.id);
    } else {
      await FavoriteAuthor.create({ authorId: author.id });
    }

    await this.authors.read();
  }
}

applyTemplate(OpenLibraryAuthorsPage, [
  {
    element: 'flex-column',
    contains: [
      { h1: 'Open Library Authors' },
      {
        element: 'mat-form-field',
        attributes: { style: 'width: 100%' },
        contains: [
          { 'mat-icon': 'search', attributes: { matPrefix: null } },
          {
            element: 'input',
            name: 'searchInput',
            attributes: {
              matInput: null,
              placeholder: 'Search authors by name',
              ngModel: '<-> searchText',
              'keyup.enter': '-> search()',
            },
          },
        ],
      },
      {
        if: 'authors.reading',
        name: 'loading',
        contains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }],
      },
      {
        if: '!authors.reading && authors.length > 0',
        name: 'loaded',
        contains: [
          {
            element: 'mat-action-list',
            contains: [
              {
                for: 'author',
                of: 'authors',
                contains: [
                  {
                    element: 'div',
                    attributes: { style: 'display: flex; align-items: center; padding: 8px 0' },
                    contains: [
                      {
                        element: 'button',
                        name: 'favoriteButton',
                        attributes: {
                          'mat-icon-button': null,
                          click: '-> toggleFavorite(author)',
                        },
                        contains: [
                          {
                            'mat-icon': "{{author.favoriteAuthor ? 'star' : 'star_border'}}",
                            attributes: {
                              'style.color': "<- author.favoriteAuthor ? 'gold' : 'gray'",
                            },
                          },
                        ],
                      },
                      {
                        element: 'a',
                        attributes: { routerLink: "<- '/open-library-authors/' + author.id", style: 'flex: 1; text-decoration: none; color: inherit' },
                        contains: [
                          {
                            element: 'flex-row',
                            attributes: { gap: '<- 16', alignCenter: true },
                            contains: [
                              { element: 'span', text: '{{author.name}}', attributes: { style: 'font-weight: 500; min-width: 200px' } },
                              { element: 'span', text: '{{author.topWork}}', attributes: { style: 'color: gray; flex: 1' } },
                              { element: 'span', text: '{{author.workCount}} works', attributes: { style: 'color: gray' } },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);
