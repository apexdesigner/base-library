import { addAppBehavior } from "@apexdesigner/dsl";
import { HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { AuthService } from "@services";
import createDebug from "debug";

const debug = createDebug("authInterceptor");

addAppBehavior(
  {
    type: "Interceptor",
    sequence: 100,
  },
  async function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Promise<HttpEvent<unknown>> {
    const authService = AuthService;

    if (!authService.isAuthEnabled()) {
      debug("auth disabled, no token");
      return next(req);
    }

    const token = await authService.getAccessToken();

    if (token) {
      debug("token", req.url);
      return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
    }

    debug("no token", req.url);
    return next(req);
  },
);
