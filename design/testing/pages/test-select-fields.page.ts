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
  excludeFromSidenav: true,
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

applyTemplate(
  TestSelectFieldsPage,
  `
  <flex-column>
    <h2>Select Field Tests</h2>
    <flex-row gap="24">
      <flex-column>
        <h3>Select User</h3>
        <select-user-field [control]="userControl" label="User"></select-user-field>
        <p>Selected: {{selectedUserId}}</p>
        <button mat-raised-button (click)="setFirstUser()">Set First User</button>
      </flex-column>
      <flex-column>
        <h3>Select Role</h3>
        <select-role-field [control]="roleControl" label="Role"></select-role-field>
        <p>Selected: {{selectedRoleId}}</p>
        <button mat-raised-button (click)="setFirstRole()">Set First Role</button>
      </flex-column>
    </flex-row>
    <h2>SF Fields on Test Assignment</h2>
    <if condition="testAssignment.reading">
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    </if>
    <if condition="!testAssignment.reading && testAssignment.value?.id">
      <sf-fields [group]="testAssignment"></sf-fields>
    </if>
    <if condition="!testAssignment.reading && !testAssignment.value?.id">
      <p>No test assignment found. Create one first.</p>
    </if>
  </flex-column>
`,
);
