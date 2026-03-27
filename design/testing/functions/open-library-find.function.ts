import { addFunction } from '@apexdesigner/dsl';
import createDebug from 'debug';

const Debug = createDebug('OpenLibrary');

/**
 * Open Library Find
 *
 * Searches the Open Library API and returns matching entities.
 * Handles both Author and Work entity types.
 *
 * @param persistence - The persistence instance for resolving includes
 * @param entity - The entity name to search for
 * @param filter - Optional filter with where clause for search terms
 * @returns Array of matching records
 */
addFunction({ layer: 'Server' }, async function openLibraryFind(persistence: any, entity: string, filter?: any): Promise<any[]> {
  const debug = Debug.extend('find');
  debug('entity %j', entity);
  debug('filter %j', filter);

  const baseUrl = 'https://openlibrary.org';

  if (entity === 'OpenLibraryAuthor') {
    const ids = filter?.where?.id?.in as string[] | undefined;
    debug('ids %j', ids);

    if (ids) {
      const results = [];
      for (const authorId of ids) {
        const url = `${baseUrl}/authors/${authorId}.json`;
        debug('url %j', url);

        const response = await fetch(url);
        debug('response.ok %j', response.ok);

        if (response.ok) {
          const doc = await response.json();
          debug('doc.name %j', doc.name);

          results.push({
            id: doc.key?.replace('/authors/', '') || authorId,
            name: doc.name || doc.personal_name,
            birthDate: doc.birth_date || null,
            topWork: doc.top_work || null,
            workCount: null
          });
        }
      }
      debug('results.length %j', results.length);

      return Promise.all(results.map((r: any) => persistence.resolveIncludes(entity, r, filter?.include)));
    }

    const query = filter?.where?.name?.ilike?.replace(/%/g, '') || 'a';
    debug('query %j', query);

    const url = `${baseUrl}/search/authors.json?q=${encodeURIComponent(query)}&limit=20`;
    debug('url %j', url);

    const response = await fetch(url);

    const data = await response.json();
    debug('data.numFound %j', data.numFound);

    const results = (data.docs || []).map((doc: any) => ({
      id: doc.key,
      name: doc.name,
      birthDate: doc.birth_date || null,
      topWork: doc.top_work || null,
      workCount: doc.work_count || 0
    }));
    debug('results.length %j', results.length);

    return Promise.all(results.map((r: any) => persistence.resolveIncludes(entity, r, filter?.include)));
  }

  if (entity === 'OpenLibraryWork') {
    const authorId = filter?.where?.authorId;
    debug('authorId %j', authorId);

    const query = filter?.where?.title?.ilike?.replace(/%/g, '') || authorId || 'a';
    debug('query %j', query);

    let url: string;
    if (authorId) {
      url = `${baseUrl}/search.json?author=${encodeURIComponent(authorId)}&limit=20`;
    } else {
      url = `${baseUrl}/search.json?q=${encodeURIComponent(query)}&limit=20`;
    }
    debug('url %j', url);

    const response = await fetch(url);

    const data = await response.json();
    debug('data.numFound %j', data.numFound);

    const results = (data.docs || []).map((doc: any) => ({
      id: doc.key?.replace('/works/', '') || doc.key,
      title: doc.title,
      firstPublishYear: doc.first_publish_year || null,
      authorId: doc.author_key?.[0] || null
    }));
    debug('results.length %j', results.length);

    return Promise.all(results.map((r: any) => persistence.resolveIncludes(entity, r, filter?.include)));
  }

  debug('unknown entity %j', entity);
  return [];
});
