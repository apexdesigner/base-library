import { addFunction } from '@apexdesigner/dsl';
import createDebug from 'debug';

const Debug = createDebug('OpenLibrary');

/**
 * Open Library Find By Id
 *
 * Fetches a single entity from the Open Library API by its key.
 * Handles both Author and Work entity types.
 *
 * @param persistence - The persistence instance for resolving includes
 * @param entity - The entity name to fetch
 * @param id - The Open Library key
 * @param filter - Optional filter for includes
 * @returns The matching record or null
 */
addFunction(
  { layer: 'Server' },
  async function openLibraryFindById(persistence: any, entity: string, id: string, filter?: any): Promise<any | null> {
    const debug = Debug.extend('findById');
    debug('entity %j', entity);
    debug('id %j', id);
    debug('filter %j', filter);

    const baseUrl = 'https://openlibrary.org';

    if (entity === 'OpenLibraryAuthor') {
      const url = `${baseUrl}/authors/${id}.json`;
      debug('url %j', url);

      const response = await fetch(url);
      debug('response.ok %j', response.ok);

      if (!response.ok) return null;

      const doc = await response.json();
      debug('doc.name %j', doc.name);

      const result = {
        id: doc.key?.replace('/authors/', '') || id,
        name: doc.name || doc.personal_name,
        birthDate: doc.birth_date || null,
        topWork: doc.top_work || null,
        workCount: null,
      };
      debug('result %j', result);

      return persistence.resolveIncludes(entity, result, filter?.include);
    }

    if (entity === 'OpenLibraryWork') {
      const url = `${baseUrl}/works/${id}.json`;
      debug('url %j', url);

      const response = await fetch(url);
      debug('response.ok %j', response.ok);

      if (!response.ok) return null;

      const doc = await response.json();
      debug('doc.title %j', doc.title);

      const result = {
        id: doc.key?.replace('/works/', '') || id,
        title: doc.title,
        firstPublishYear: null,
        authorId: doc.authors?.[0]?.author?.key?.replace('/authors/', '') || null,
      };
      debug('result %j', result);

      return persistence.resolveIncludes(entity, result, filter?.include);
    }

    debug('unknown entity %j', entity);
    return null;
  },
);
