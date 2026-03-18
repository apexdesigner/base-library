import createDebug from 'debug';
import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent } from '@business-objects';
import { App } from '@app';

const debug = createDebug('BaseLibrary:Audit:completeCreateEvents');

/**
 * Complete Create Events
 *
 * Marks pending create audit events as complete after the record is created.
 */
addBehavior(
  Audit,
  {
    type: 'After Create',
  },
  // @ts-ignore Model and mixinOptions required by mixin behavior signature
  async function completeCreateEvents(Model: any, mixinOptions: AuditConfig, instances: any[]) {
    const auditCtx = App.auditProperties.context?.getStore() as any;

    if (auditCtx?.pendingCreateIds?.length) {
      const modelId = instances[0]?.id;
      await AuditEvent.update(
        { where: { id: { in: auditCtx.pendingCreateIds } } },
        { modelId, status: 'Complete' },
      );
      debug('completed create events for modelId %j', modelId);

      auditCtx.pendingCreateIds = [];
    }
  },
);
