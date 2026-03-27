import { addFunction } from '@apexdesigner/dsl';
import createDebug from 'debug';

const Debug = createDebug('OpenLibrary');

/**
 * Open Library Find By Id
 *
 * Fetches a single entity from the Open Library API by its key.
 * Handles both Author and Work entity types.
 *
 * @param entity - The entity name to fetch
 * @param id - The Open Library key
 * @returns The matching record or null
 */
addFunction(
  { layer: 'Server' },
  async function openLibraryFindById(entity: string, id: string): Promise<any | null> {
    const debug = Debug.extend('findById');
    debug('entity %s, id %s', entity, id);

    const baseUrl = 'https://openlibrary.org';

    if (entity === 'OpenLibraryAuthor') {
      const response = await fetch(`${baseUrl}/authors/${id}.json`);
      if (!response.ok) return null;
      const doc = await response.json();
      debug('author %j', doc.name);

      return {
        id: doc.key?.replace('/authors/', '') || id,
        name: doc.name || doc.personal_name,
        birthDate: doc.birth_date || null,
        topWork: doc.top_work || null,
        workCount: null,
      };
    }

    if (entity === 'OpenLibraryWork') {
      const response = await fetch(`${baseUrl}/works/${id}.json`);
      if (!response.ok) return null;
      const doc = await response.json();
      debug('work %j', doc.title);

      return {
        id: doc.key?.replace('/works/', '') || id,
        title: doc.title,
        firstPublishYear: null,
        authorId: doc.authors?.[0]?.author?.key?.replace('/authors/', '') || null,
      };
    }

    debug('unknown entity %s', entity);
    return null;
  },
);
