import { addAppBehavior } from '@apexdesigner/dsl';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '@services';
import { MatSnackBar } from '@angular/material/snack-bar';
import createDebug from 'debug';

const debug = createDebug('roleGuard');

/**
 * Role Guard
 *
 * Client-side route guard that checks authentication and role requirements.
 */
addAppBehavior(
  {
    type: 'Guard',
    stage: 'Activate',
    sequence: 100
  },
  async function roleGuard(route: ActivatedRouteSnapshot, state: RouterStateSnapshot, router: Router, authService: AuthService, snackBar: MatSnackBar): Promise<boolean> {
    debug('checking auth');
    const authEnabled = await authService.getAuthEnabled();
    debug('authEnabled', authEnabled);

    if (!authEnabled) {
      return true;
    }

    const user = await authService.getCurrentUser();

    if (!user) {
      debug('not authenticated, redirecting to login');
      authService.returnUrl = state.url;
      router.navigate(['/login']);
      return false;
    }

    const requiredRoles: string[] = route.data['roles'] ?? [];
    debug('requiredRoles', requiredRoles);

    if (requiredRoles.length === 0) {
      return true;
    }

    for (const role of requiredRoles) {
      const hasRole = await authService.hasRole(role);
      if (hasRole) {
        debug('has role', role);
        return true;
      }
    }

    debug('missing required role');
    snackBar.open('You do not have permission to access this page.', 'OK', { duration: 5000 });
    return false;
  }
);
