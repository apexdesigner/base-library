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

applyTemplate(NotAuthorizedPage, [
  {
    element: 'flex-column',
    attributes: { class: 'not-authorized-container', grow: null },
    contains: [
      { h2: 'Access Denied' },
      {
        if: 'email',
        contains: [
          {
            element: 'p',
            contains: [
              { strong: '{{ email }}' },
            ],
            text: ' is not authorized to access this system.',
          },
        ],
        elseContains: [
          { p: 'Your account is not authorized to access this system.' },
        ],
      },
      { p: 'Please contact your administrator if you believe this is an error.' },
      {
        element: 'button',
        text: 'Sign Out',
        attributes: { 'mat-raised-button': null, color: 'primary', click: '-> logout()' },
      },
    ],
  },
]);

applyStyles(
  NotAuthorizedPage,
  `
  .not-authorized-container {
    align-items: center;
    justify-content: center;
  }
`
);
