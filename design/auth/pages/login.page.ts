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

applyTemplate(
  LoginPage,
  `
  <div class="login-container" grow>
    <button mat-raised-button color="primary" (click)="login()">Login</button>
  </div>
`
);

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
