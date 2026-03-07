import { addAppBehavior } from '@apexdesigner/dsl';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { AuthService } from '@services';
import { switchMap } from 'rxjs';
import createDebug from 'debug';

const debug = createDebug('authInterceptor');

/**
 * Auth Interceptor
 *
 * Attaches the OIDC access token to outgoing API requests.
 */
addAppBehavior(
  {
    type: 'Interceptor',
    sequence: 100
  },
  function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn, authService: AuthService) {
    // Skip external requests — only attach tokens to our own API.
    if (!req.url.startsWith('/api/')) {
      return next(req);
    }

    // authService.accessToken emits the current OIDC access token.
    return (
      authService.accessToken
        // .pipe() chains an operation onto that emitted value.
        .pipe(
          // switchMap() waits for the token, then runs this function with it.
          switchMap(token => {
            const headers: Record<string, string> = {};

            if (token) {
              debug('token', token);
              headers['Authorization'] = `Bearer ${token}`;
            }

            // Add impersonation header if set in sessionStorage
            const impersonateUserId = sessionStorage.getItem('impersonateUserId');
            if (impersonateUserId) {
              debug('impersonating user', impersonateUserId);
              headers['X-Impersonate-User-Id'] = impersonateUserId;
            }

            if (Object.keys(headers).length > 0) {
              return next(req.clone({ setHeaders: headers }));
            }

            debug('no token');
            return next(req);
          })
        )
    );
  }
);
