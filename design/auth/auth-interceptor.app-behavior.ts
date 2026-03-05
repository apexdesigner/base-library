import { addAppBehavior } from '@apexdesigner/dsl';
import { HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { AuthService } from '@services';
import { switchMap } from 'rxjs';
import createDebug from 'debug';

const debug = createDebug('authInterceptor');

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
            // If we have a token — clone the request and add the Authorization header
            if (token) {
              debug('token', token);
              return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
            }

            // Otherwise pass the request through without auth
            debug('no token');
            return next(req);
          })
        )
    );
  }
);
