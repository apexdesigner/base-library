import { Page, page, applyTemplate, applyStyles, method } from '@apexdesigner/dsl/page';
import { AuthService } from '@services';
import { Everyone } from '@roles';
import { ActivatedRoute } from '@angular/router';

/**
 * Not Authorized
 *
 * Displayed when a user authenticates but is not registered in the system.
 */
@page({ path: '/not-authorized', roles: [Everyone] })
export class NotAuthorizedPage extends Page {
  /** Auth Service */
  authService!: AuthService;

  /** Route */
  route!: ActivatedRoute;

  /** Email */
  email?: string;

  /** Initialize */
  @method({ callOnLoad: true })
  initialize(): void {
    this.email = this.route.snapshot.queryParams['email'];
  }

  /** Logout */
  logout(): void {
    this.authService.logout();
  }
}

applyTemplate(
  NotAuthorizedPage,
  `
  <flex-column class="not-authorized-container" grow>
    <h2>Access Denied</h2>
    <if condition="email">
      <p><strong>{{ email }}</strong> is not authorized to access this system.</p>
      <else>
        <p>Your account is not authorized to access this system.</p>
      </else>
    </if>
    <p>Please contact your administrator if you believe this is an error.</p>
    <button mat-raised-button color="primary" (click)="logout()">Sign Out</button>
  </flex-column>
`
);

applyStyles(
  NotAuthorizedPage,
  `
  .not-authorized-container {
    align-items: center;
    justify-content: center;
  }
`
);
