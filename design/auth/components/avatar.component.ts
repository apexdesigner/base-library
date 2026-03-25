import { Component, method, applyTemplate } from "@apexdesigner/dsl/component";
import { AuthService } from "@services";
import { Router } from "@angular/router";

/**
 * Avatar
 *
 * User avatar button with a menu showing the current user email and logout.
 * Shows a "Switch User" option when impersonation is enabled.
 */
export class AvatarComponent extends Component {
  /** Auth Service */
  authService!: AuthService;

  /** Router */
  router!: Router;

  /** Allow Impersonation - Whether the server allows user switching */
  allowImpersonation = false;

  /** Initialize - Check if impersonation is available */
  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    try {
      const response = await fetch("/api/auth/config");
      if (response.ok) {
        const config = await response.json();
        this.allowImpersonation = !!config?.allowImpersonation;
      }
    } catch {}
  }

  /** Switch User - Navigate to the switch user page */
  switchUser(): void {
    this.router.navigate(["/switch-user"]);
  }

  /** Logout */
  logout(): void {
    this.authService.logout();
  }

  /** User Menu - Reference to the menu component */
  userMenu!: any;
}

applyTemplate(AvatarComponent, [
  {
    element: "button",
    name: "menuTrigger",
    attributes: { "mat-icon-button": null, matMenuTriggerFor: "<- userMenu" },
    contains: [{ "mat-icon": "person" }],
  },
  {
    element: "mat-menu",
    name: "userMenu",
    referenceable: true,
    contains: [
      {
        element: "div",
        name: "userEmail",
        text: "{{(authService.currentUser | async)?.email}}",
        attributes: { "mat-menu-item": null, disabled: "<- true" },
      },
      {
        if: "allowImpersonation",
        contains: [
          {
            element: "button",
            name: "switchUserButton",
            text: "Switch User",
            attributes: { "mat-menu-item": null, click: "-> switchUser()" },
          },
        ],
      },
      {
        element: "button",
        name: "logoutButton",
        text: "Logout",
        attributes: { "mat-menu-item": null, click: "-> logout()" },
      },
    ],
  },
]);
