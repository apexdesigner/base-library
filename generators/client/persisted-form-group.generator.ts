import type { DesignGenerator, DesignMetadata, GenerationContext } from '@apexdesigner/generator';
import { isLibrary } from '@apexdesigner/generator';
import { pascalCase } from 'change-case';
import createDebug from 'debug';

const Debug = createDebug('ad3:generators:persistedFormGroup');

const persistedFormGroupGenerator: DesignGenerator = {
  name: 'persisted-form-group',

  triggers: [
    {
      metadataType: 'Project',
      condition: (metadata) => !isLibrary(metadata),
    },
  ],

  outputs: () => [
    'client/src/app/business-objects/persisted-form-group.ts',
    'design/@types/business-objects/persisted-form-group.d.ts',
  ],

  async generate(_metadata: DesignMetadata, context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');
    debug('generating persisted-form-group base class');

    const debugNamespace = pascalCase(context.listMetadata('Project')[0]?.name || 'App');

    const runtimeContent = `import { SchemaFormGroup, SchemaFormArray, SchemaFormControl } from '@apexdesigner/schema-forms';
import type { SchemaType } from '@apexdesigner/schema-forms';
import { z } from 'zod';
import type { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs';
import createDebug from 'debug';

const Debug = createDebug('${debugNamespace}:PersistedForm');

export interface EntityClass {
  findById(id: any, filter?: any): Promise<any>;
  create(data: any): Promise<any>;
  updateById(id: any, data: any): Promise<any>;
}

export interface PersistedFormGroupOptions {
  filter?: Record<string, any>;
}

export class PersistedFormGroup extends SchemaFormGroup {
  reading = false;
  saving = false;
  private _filter: Record<string, any> = {};
  private _entityClass: EntityClass;
  private _idProperty: string;
  private _savePromise: Promise<any> | null = null;

  constructor(
    schema: SchemaType,
    entityClass: EntityClass,
    options?: PersistedFormGroupOptions,
    idProperty = 'id',
  ) {
    super(schema);
    this._entityClass = entityClass;
    this._idProperty = idProperty;
    if (options?.filter) this._filter = options.filter;
  }

  get readFilter(): Record<string, any> {
    return this._filter;
  }

  set readFilter(value: Record<string, any>) {
    this._filter = value;
  }

  async read(filter?: Record<string, any>): Promise<void> {
    const debug = Debug.extend('read');
    // Wait for in-progress save before reading (design decision #5)
    if (this._savePromise) await this._savePromise;

    const mergedFilter = { ...this._filter, ...filter };
    if (filter) this._filter = mergedFilter;
    this.reading = true;
    try {
      const id = mergedFilter.where?.[this._idProperty];
      const data = await this._entityClass.findById(id, mergedFilter);
      debug('data', data);
      this.patchValue(data);
      // Populate nested PersistedFormArray controls (patchValue can't add to empty arrays)
      for (const [name, control] of Object.entries(this.controls)) {
        debug('control', name, control.constructor.name, control instanceof PersistedFormArray, Array.isArray(data[name]));
        if (control instanceof PersistedFormArray && Array.isArray(data[name])) {
          debug('populating array', name, 'with', data[name].length, 'items');
          control.clear();
          for (const item of data[name]) {
            control.addItem(item);
          }
          debug('array value after addItem', name, control.value);
        }
        if (control instanceof PersistedFormGroup && data[name] && typeof data[name] === 'object' && !Array.isArray(data[name])) {
          debug('populating nested form group', name);
          control.patchValue(data[name]);
        }
      }
      debug('value after read', this.value);
      this.updateOriginalValue();
    } finally {
      this.reading = false;
    }
  }

  override async save(): Promise<any> {
    this.saving = true;
    this._savePromise = this._doSave();
    try {
      return await this._savePromise;
    } finally {
      this._savePromise = null;
      this.saving = false;
    }
  }

  private _scalarOnly(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (this.controls[key] instanceof SchemaFormControl) {
        result[key] = data[key];
      }
    }
    return result;
  }

  private async _doSave(): Promise<any> {
    const id = this.value?.[this._idProperty];
    if (id) {
      const changes = this.getChanges();
      if (!changes) return null;
      const scalar = this._scalarOnly(changes);
      if (Object.keys(scalar).length === 0) return null;
      const result = await this._entityClass.updateById(id, scalar);
      // Patch back only server-computed fields that actually changed (e.g. lastModified)
      const serverUpdates: Record<string, any> = {};
      for (const key of Object.keys(result)) {
        if (!(key in scalar) && result[key] !== this.value?.[key]) {
          serverUpdates[key] = result[key];
        }
      }
      if (Object.keys(serverUpdates).length > 0) this.patchValue(serverUpdates);
      this.updateOriginalValue();
      return result;
    } else {
      const payload = this._scalarOnly(this.getPayload());
      const result = await this._entityClass.create(payload);
      this.patchValue(result);
      this.updateOriginalValue();
      return result;
    }
  }

  autoSave(destroyRef: DestroyRef, debounceMs = 300): void {
    this.valueChanges
      .pipe(
        debounceTime(debounceMs),
        filter(() => this.hasUnsavedChanges && !this.saving && !this.reading),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        this.save();
      });

    // Flush pending changes on destroy
    destroyRef.onDestroy(() => {
      if (this.hasUnsavedChanges && !this.saving) {
        this.save();
      }
    });
  }
}

export interface EntityArrayClass {
  find(filter?: any): Promise<any[]>;
  create(data: any): Promise<any>;
  deleteById(id: any): Promise<any>;
}

export interface PersistedFormArrayOptions {
  filter?: Record<string, any>;
}

export class PersistedFormArray extends SchemaFormArray {
  reading = false;

  private _filter: Record<string, any> = {};
  private _entityClass: EntityArrayClass;
  private _idProperty: string;

  constructor(
    itemSchema: SchemaType,
    entityClass: EntityArrayClass,
    options?: PersistedFormArrayOptions,
    idProperty = 'id',
  ) {
    super(z.array(itemSchema) as any);
    this._entityClass = entityClass;
    this._idProperty = idProperty;
    if (options?.filter) this._filter = options.filter;
  }

  get readFilter(): Record<string, any> {
    return this._filter;
  }

  set readFilter(value: Record<string, any>) {
    this._filter = value;
  }

  async read(filter?: Record<string, any>): Promise<void> {
    const mergedFilter = { ...this._filter, ...filter };
    if (filter) this._filter = mergedFilter;
    this.reading = true;
    try {
      const items = await this._entityClass.find(mergedFilter);
      this.clear();
      for (const item of items) {
        this.addItem(item);
      }
    } finally {
      this.reading = false;
    }
  }

  async add(data?: Record<string, any>): Promise<any> {
    const result = await this._entityClass.create(data || {});
    this.addItem(result);
    return result;
  }

  async remove(indexOrItem: number | Record<string, any>): Promise<void> {
    let index: number;
    if (typeof indexOrItem === 'number') {
      index = indexOrItem;
    } else {
      const groups = this.getGroups();
      index = groups.findIndex(g => g.value?.[this._idProperty] === indexOrItem[this._idProperty]);
      if (index === -1) return;
    }

    const group = this.getGroups()[index];
    const id = group?.value?.[this._idProperty];
    if (id) {
      await this._entityClass.deleteById(id);
    }
    this.removeItem(index);
  }
}

export interface PersistedArrayOptions {
  filter?: Record<string, any>;
}

export class PersistedArray<T = any> extends Array<T> {
  static get [Symbol.species]() {
    return Array;
  }

  reading = false;

  private _filter: Record<string, any> = {};
  private _entityClass: EntityArrayClass;
  private _idProperty: string;

  constructor(
    entityClass: EntityArrayClass,
    options?: PersistedArrayOptions,
    idProperty = 'id',
  ) {
    super();
    this._entityClass = entityClass;
    this._idProperty = idProperty;
    if (options?.filter) this._filter = options.filter;
  }

  get readFilter(): Record<string, any> {
    return this._filter;
  }

  set readFilter(value: Record<string, any>) {
    this._filter = value;
  }

  async read(filter?: Record<string, any>): Promise<void> {
    const mergedFilter = { ...this._filter, ...filter };
    if (filter) this._filter = mergedFilter;
    this.reading = true;
    try {
      const items = await this._entityClass.find(mergedFilter);
      this.length = 0;
      this.push(...items);
    } finally {
      this.reading = false;
    }
  }

  async add(data?: Record<string, any>): Promise<T> {
    const result = await this._entityClass.create(data || {});
    this.push(result);
    return result;
  }

  async remove(indexOrItem: number | T): Promise<void> {
    let index: number;
    if (typeof indexOrItem === 'number') {
      index = indexOrItem;
    } else {
      index = this.findIndex(item => (item as any)?.[this._idProperty] === (indexOrItem as any)[this._idProperty]);
      if (index === -1) return;
    }

    const item = this[index];
    const id = (item as any)?.[this._idProperty];
    if (id) {
      await this._entityClass.deleteById(id);
    }
    this.splice(index, 1);
  }
}
`;

    const typeContent = `import type { SchemaFormGroup, SchemaFormArray } from '@apexdesigner/schema-forms';

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
`;

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/business-objects/persisted-form-group.ts', runtimeContent);
    outputs.set('design/@types/business-objects/persisted-form-group.d.ts', typeContent);

    return outputs;
  },
};

export { persistedFormGroupGenerator };
