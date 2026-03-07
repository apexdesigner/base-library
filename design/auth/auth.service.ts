import { Service, property, method } from '@apexdesigner/dsl/service';
import { User } from '@business-objects-client';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import createDebug from 'debug';

const debug = createDebug('AuthService');

/**
 * Auth Service
 *
 * Client-side authentication state and actions. Fetches the auth config
 * and current user on load and provides role checking, login, and logout.
 *
 * Consumers can access auth state two ways:
 * - **Subscription**: `authService.currentUser` emits whenever the current user changes
 * - **Async**: `await authService.getCurrentUser()` resolves with the user once initialization completes
 */
export class AuthService extends Service {
  /** Is Authenticated - Whether the user is currently authenticated (undefined until checked) */
  private _authenticated = new BehaviorSubject<boolean | undefined>(undefined);

  /** Is Authenticated - Observable that emits the authentication state on each change */
  authenticated: Observable<boolean | undefined> = this._authenticated.asObservable();

  /** Current User - BehaviorSubject holding the authenticated user */
  private _currentUser = new BehaviorSubject<User | undefined>(undefined);

  /** Current User - Observable that emits the current user on each change */
  currentUser: Observable<User | undefined> = this._currentUser.asObservable();

  /** Auth Enabled - Whether OIDC auth is configured (undefined until config loads) */
  private _authEnabled = new BehaviorSubject<boolean | undefined>(undefined);

  /** Auth Enabled - Observable that emits whether auth is configured on each change */
  authEnabled: Observable<boolean | undefined> = this._authEnabled.asObservable();


  /** Oidc Security Service - Injected OIDC client for login and logout */
  oidcSecurityService!: OidcSecurityService;

  /** Router - Angular router for post-login navigation */
  router!: Router;

  /** Return URL - URL to navigate to after login */
  returnUrl?: string;

  /** Ready Resolve - Resolves the ready promise when initialization completes */
  private readyResolve!: () => void;

  /** Ready Promise - Promise that resolves once initialization completes */
  private readyPromise = new Promise<void>(resolve => {
    this.readyResolve = resolve;
  });

  /** Initialize - Checks OIDC state and fetches current user if authenticated */
  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    debug('initializing');

    try {
      const authResult = await firstValueFrom(this.oidcSecurityService.checkAuth());
      debug('authResult', authResult);

      // Check if the OIDC provider loaded a real config (has an authority)
      const config = await firstValueFrom(this.oidcSecurityService.getConfiguration());
      debug('config', config);
      const hasConfig = !!config?.authority;
      this._authEnabled.next(hasConfig);


      if (hasConfig && authResult?.isAuthenticated) {
        this._authenticated.next(true);

        const user = await User.currentUser();
        debug('user', user);

        if (user) {
          this._currentUser.next(user);
        }

        const returnUrl = sessionStorage.getItem('auth_return_url');
        if (returnUrl) {
          sessionStorage.removeItem('auth_return_url');
          debug('navigating to returnUrl', returnUrl);
          this.router.navigateByUrl(returnUrl);
        }
      } else {
        this._authenticated.next(false);
        if (hasConfig) {
          debug('not authenticated, navigating to login');
          this.router.navigate(['/login']);
        }
      }
    } catch (error) {
      debug('error', error);

      this._authEnabled.next(false);
      this._authenticated.next(false);
      this._currentUser.next(undefined);
    }
    this.readyResolve();
  }

  /** Get Auth Enabled - Returns whether auth is configured once initialization completes */
  async getAuthEnabled(): Promise<boolean> {
    await this.readyPromise;
    return this._authEnabled.value ?? false;
  }

  /** Get Is Authenticated - Returns whether the user is authenticated once initialization completes */
  async getAuthenticated(): Promise<boolean> {
    await this.readyPromise;
    return this._authenticated.value ?? false;
  }

  /** Get Current User - Returns the current user once initialization completes */
  async getCurrentUser(): Promise<User | undefined> {
    debug('waiting for ready');

    await this.readyPromise;
    debug('currentUser', this._currentUser.value);

    return this._currentUser.value;
  }

  /** Has Role - Checks if the current user has a specific role */
  async hasRole(roleName: string): Promise<boolean> {
    debug('roleName', roleName);

    await this.readyPromise;

    const user = this._currentUser.value;
    const result = user?.roleAssignments?.some((ra: any) => ra.role?.name === roleName) ?? false;
    debug('result', result);

    return result;
  }

  /** Access Token - Observable that emits the current OIDC access token */
  accessToken: Observable<string> = this.oidcSecurityService.getAccessToken();

  /** Get Access Token - Returns the current OIDC access token */
  async getAccessToken(): Promise<string> {
    return firstValueFrom(this.oidcSecurityService.getAccessToken());
  }

  /** Login - Saves return URL and initiates the OIDC login flow */
  login(): void {
    debug('login');
    if (this.returnUrl) {
      sessionStorage.setItem('auth_return_url', this.returnUrl);
      debug('saved returnUrl', this.returnUrl);
    }
    this.oidcSecurityService.authorize();
  }

  /** Logout - Logs the user out and clears session */
  logout(): void {
    debug('logout');
    this.oidcSecurityService.logoff().subscribe();
  }
}
