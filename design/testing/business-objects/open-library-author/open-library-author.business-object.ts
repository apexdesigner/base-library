import { BusinessObject, property } from "@apexdesigner/dsl";
import { applyOpenLibraryDataSource } from "@data-sources";
import { OpenLibraryWork } from "@business-objects";

/**
 * Open Library Author
 *
 * An author from the Open Library API.
 */
export class OpenLibraryAuthor extends BusinessObject {
  /** Id - Open Library author key */
  @property({ isId: true })
  id!: string;

  /** Name - Author name */
  name?: string;

  /** Birth Date - Author birth date */
  birthDate?: string;

  /** Top Work - Title of the author's most popular work */
  topWork?: string;

  /** Work Count - Number of works by this author */
  workCount?: number;

  /** Open Library Works - Works by this author */
  openLibraryWorks?: OpenLibraryWork[];
}

applyOpenLibraryDataSource(OpenLibraryAuthor);
