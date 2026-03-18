import createDebug from 'debug';
import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent } from '@business-objects';
import { App } from '@app';

const debug = createDebug('BaseLibrary:Audit:completeUpdateEvents');

/**
 * Complete Update Events
 *
 * Marks pending update audit events as complete after records are updated.
 */
addBehavior(
  Audit,
  {
    type: 'After Update'
  },
  // @ts-ignore Model and mixinOptions required by mixin behavior signature
  async function completeUpdateEvents(Model: any, mixinOptions: AuditConfig, instances: any[]) {
    const auditCtx = App.auditProperties.context?.getStore() as any;

    if (auditCtx?.pendingUpdateIds?.length) {
      await AuditEvent.update({ where: { id: { in: auditCtx.pendingUpdateIds } } }, { status: 'Complete' });
      debug('completed update events');

      auditCtx.pendingUpdateIds = [];
    }
  }
);
