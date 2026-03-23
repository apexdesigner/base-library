import { Page, page, applyTemplate } from '@apexdesigner/dsl/page';
import { ManageRoleAssignmentsComponent } from '@components';

/**
 * Manage Roles
 *
 * Page for managing user role assignments.
 */
@page({
  path: '/manage-roles',
  sidenavIcon: 'admin_panel_settings'
})
export class ManageRolesPage extends Page {}

applyTemplate(ManageRolesPage, [
  {
    element: 'flex-column',
    contains: [
      { h1: 'Manage Roles' },
      { element: 'manage-role-assignments', grow: '= true' },
    ],
  },
]);
