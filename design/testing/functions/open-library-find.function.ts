import { addFunction } from '@apexdesigner/dsl';
import createDebug from 'debug';

const Debug = createDebug('OpenLibrary');

/**
 * Open Library Find
 *
 * Searches the Open Library API and returns matching entities.
 * Handles both Author and Work entity types.
 *
 * @param entity - The entity name to search for
 * @param filter - Optional filter with where clause for search terms
 * @returns Array of matching records
 */
addFunction(
  { layer: 'Server' },
  async function openLibraryFind(entity: string, filter?: any): Promise<any[]> {
    const debug = Debug.extend('find');
    debug('entity %s, filter %j', entity, filter);

    const baseUrl = 'https://openlibrary.org';

    if (entity === 'OpenLibraryAuthor') {
      const query = filter?.where?.name?.ilike?.replace(/%/g, '') || 'a';
      const response = await fetch(`${baseUrl}/search/authors.json?q=${encodeURIComponent(query)}&limit=20`);
      const data = await response.json();
      debug('authors found %d', data.numFound);

      return (data.docs || []).map((doc: any) => ({
        id: doc.key,
        name: doc.name,
        birthDate: doc.birth_date || null,
        topWork: doc.top_work || null,
        workCount: doc.work_count || 0,
      }));
    }

    if (entity === 'OpenLibraryWork') {
      const query = filter?.where?.title?.ilike?.replace(/%/g, '') || filter?.where?.authorId || 'a';
      const authorId = filter?.where?.authorId;
      let url: string;

      if (authorId) {
        url = `${baseUrl}/search.json?author=${encodeURIComponent(authorId)}&limit=20`;
      } else {
        url = `${baseUrl}/search.json?q=${encodeURIComponent(query)}&limit=20`;
      }

      const response = await fetch(url);
      const data = await response.json();
      debug('works found %d', data.numFound);

      return (data.docs || []).map((doc: any) => ({
        id: doc.key?.replace('/works/', '') || doc.key,
        title: doc.title,
        firstPublishYear: doc.first_publish_year || null,
        authorId: doc.author_key?.[0] || null,
      }));
    }

    debug('unknown entity %s', entity);
    return [];
  },
);
