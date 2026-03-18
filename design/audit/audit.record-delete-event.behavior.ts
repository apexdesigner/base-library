import createDebug from 'debug';
import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent, User } from '@business-objects';
import { App } from '@app';

const debug = createDebug('BaseLibrary:Audit:recordDeleteEvent');

/**
 * Record Delete Event
 *
 * Records pending audit events before records are deleted, capturing the full record data.
 */
addBehavior(
  Audit,
  {
    type: 'Before Delete'
  },
  async function recordDeleteEvent(Model: any, mixinOptions: AuditConfig, where: any) {
    debug('where %j', where);

    const currentUser = await User.currentUser();
    const auditCtx = App.auditProperties.context?.getStore() as any;

    const omitFields: string[] = mixinOptions.excludeProperties || [];
    const instances = await Model.find({
      where,
      ...(omitFields.length > 0 ? { omit: omitFields } : {})
    });
    debug('instances.length %j', instances.length);

    for (const instance of instances) {
      const newEvent = await AuditEvent.create({
        modelName: Model.entityName,
        modelId: instance.id,
        date: new Date(),
        userEmail: currentUser?.email,
        operation: 'Delete',
        dataJson: JSON.stringify(instance),
        status: 'Pending'
      });
      debug('newEvent.id %j', newEvent.id);

      if (auditCtx) {
        if (!auditCtx.pendingDeleteIds) auditCtx.pendingDeleteIds = [];
        auditCtx.pendingDeleteIds.push(newEvent.id);
      }
    }
  }
);
