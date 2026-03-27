import { BusinessObject, relationship } from '@apexdesigner/dsl';
import { OpenLibraryAuthor, User } from '@business-objects';

/**
 * Favorite Author
 *
 * Stores a favorite Open Library author.
 * Cross-data-source: lives in Postgres, references a Custom data source entity.
 */
export class FavoriteAuthor extends BusinessObject {
  /** Id - Primary key */
  id!: number;

  /** Author - The favorited Open Library author */
  @relationship({ type: 'References' })
  author?: OpenLibraryAuthor;

  /** Author Id - Open Library author key */
  authorId?: string;
}
