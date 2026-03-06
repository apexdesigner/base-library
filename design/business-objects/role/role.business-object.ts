import {
  BusinessObject,
  property,
  addUniqueConstraint,
  applyDefaultRoles,
} from "@apexdesigner/dsl";
import { RoleAssignment, TestAssignment } from "@business-objects";
import { Administrator } from "@roles";

/**
 * Role
 *
 * Named authorization role that can be assigned to users.
 */
export class Role extends BusinessObject {
  /** ID - Primary key */
  id!: number;

  /** Name - Unique role identifier */
  @property({ required: true })
  name?: string;

  /** Display Name - Human-readable role label */
  displayName?: string;

  /** Description - Role purpose and permissions summary */
  description?: string;

  /** Role Assignments - Users assigned to this role */
  roleAssignments?: RoleAssignment[];

  /** Test Assignments - Test assignments for this role */
  testAssignments?: TestAssignment[];
}

addUniqueConstraint(Role, "name");

applyDefaultRoles(Role, [Administrator]);
