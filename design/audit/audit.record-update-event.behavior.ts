import createDebug from 'debug';
import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent, User } from '@business-objects';
import { App } from '@app';

const debug = createDebug('BaseLibrary:Audit:recordUpdateEvent');

/**
 * Record Update Event
 *
 * Records pending audit events before records are updated.
 */
addBehavior(
  Audit,
  {
    type: 'Before Update'
  },
  async function recordUpdateEvent(Model: any, mixinOptions: AuditConfig, where: any, updates: Partial<any>) {
    const currentUser = await User.currentUser();
    const auditCtx = App.auditProperties.context?.getStore() as any;

    let payload = JSON.stringify(updates);
    if (mixinOptions.excludeProperties?.length) {
      const obj = JSON.parse(payload);
      for (const name of mixinOptions.excludeProperties) {
        delete obj[name];
      }
      payload = JSON.stringify(obj);
    }

    const instances = await Model.find({ where, fields: ['id'] });
    debug('instances.length %j', instances.length);

    for (const instance of instances) {
      const newEvent = await AuditEvent.create({
        modelName: Model.entityName,
        modelId: instance.id,
        date: new Date(),
        userEmail: currentUser?.email,
        operation: 'Update',
        dataJson: payload,
        status: 'Pending'
      });
      debug('newEvent.id %j', newEvent.id);

      if (auditCtx) {
        if (!auditCtx.pendingUpdateIds) auditCtx.pendingUpdateIds = [];
        auditCtx.pendingUpdateIds.push(newEvent.id);
      }
    }
  }
);
