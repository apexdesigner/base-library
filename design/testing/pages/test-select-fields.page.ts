import { Page, page, property, method, applyTemplate } from '@apexdesigner/dsl/page';
import { SchemaFormControl } from '@apexdesigner/schema-forms';
import { User, Role, TestAssignment } from '@business-objects-client';
import { TestAssignmentFormGroup } from '@business-objects-client';

/**
 * Test Select Fields
 *
 * Test page for select-user-field and select-role-field components.
 */
@page({
  path: '/test-select-fields',
  excludeFromSidenav: true
})
export class TestSelectFieldsPage extends Page {
  /** User Control - Form control for the selected user id */
  userControl: SchemaFormControl = new SchemaFormControl();

  /** Role Control - Form control for the selected role id */
  roleControl: SchemaFormControl = new SchemaFormControl();

  /** Test Assignment - For testing sf-fields with select-user and select-role */
  @property({ read: 'On Demand', save: 'Automatically' })
  testAssignment!: TestAssignmentFormGroup;

  /** Selected User Id - Display the current user control value */
  get selectedUserId(): string {
    return this.userControl.value ?? '(none)';
  }

  /** Selected Role Id - Display the current role control value */
  get selectedRoleId(): string {
    return this.roleControl.value ?? '(none)';
  }

  /** Role Name Control - Form control for the selected role name */
  roleNameControl: SchemaFormControl = new SchemaFormControl();

  /** Selected Role Name - Display the current role name control value */
  get selectedRoleName(): string {
    return this.roleNameControl.value ?? '(none)';
  }

  /** Set First User - Set the user control to the first user's id */
  async setFirstUser(): Promise<void> {
    const [first] = await User.find({ limit: 1 });
    if (first) this.userControl.setValue(first.id);
  }

  /** Set First Role - Set the role control to the first role's id */
  async setFirstRole(): Promise<void> {
    const [first] = await Role.find({ limit: 1 });
    if (first) this.roleControl.setValue(first.id);
  }

  /** Load Assignment - Read the first test assignment, creating one if none exist */
  @method({ callOnLoad: true })
  async loadAssignment(): Promise<void> {
    let [first] = await TestAssignment.find({ limit: 1 });
    if (!first) {
      first = await TestAssignment.create({ name: 'Test Assignment', testUserId: null, testRoleId: null } as any);
    }
    await this.testAssignment.read({ where: { id: first.id } });
  }
}

applyTemplate(TestSelectFieldsPage, [
  {
    element: 'flex-column',
    contains: [
      { h2: 'Select Field Tests' },
      {
        element: 'flex-row',
        attributes: { gap: '24' },
        contains: [
          {
            element: 'flex-column',
            name: 'user',
            contains: [
              { h3: 'Select User' },
              {
                element: 'select-user-field',
                attributes: { control: '<- userControl', label: 'User', hideHelpText: '<- true' },
              },
              { p: 'Selected: {{selectedUserId}}' },
              {
                element: 'button',
                text: 'Set First User',
                attributes: { 'mat-raised-button': null, click: '-> setFirstUser()' },
              },
            ],
          },
          {
            element: 'flex-column',
            name: 'role',
            contains: [
              { h3: 'Select Role' },
              {
                element: 'select-role-field',
                attributes: { control: '<- roleControl', label: 'Role', hideHelpText: '<- true' },
              },
              { p: 'Selected: {{selectedRoleId}}' },
              {
                element: 'button',
                text: 'Set First Role',
                attributes: { 'mat-raised-button': null, click: '-> setFirstRole()' },
              },
            ],
          },
          {
            element: 'flex-column',
            name: 'roleName',
            contains: [
              { h3: 'Select Role Name' },
              {
                element: 'select-role-name-field',
                attributes: { control: '<- roleNameControl', label: 'Role Name', hideHelpText: '<- true' },
              },
              { p: 'Selected: {{selectedRoleName}}' },
            ],
          },
        ],
      },
      { h2: 'SF Fields on Test Assignment' },
      {
        if: 'testAssignment.reading',
        name: 'assignmentLoading',
        contains: [
          { element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } },
        ],
      },
      {
        if: '!testAssignment.reading && testAssignment.value?.id',
        name: 'assignmentLoaded',
        contains: [
          { element: 'sf-fields', attributes: { group: '<- testAssignment' } },
        ],
      },
      {
        if: "!testAssignment.reading && !testAssignment.value?.id",
        name: 'assignmentEmpty',
        contains: [
          { p: 'No test assignment found. Create one first.' },
        ],
      },
    ],
  },
]);
