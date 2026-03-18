import createDebug from 'debug';
import { addBehavior } from '@apexdesigner/dsl';
import { Audit, AuditConfig } from '@mixins';
import { AuditEvent } from '@business-objects';
import { App } from '@app';

const debug = createDebug('BaseLibrary:Audit:completeDeleteEvents');

/**
 * Complete Delete Events
 *
 * Marks pending delete audit events as complete after records are deleted.
 */
addBehavior(
  Audit,
  {
    type: 'After Delete'
  },
  // @ts-ignore Model and mixinOptions required by mixin behavior signature
  async function completeDeleteEvents(Model: any, mixinOptions: AuditConfig, instances: any[]) {
    const auditCtx = App.auditProperties.context?.getStore() as any;

    if (auditCtx?.pendingDeleteIds?.length) {
      await AuditEvent.update({ where: { id: { in: auditCtx.pendingDeleteIds } } }, { status: 'Complete' });
      debug('completed delete events');

      auditCtx.pendingDeleteIds = [];
    }
  }
);
