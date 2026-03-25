import { Page, page, property, method, applyTemplate } from '@apexdesigner/dsl/page';
import { UserPersistedArray } from '@business-objects-client';
import { User } from '@business-objects-client';
import { AuthService } from '@services';

/**
 * Switch User
 *
 * Allows administrators to switch to another user by selecting from a list.
 * Only available when ALLOW_IMPERSONATION is enabled on the server.
 * Selecting a user sets sessionStorage and reloads the app.
 */
@page({ path: '/switch-user', excludeFromSidenav: true })
export class SwitchUserPage extends Page {
  /** Users - List of all users available for impersonation */
  @property({
    read: 'On Demand',
    order: [{ field: 'email', direction: 'asc' }]
  })
  users!: UserPersistedArray;

  /** Current User - The currently authenticated user */
  currentUser?: User;

  /** Auth Service */
  authService!: AuthService;

  /** Is Impersonating - Whether impersonation is currently active */
  isImpersonating = false;

  /** Initialize - Fetch users only when not impersonating */
  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    this.currentUser = await this.authService.getCurrentUser();
    this.isImpersonating = !!sessionStorage.getItem('impersonateEmail');
    if (!this.isImpersonating) {
      await this.users.read();
    }
  }

  /** Search Text - Filter users by email */
  searchText = '';

  /** Filtered Users - Users matching the search text */
  get filteredUsers(): User[] {
    if (!this.searchText) return this.users || [];
    const search = this.searchText.toLowerCase();
    return (this.users || []).filter((u: User) => u.email?.toLowerCase().includes(search));
  }

  /** Switch To - Set impersonation and reload */
  switchTo(user: User): void {
    sessionStorage.setItem('impersonateEmail', user.email);
    window.location.href = '/switch-user';
  }

  /** Stop Impersonating - Clear impersonation and reload */
  stopImpersonating(): void {
    sessionStorage.removeItem('impersonateEmail');
    window.location.href = '/switch-user';
  }
}

applyTemplate(SwitchUserPage, [
  {
    element: 'flex-column',
    contains: [
      {
        if: 'isImpersonating',
        name: 'impersonating',
        contains: [
          {
            element: 'div',
            contains: [
              {
                element: 'button',
                text: 'Stop being {{currentUser?.email}}',
                attributes: { 'mat-raised-button': null, color: 'warn', click: '-> stopImpersonating()' }
              }
            ]
          }
        ]
      },
      {
        if: '!isImpersonating',
        name: 'notImpersonating',
        contains: [
          { h1: 'Switch User' },
          {
            element: 'mat-form-field',
            contains: [
              { 'mat-label': 'Search' },
              {
                element: 'input',
                attributes: {
                  matInput: null,
                  ngModel: '<-> searchText',
                  placeholder: 'Filter by email'
                }
              }
            ]
          },
          {
            if: '!users.reading',
            contains: [
              {
                element: 'mat-action-list',
                contains: [
                  {
                    for: 'user',
                    of: 'filteredUsers',
                    contains: [
                      {
                        if: 'user.id !== currentUser.id',
                        contains: [
                          {
                            element: 'button',
                            text: '{{user.email}}',
                            attributes: { 'mat-list-item': null, click: '-> switchTo(user)' }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ],
            elseContains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }]
          }
        ]
      }
    ]
  }
]);
