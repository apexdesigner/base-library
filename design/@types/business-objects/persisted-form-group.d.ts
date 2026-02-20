import type { SchemaFormGroup, SchemaFormArray } from '@apexdesigner/schema-forms';

export interface PersistedFormGroupOptions {
  filter?: Record<string, any>;
}

export declare class PersistedFormGroup extends SchemaFormGroup {
  reading: boolean;
  saving: boolean;

  readFilter: Record<string, any>;

  constructor(schema: any, entityClass: any, options?: PersistedFormGroupOptions, idProperty?: string);

  read(filter?: Record<string, any>): Promise<void>;
  save(): Promise<any>;
  autoSave(destroyRef: any, debounceMs?: number): void;
}

export interface PersistedFormArrayOptions {
  filter?: Record<string, any>;
}

export declare class PersistedFormArray extends SchemaFormArray {
  reading: boolean;

  readFilter: Record<string, any>;

  constructor(itemSchema: any, entityClass: any, options?: PersistedFormArrayOptions, idProperty?: string);

  read(filter?: Record<string, any>): Promise<void>;
  add(data?: Record<string, any>): Promise<any>;
  remove(indexOrItem: number | Record<string, any>): Promise<void>;
}

export interface PersistedArrayOptions {
  filter?: Record<string, any>;
}

export declare class PersistedArray<T = any> extends Array<T> {
  reading: boolean;

  readFilter: Record<string, any>;

  constructor(entityClass: any, options?: PersistedArrayOptions, idProperty?: string);

  read(filter?: Record<string, any>): Promise<void>;
  add(data?: Record<string, any>): Promise<T>;
  remove(indexOrItem: number | T): Promise<void>;
}
