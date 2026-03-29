import type { DesignGenerator, DesignMetadata } from '@apexdesigner/generator';
import createDebug from 'debug';

const Debug = createDebug('BaseLibrary:generators:persistedFormGroup');

const persistedFormGroupGenerator: DesignGenerator = {
  name: 'persisted-form-group',

  triggers: [
    {
      metadataType: 'Project'
    }
  ],

  outputs: () => ['client/src/app/business-objects/persisted-form-group.ts', 'design/@types/business-objects-client/persisted-form-group.d.ts'],

  async generate(_metadata: DesignMetadata, context: GenerationContext): Promise<Map<string, string>> {
    const debug = Debug.extend('generate');
    debug('generating persisted-form-group base class');

    const runtimeContent = `import { SchemaFormGroup, SchemaFormArray, SchemaFormControl } from '@apexdesigner/schema-forms';
import type { SchemaType } from '@apexdesigner/schema-forms';
import { z } from 'zod';
import type { DestroyRef } from '@angular/core';
import { Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, filter } from 'rxjs';
import createDebug from 'debug';
import { getRelationshipMetadata } from '@apexdesigner/schema-tools';

const Debug = createDebug('PersistedForm');

export interface EntityClass {
  findById(id: any, filter?: any): Promise<any>;
  find(filter?: any): Promise<any[]>;
  create(data: any): Promise<any>;
  updateById(id: any, data: any): Promise<any>;
}

export interface PersistedFormGroupOptions {
  filter?: Record<string, any>;
  required?: string[];
  disabled?: string[];
}

export class PersistedFormGroup extends SchemaFormGroup {
  reading = false;
  saving = false;
  afterRead: (() => void) | null = null;
  private _filter: Record<string, any> = {};
  private _entityClass: EntityClass;
  private _idProperty: string;
  private _savePromise: Promise<any> | null = null;
  private _autoSaveDestroyRef: DestroyRef | null = null;
  private _autoSaveDebounceMs = 300;
  _parentForeignKey: string | null = null;

  constructor(
    schema: SchemaType,
    entityClass: EntityClass,
    data?: Record<string, any> | null,
    options?: PersistedFormGroupOptions,
    idProperty = 'id',
  ) {
    super(schema);
    this._entityClass = entityClass;
    this._idProperty = idProperty;
    if (options?.filter) this._filter = options.filter;
    if (options?.required) {
      for (const name of options.required) {
        const control = this.controls[name];
        if (control) control.addValidators(Validators.required);
      }
    }
    if (options?.disabled) {
      for (const name of options.disabled) {
        const control = this.controls[name];
        if (control) control.disable();
      }
    }
    if (data) {
      this._populate(data);
    }
    this.updateOriginalValue();
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
      let data: Record<string, any>;
      if (id !== undefined && id !== null) {
        data = await this._entityClass.findById(id, mergedFilter);
      } else {
        const results = await this._entityClass.find(mergedFilter);
        data = results[0];
        if (!data) throw new Error('No record found matching filter');
      }
      debug('data', data);
      this._populate(data);
      debug('value after read', this.value);
      this.updateOriginalValue();
    } finally {
      this.reading = false;
    }
    if (this.afterRead) this.afterRead();
  }

  protected createControl(_name: string): any {
    return undefined;
  }

  _populate(data: Record<string, any>): void {
    const debug = Debug.extend('_populate');
    // Lazily create controls for included relationships (including null has-one)
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'object' && !this.controls[key]) {
        const control = this.createControl(key);
        if (control) {
          debug('lazy-creating control %s', key);
          this.setControl(key, control);
          if (this._autoSaveDestroyRef && control instanceof PersistedFormGroup) {
            const fieldSchema = this.schema?.shape?.[key];
            if (fieldSchema) {
              const relMeta = getRelationshipMetadata(fieldSchema as any);
              if (relMeta?.relationshipType === 'hasOne' && relMeta.foreignKey && data[this._idProperty]) {
                debug('setting FK %s=%o on child %s', relMeta.foreignKey, data[this._idProperty], key);
                control.patchValue({ [relMeta.foreignKey]: data[this._idProperty] });
                control._parentForeignKey = relMeta.foreignKey;
              }
            }
            control.autoSave(this._autoSaveDestroyRef, this._autoSaveDebounceMs);
            control.updateOriginalValue();
          }
        }
      }
    }

    // Reset scalar controls not present in data (API omits null fields)
    for (const [key, control] of Object.entries(this.controls)) {
      if (control instanceof SchemaFormControl && !(key in data)) {
        control.reset(null, { emitEvent: false });
      }
    }

    this.patchValue(data);

    // Populate nested relationship controls (recursively)
    for (const [name, control] of Object.entries(this.controls)) {
      if (control instanceof PersistedFormArray && Array.isArray(data[name])) {
        debug('populating array', name, 'with', data[name].length, 'items');
        // Set parent context so add() can inject the foreign key
        const fieldSchema = this.schema?.shape?.[name];
        if (fieldSchema) {
          const relMeta = getRelationshipMetadata(fieldSchema as any);
          if (relMeta?.foreignKey && data[this._idProperty]) {
            control._parentForeignKey = relMeta.foreignKey;
            control._parentId = data[this._idProperty];
            debug('set parent FK %s=%o on array %s', relMeta.foreignKey, data[this._idProperty], name);
          }
        }
        // Propagate the include sub-filter to the child array's readFilter
        const includeFilter = this._filter?.include?.[name];
        if (includeFilter && typeof includeFilter === 'object') {
          control.readFilter = { ...control.readFilter, ...includeFilter };
          debug('set readFilter on array %s: %j', name, control.readFilter);
        }
        // Propagate autoSave to the array before adding items
        if (this._autoSaveDestroyRef) {
          control.autoSave(this._autoSaveDestroyRef, this._autoSaveDebounceMs);
        }
        control.clear();
        for (const item of data[name]) {
          control.addItem(item);
        }
      }
      if (control instanceof PersistedFormGroup && data[name] && typeof data[name] === 'object' && !Array.isArray(data[name])) {
        debug('populating nested form group', name);
        control._populate(data[name]);
        control.updateOriginalValue();
      }
    }
  }

  override async save(): Promise<any> {
    const debug = Debug.extend('save');
    debug('save called');
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
    const debug = Debug.extend('_doSave');
    const id = this.value?.[this._idProperty];
    if (id) {
      const changes = this.getChanges();
      debug('changes %j', changes);
      if (!changes) return null;
      const scalar = this._scalarOnly(changes);
      debug('scalar changes %j', scalar);
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
      debug('create payload %j', payload);
      const result = await this._entityClass.create(payload);
      this.patchValue(result);
      this.updateOriginalValue();
      return result;
    }
  }

  autoSave(destroyRef: DestroyRef, debounceMs = 300): void {
    const debug = Debug.extend('autoSave');
    debug('autoSave registered');
    this._autoSaveDestroyRef = destroyRef;
    this._autoSaveDebounceMs = debounceMs;
    this.valueChanges
      .pipe(
        debounceTime(debounceMs),
        filter(() => {
          const hasId = !!this.value?.[this._idProperty];
          const canAutoCreate = !hasId && !!this._parentForeignKey;
          const dominated = this.hasUnsavedChanges && !this.saving && !this.reading && (hasId || canAutoCreate);
          debug('filter: hasUnsavedChanges=%o saving=%o reading=%o id=%o canAutoCreate=%o → %o', this.hasUnsavedChanges, this.saving, this.reading, this.value?.[this._idProperty], canAutoCreate, dominated);
          return dominated;
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => {
        debug('autoSave triggering save');
        this.save();
      });

    // Flush pending changes on destroy
    destroyRef.onDestroy(() => {
      const hasId = !!this.value?.[this._idProperty];
      const canAutoCreate = !hasId && !!this._parentForeignKey;
      if (this.hasUnsavedChanges && !this.saving && (hasId || canAutoCreate)) {
        debug('onDestroy flush: saving pending changes');
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
  afterRead: (() => void) | null = null;
  readonly entityName: string = '';
  _parentForeignKey: string | null = null;
  _parentId: any = null;
  _autoSaveDestroyRef: DestroyRef | null = null;
  _autoSaveDebounceMs = 300;

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

  protected createItemGroup(): any {
    return undefined;
  }

  override addItem(data?: any): void {
    const group = this.createItemGroup();
    if (group) {
      if (data && group instanceof PersistedFormGroup) {
        group._populate(data);
      } else if (data) {
        group.patchValue(data);
      }
      if (this._autoSaveDestroyRef && group instanceof PersistedFormGroup) {
        group.autoSave(this._autoSaveDestroyRef, this._autoSaveDebounceMs);
        group.updateOriginalValue();
      }
      this.push(group);
    } else {
      super.addItem(data);
    }
  }

  autoSave(destroyRef: DestroyRef, debounceMs = 300): void {
    this._autoSaveDestroyRef = destroyRef;
    this._autoSaveDebounceMs = debounceMs;
    for (const control of this.controls) {
      if (control instanceof PersistedFormGroup) {
        control.autoSave(destroyRef, debounceMs);
        control.updateOriginalValue();
      }
    }
  }

  get readFilter(): Record<string, any> {
    return this._filter;
  }

  set readFilter(value: Record<string, any>) {
    this._filter = value;
  }

  async read(filter?: Record<string, any>): Promise<void> {
    const mergedFilter = this._buildFilterWithParentFK({ ...this._filter, ...filter });
    if (filter) this._filter = { ...this._filter, ...filter };
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
    if (this.afterRead) this.afterRead();
  }

  private _buildFilterWithParentFK(filter: Record<string, any>): Record<string, any> {
    if (this._parentForeignKey && this._parentId != null) {
      return { ...filter, where: { ...filter.where, [this._parentForeignKey]: this._parentId } };
    }
    return filter;
  }

  async add(data?: Record<string, any>): Promise<any> {
    const payload = { ...data };
    if (this._parentForeignKey && this._parentId != null) {
      payload[this._parentForeignKey] = this._parentId;
    }
    const result = await this._entityClass.create(payload);
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
  afterRead: (() => void) | null = null;
  readonly entityName: string = '';

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
    if (this.afterRead) this.afterRead();
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
  required?: string[];
  disabled?: string[];
}

export declare class PersistedFormGroup extends SchemaFormGroup {
  reading: boolean;
  saving: boolean;
  afterRead: (() => void) | null;

  readFilter: Record<string, any>;
  _parentForeignKey: string | null;

  constructor(schema: any, entityClass: any, data?: Record<string, any> | null, options?: PersistedFormGroupOptions, idProperty?: string);

  protected createControl(name: string): any;
  _populate(data: Record<string, any>): void;
  read(filter?: Record<string, any>): Promise<void>;
  save(): Promise<any>;
  autoSave(destroyRef: any, debounceMs?: number): void;
}

export interface PersistedFormArrayOptions {
  filter?: Record<string, any>;
}

export declare class PersistedFormArray extends SchemaFormArray {
  reading: boolean;
  afterRead: (() => void) | null;
  readonly entityName: string;

  readFilter: Record<string, any>;

  constructor(itemSchema: any, entityClass: any, options?: PersistedFormArrayOptions, idProperty?: string);

  protected createItemGroup(): any;
  addItem(data?: any): void;
  read(filter?: Record<string, any>): Promise<void>;
  add(data?: Record<string, any>): Promise<any>;
  remove(indexOrItem: number | Record<string, any>): Promise<void>;
  autoSave(destroyRef: any, debounceMs?: number): void;
}

export interface PersistedArrayOptions {
  filter?: Record<string, any>;
}

export declare class PersistedArray<T = any> extends Array<T> {
  reading: boolean;
  afterRead: (() => void) | null;
  readonly entityName: string;

  readFilter: Record<string, any>;

  constructor(entityClass: any, options?: PersistedArrayOptions, idProperty?: string);

  read(filter?: Record<string, any>): Promise<void>;
  add(data?: Record<string, any>): Promise<T>;
  remove(indexOrItem: number | T): Promise<void>;
}
`;

    const outputs = new Map<string, string>();
    outputs.set('client/src/app/business-objects/persisted-form-group.ts', runtimeContent);
    outputs.set('design/@types/business-objects-client/persisted-form-group.d.ts', typeContent);

    return outputs;
  }
};

export { persistedFormGroupGenerator };
