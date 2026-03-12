import { Component, method, applyTemplate } from '@apexdesigner/dsl/component';
import { AuthService } from '@services';
import { Router } from '@angular/router';

/**
 * Avatar
 *
 * User avatar button with a menu showing the current user email and logout.
 * Shows a "Switch User" option when impersonation is enabled.
 */
export class AvatarComponent extends Component {
  /** Auth Service */
  authService!: AuthService;

  /** Router */
  router!: Router;

  /** Allow Impersonation - Whether the server allows user switching */
  allowImpersonation = false;

  /** Initialize - Check if impersonation is available */
  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    try {
      const response = await fetch('/api/auth/config');
      if (response.ok) {
        const config = await response.json();
        this.allowImpersonation = !!config?.allowImpersonation;
      }
    } catch {}
  }

  /** Switch User - Navigate to the switch user page */
  switchUser(): void {
    this.router.navigate(['/switch-user']);
  }

  /** Logout */
  logout(): void {
    this.authService.logout();
  }
}

applyTemplate(
  AvatarComponent,
  `
  <button mat-icon-button [matMenuTriggerFor]="userMenu">
    <mat-icon>person</mat-icon>
  </button>
  <mat-menu #userMenu>
    <div mat-menu-item disabled>{{(authService.currentUser | async)?.email}}</div>
    <if condition="allowImpersonation">
      <button mat-menu-item (click)="switchUser()">Switch User</button>
    </if>
    <button mat-menu-item (click)="logout()">Logout</button>
  </mat-menu>
`
);
