import { BusinessObject, property } from '@apexdesigner/dsl';
import { applyOpenLibraryDataSource } from '@data-sources';
import { OpenLibraryAuthor } from '@business-objects';

/**
 * Open Library Work
 *
 * A literary work from the Open Library API.
 */
export class OpenLibraryWork extends BusinessObject {
  /** Id - Open Library work key */
  @property({ isId: true })
  id!: string;

  /** Title - Work title */
  title?: string;

  /** First Publish Year - Year the work was first published */
  firstPublishYear?: number;

  /** Author - The primary author of this work */
  author?: OpenLibraryAuthor;
  /** Author Id - Foreign key to the author */
  authorId!: string;
}

applyOpenLibraryDataSource(OpenLibraryWork);
