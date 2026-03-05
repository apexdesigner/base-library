import { addAppBehavior } from '@apexdesigner/dsl';
import { Role, RoleAssignment, User } from '@business-objects';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:Auth:assignDefaultAdministrators');

/**
 * Assign Default Administrators
 *
 * Ensures users matching ADMINISTRATOR_EMAILS have the Administrator role.
 * Runs after sync-static-roles so the role is guaranteed to exist.
 */
addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Running',
    sequence: 200
  },
  async function assignDefaultAdministrators() {
    const csv = process.env.ADMINISTRATOR_EMAILS;
    debug('csv %j', csv);

    if (!csv) {
      console.error('ADMINISTRATOR_EMAILS environment variable is not set (comma-separated list of emails)');
      return;
    }

    const emails = csv
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);
    debug('emails %j', emails);

    const adminRole = await Role.findOne({ where: { name: 'Administrator' } });
    debug('adminRole %j', adminRole);

    if (!adminRole) {
      debug('Administrator role not found, skipping');
      return;
    }

    for (const email of emails) {
      const user = await User.findOne({ where: { email }, include: { roleAssignments: { where: { roleId: adminRole.id } } } });
      debug('user %j', user);

      let userId: number;

      if (!user) {
        const created = await User.create({ email });
        debug('created user %j for %j', created.id, email);
        userId = created.id;
      } else if (user.roleAssignments?.length) {
        debug('already assigned for %j', email);
        continue;
      } else {
        userId = user.id;
      }

      await RoleAssignment.create({ userId, roleId: adminRole.id });
      debug('assigned Administrator to %j', email);
    }
  }
);
