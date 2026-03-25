import { Page, page, applyTemplate, applyStyles } from '@apexdesigner/dsl/page';
import { AuthService } from '@services';
import { Everyone } from '@roles';

/**
 * Login
 *
 * Public login page with a button to initiate OIDC login.
 */
@page({ path: '/login', roles: [Everyone] })
export class LoginPage extends Page {
  /** Auth Service */
  authService!: AuthService;

  /** Login */
  login(): void {
    this.authService.login();
  }
}

applyTemplate(LoginPage, [
  {
    element: 'div',
    attributes: { class: 'login-container', grow: null },
    contains: [
      {
        element: 'button',
        text: 'Login',
        attributes: { 'mat-raised-button': null, color: 'primary', click: '-> login()' },
      },
    ],
  },
]);

applyStyles(
  LoginPage,
  `
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }
`
);
