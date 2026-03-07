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
    this.isImpersonating = !!sessionStorage.getItem('impersonateUserId');
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
    sessionStorage.setItem('impersonateUserId', String(user.id));
    window.location.href = '/switch-user';
  }

  /** Stop Impersonating - Clear impersonation and reload */
  stopImpersonating(): void {
    sessionStorage.removeItem('impersonateUserId');
    window.location.href = '/switch-user';
  }
}

applyTemplate(
  SwitchUserPage,
  `
  <flex-column>
    <if condition="isImpersonating">
      <div>
        <button mat-raised-button color="warn" (click)="stopImpersonating()">Stop being {{currentUser?.email}}</button>
      </div>
    </if>
    <if condition="!isImpersonating">
      <h1>Switch User</h1>
      <mat-form-field>
        <mat-label>Search</mat-label>
        <input matInput [(ngModel)]="searchText" placeholder="Filter by email">
      </mat-form-field>
      <if condition="!users.reading">
        <mat-action-list>
          <for const="user" of="filteredUsers">
            <if condition="user.id !== currentUser.id">
              <button mat-list-item (click)="switchTo(user)">{{user.email}}</button>
            </if>
          </for>
        </mat-action-list>
        <else>
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        </else>
      </if>
    </if>
  </flex-column>
`
);
