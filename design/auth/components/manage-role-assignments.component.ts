import { Component, property, method, applyTemplate, applyStyles } from '@apexdesigner/dsl/component';
import { RolePersistedArray } from '@business-objects-client';
import { RoleAssignment, User } from '@business-objects-client';
import { AuthService } from '@services';

/**
 * Manage Role Assignments
 *
 * Displays a table of users and their role assignments.
 * Rows are users (derived from role assignments), columns are roles.
 * Checkbox icon buttons toggle role assignments.
 */
export class ManageRoleAssignmentsComponent extends Component {
  /** Role Names - Optional CSV of role names to filter columns */
  @property({ isInput: true })
  roleNames?: string;

  /** Roles - Loaded roles with assignments and users */
  @property({
    read: 'On Demand',
    include: { roleAssignments: { include: { user: {} } } }
  })
  roles!: RolePersistedArray;

  /** Search - Filter users by email */
  search!: string;

  /** Users - Derived list of unique users from role assignments */
  users!: Array<{ id: number | string; email: string }>;

  /** Filtered Users - Users matching the search filter */
  filteredUsers?: Array<{ id: number | string; email: string }>;

  /** Assignment Map - Map of "userId:roleId" to RoleAssignment for quick lookup */
  assignmentMap!: Map<string, any>;

  /** Auth Service */
  authService!: AuthService;

  /** Current User Id - ID of the logged-in user */
  currentUserId?: number | string;

  /** Busy - Prevents clicks while toggling */
  busy!: boolean;

  /** Showing Suggestions - True when table shows unassigned users from server search */
  showingSuggestions!: boolean;

  /** No Matches - True when server search returned no results */
  noMatches!: boolean;

  /** Load - Read roles and build user list */
  @method({ callOnLoad: true })
  async load(): Promise<void> {
    const filter: Record<string, any> = {
      include: { roleAssignments: { include: { user: {} } } }
    };
    if (this.roleNames) {
      const names = this.roleNames
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);
      filter.where = { name: { in: names } };
    }
    const currentUser = await this.authService.getCurrentUser();
    if (currentUser) {
      this.currentUserId = currentUser.id;
    }
    await this.roles.read(filter);
    this.buildUserList();
  }

  /** Build User List - Extract unique users from role assignments */
  buildUserList(): void {
    const userMap = new Map<number | string, { id: number | string; email: string }>();
    this.assignmentMap = new Map();
    for (const role of this.roles) {
      if (!role.roleAssignments) continue;
      for (const ra of role.roleAssignments) {
        if (!ra.user) continue;
        userMap.set(ra.user.id, { id: ra.user.id, email: ra.user.email });
        this.assignmentMap.set(`${ra.userId}:${ra.roleId}`, ra);
      }
    }
    this.users = Array.from(userMap.values()).sort((a, b) => a.email.localeCompare(b.email));
    this.filterUsers();
  }

  /** Filter Users - Apply search filter and search server when no local matches */
  /** Valid Email - Whether the search term is a valid email */
  validEmail(): boolean {
    const s = this.search?.trim();
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  /** Filter Users - Apply search filter and search server when no local matches */
  filterUsers(): void {
    if (!this.search) {
      this.showingSuggestions = false;
      this.noMatches = false;
      this.filteredUsers = this.users;
      return;
    }
    if (this.showingSuggestions || this.noMatches) {
      this.searchUsers();
      return;
    }
    const term = this.search.toLowerCase();
    this.filteredUsers = this.users.filter(u => u.email.toLowerCase().includes(term));
    if (this.filteredUsers.length === 0) {
      this.searchUsers();
    }
  }

  /** Search Users - LIKE query for users not already in the list */
  @method({ debounceMilliseconds: 500 })
  async searchUsers(): Promise<void> {
    const term = this.search?.trim();
    if (!term) return;
    this.filteredUsers = undefined;
    const existingIds = new Set(this.users.map(u => u.id));
    const results = await User.find({
      where: { email: { like: `%${term}%` } },
      limit: 20
    });
    this.filteredUsers = results.filter((u: any) => !existingIds.has(u.id)).map((u: any) => ({ id: u.id, email: u.email }));
    this.showingSuggestions = this.filteredUsers.length > 0;
    this.noMatches = this.filteredUsers.length === 0;
  }

  /** Add User - Create a new user and assign the first role */
  async addUser(): Promise<void> {
    if (this.busy || !this.validEmail()) return;
    this.busy = true;
    const user = await User.create({ email: this.search.trim() });
    if (this.roles.length > 0) {
      await RoleAssignment.create({
        userId: user.id as any,
        roleId: (this.roles[0] as any).id
      });
    }
    this.search = '';
    this.noMatches = false;
    await this.roles.read();
    this.buildUserList();
    this.busy = false;
  }

  /** Has Assignment - Check if user has a role assignment */
  hasAssignment(userId: number | string, roleId: number): boolean {
    return this.assignmentMap?.has(`${userId}:${roleId}`) ?? false;
  }

  /** Toggle Assignment - Add or remove a role assignment */
  async toggleAssignment(userId: number | string, roleId: number): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const key = `${userId}:${roleId}`;
    if (this.assignmentMap.has(key)) {
      const ra = this.assignmentMap.get(key);
      await RoleAssignment.deleteById(ra.id);
    } else {
      await RoleAssignment.create({ userId: userId as any, roleId });
      if (this.showingSuggestions) {
        this.search = '';
        this.showingSuggestions = false;
      }
    }
    await this.roles.read();
    this.buildUserList();
    this.busy = false;
  }
}

applyTemplate(ManageRoleAssignmentsComponent, [
  {
    if: 'roles.reading',
    contains: [
      { element: 'mat-progress-bar', mode: 'indeterminate' },
    ],
  },
  {
    if: '!roles.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          {
            element: 'mat-form-field',
            contains: [
              { 'mat-label': 'Search by email' },
              {
                element: 'input',
                matInput: true,
                ngModel: '= search',
                ngModelChange: '-> search = ngModel',
                '(ngModelChange)_extra': '-> filterUsers()',
              },
            ],
          },
          {
            if: 'showingSuggestions',
            contains: [
              { p: 'Select a user to assign a role' },
            ],
          },
          {
            if: '!noMatches',
            contains: [
              {
                element: 'dt-table',
                dataSource: '= filteredUsers',
                hideEmptyState: '= true',
                contains: [
                  { element: 'dt-column', property: 'email', header: 'Email' },
                  {
                    for: 'role',
                    of: 'roles',
                    contains: [
                      {
                        element: 'dt-column',
                        header: '= role.displayName || role.name',
                        align: 'center',
                        contains: [
                          {
                            element: 'ng-template',
                            'let-row': true,
                            contains: [
                              {
                                element: 'button',
                                'mat-icon-button': true,
                                click: '-> toggleAssignment(row.id, role.id)',
                                disabled: "= busy || (row.id === currentUserId && role.name === 'Administrator')",
                                contains: [
                                  {
                                    if: 'hasAssignment(row.id, role.id)',
                                    contains: [
                                      { 'mat-icon': 'check_box' },
                                    ],
                                    elseContains: [
                                      { 'mat-icon': 'check_box_outline_blank' },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            if: 'noMatches',
            contains: [
              { p: 'Enter a valid email to add a new user' },
              {
                element: 'div',
                contains: [
                  {
                    element: 'button',
                    'mat-raised-button': true,
                    color: 'primary',
                    click: '-> addUser()',
                    disabled: '= busy || !validEmail()',
                    contains: [
                      { 'mat-icon': 'person_add' },
                    ],
                    text: 'Add {{search}}',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
]);

applyStyles(ManageRoleAssignmentsComponent, ``);
