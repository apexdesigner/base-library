import createDebug from 'debug';
import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent, User } from '@business-objects';
import { App } from '@app';

const debug = createDebug('BaseLibrary:Audit:recordCreateEvent');

/**
 * Record Create Event
 *
 * Records a pending audit event before a record is created.
 */
addBehavior(
  Audit,
  {
    type: 'Before Create'
  },
  async function recordCreateEvent(Model: any, mixinOptions: AuditConfig, dataItems: Partial<any>[]) {
    const currentUser = await User.currentUser();
    const auditCtx = App.auditProperties.context?.getStore() as any;

    for (const model of dataItems) {
      let payload = JSON.stringify(model);
      if (mixinOptions.excludeProperties?.length) {
        const obj = JSON.parse(payload);
        for (const name of mixinOptions.excludeProperties) {
          delete obj[name];
        }
        payload = JSON.stringify(obj);
      }

      const newEvent = await AuditEvent.create({
        modelName: Model.entityName,
        date: new Date(),
        userEmail: currentUser?.email,
        operation: 'Create',
        dataJson: payload,
        status: 'Pending'
      });
      debug('newEvent.id %j', newEvent.id);

      if (auditCtx) {
        if (!auditCtx.pendingCreateIds) auditCtx.pendingCreateIds = [];
        auditCtx.pendingCreateIds.push(newEvent.id);
      }
    }
  }
);
