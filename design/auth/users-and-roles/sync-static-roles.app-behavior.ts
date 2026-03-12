import { addAppBehavior } from '@apexdesigner/dsl';
import { Role } from '@business-objects';
import { roleDefinitions } from '@server/roles/role-definitions';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:Auth:syncStaticRoles');

/**
 * Sync Static Roles
 *
 * Creates any missing DSL-defined roles in the database at startup.
 */
addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Running',
    sequence: 100
  },
  async function syncStaticRoles() {
    debug('roleDefinitions.length %j', roleDefinitions.length);

    for (const roleDef of roleDefinitions) {
      debug('roleDef %j', roleDef);

      const [existing] = await Role.find({
        where: { name: roleDef.name }
      });
      debug('existing %j', existing);

      if (!existing) {
        await Role.create({
          name: roleDef.name,
          displayName: roleDef.displayName,
          description: roleDef.description
        });
        debug('created');
      } else if (existing.displayName !== roleDef.displayName || existing.description !== (roleDef.description ?? null)) {
        await Role.updateById(existing.id, {
          displayName: roleDef.displayName,
          description: roleDef.description
        });
        debug('updated');
      }
    }
  }
);
