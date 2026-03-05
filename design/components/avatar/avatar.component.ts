import { Component, applyTemplate } from '@apexdesigner/dsl/component';
import { AuthService } from '@services';

/**
 * Avatar
 *
 * User avatar button with a menu showing the current user email and logout.
 */
export class AvatarComponent extends Component {
  /** Auth Service */
  authService!: AuthService;

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
    <button mat-menu-item (click)="logout()">Logout</button>
  </mat-menu>
`
);
