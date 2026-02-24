# Pages

A page is a routable view in the application. Page files are named `<name>.page.ts` and by default are created in `design/pages/`.

## Class

A page file exports a class that extends `Page`. The class name uses the entity name with a `Page` suffix (e.g., `OrganizationPage`).
```typescript
// organization.page.ts

import { Page } from "@apexdesigner/dsl/page";

export class OrganizationPage extends Page {}
```

## Page Decorator

The `@page()` decorator configures routing, navigation, and access control.

### Path

Set `path` for the page route. Path parameters map to property names:

```typescript
@page({ path: "/organizations/:organization.id" })
export class OrganizationPage extends Page {}
```

### Parent Page

Set `parentPage` to nest a page under another in the navigation hierarchy:

```typescript
import { OrganizationsPage } from "@pages";

@page({
  path: "/organizations/:organization.id",
  parentPage: OrganizationsPage,
})
export class OrganizationPage extends Page {}
```

### Roles

By default, pages are accessible by all authenticated users. Use `roles` to restrict access to specific [roles](roles.md):

```typescript
import { Administrator, Tutor, Student as StudentRole } from "@roles";

@page({
  path: "/organizations/:organization.id",
  parentPage: OrganizationsPage,
  roles: [Administrator, Tutor, StudentRole],
})
export class OrganizationPage extends Page {}
```

### Sidenav

Control how the page appears in the sidenav:

```typescript
@page({
  path: "/organizations",
  sidenavIcon: "business",
})
export class OrganizationsPage extends Page {}
```

Use `excludeFromSidenav` to hide the page:

```typescript
@page({
  path: "/organization-details/:organization.id",
  parentPage: OrganizationsPage,
  excludeFromSidenav: true,
})
export class OrganizationDetailsPage extends Page {}
```

## Properties

Properties are declared as class members. Use `@property()` only when configuration is needed.

### Data Properties

Business object properties are typed using generated client types from `@business-objects-client`:

```typescript
import { property } from "@apexdesigner/dsl/page";
import { OrganizationFormGroup, StudentFormArray } from "@business-objects-client";

export class OrganizationPage extends Page {

  @property({ read: "Automatically", save: "Automatically" })
  organization!: OrganizationFormGroup;

  students: StudentFormArray = this.organization.students;
}
```

`read` and `save` control when data operations happen:

- `"Automatically"` — read/save on load and on changes
- `"On Demand"` — read/save only when explicitly triggered

### Read Options

Data properties support read options for filtering, sorting, and including relationships:

```typescript
@property({
  read: "Automatically",
  include: {
    terms: { order: [{ field: "startDate", direction: "desc" }] },
    students: { order: [{ field: "lastName", direction: "asc" }, { field: "firstName", direction: "asc" }] },
  },
})
organization!: OrganizationFormGroup;
```

Available read options:

- `where` — filter conditions
- `order` — sort order
- `include` — relationships to load with nested read options
- `fields` — fields to include (mutually exclusive with `omit`)
- `omit` — fields to exclude (mutually exclusive with `fields`)
- `limit` — maximum number of records
- `offset` — number of records to skip

### Property Triggers

Properties can trigger methods after read, save, or change operations:

```typescript
export class OrganizationPage extends Page {

  @property({ read: "Automatically", afterReadCall: "onOrganizationLoaded" })
  organization!: OrganizationFormGroup;

  async onOrganizationLoaded(): Promise<void> {
    // ...
  }
}
```

Available property triggers:

- `afterReadCall` — called after data is read
- `afterSaveCall` — called after data is saved
- `onChangeCall` — called when the property value changes

### Form Field Options

Control form behavior with `required` and `disabled`:

```typescript
@property({
  read: "Automatically",
  save: "Automatically",
  required: ["firstName", "lastName", "email"],
  disabled: ["createdDate"],
})
student!: StudentFormGroup;
```

### Service Injection

Services are injected as properties:

```typescript
import { AuthService } from "@services";

export class OrganizationPage extends Page {

  authService!: AuthService;

}
```

## Methods

Methods are declared as class members. Use `@method()` only when configuration is needed.

### Lifecycle Hooks

```typescript
import { method } from "@apexdesigner/dsl/page";

export class OrganizationPage extends Page {

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    // ...
  }

  @method({ callOnUnload: true })
  async cleanup(): Promise<void> {
    // ...
  }

}
```

Available lifecycle options:

- `callOnLoad` — call when the page loads
- `callAfterLoad` — call after the page view initializes
- `callOnUnload` — call when the page is destroyed

### Debounce

```typescript
@method({ debounceMilliseconds: 300 })
async search(): Promise<void> {
  // ...
}
```

### Exposed to Parent

Use `exposedToParent` to make a method callable from a parent page or component:

```typescript
@method({ exposedToParent: true })
async refresh(): Promise<void> {
  // ...
}
```

## Template

Use `applyTemplate()` after the class to define the page markup. See [templates](templates.md) for the full template syntax reference.

```typescript
import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { OrganizationFormGroup } from "@business-objects-client";

@page({ path: "/organizations/:organization.id" })
export class OrganizationPage extends Page {

  @property({ read: "Automatically", save: "Automatically" })
  organization!: OrganizationFormGroup;

}

applyTemplate(OrganizationPage, `
  <if condition="organization.reading">
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  </if>
  <if condition="!organization.reading">
    <apex-flex-column>
      <apex-breadcrumb-v2>
        <apex-breadcrumb-level label="Organizations" path="/organizations"></apex-breadcrumb-level>
        <apex-breadcrumb-level [label]="organization.name"></apex-breadcrumb-level>
      </apex-breadcrumb-v2>
    </apex-flex-column>
  </if>
`);
```

## Styles

Use `applyStyles()` for page-specific CSS:

```typescript
import { Page, page, applyStyles } from "@apexdesigner/dsl/page";

@page({ path: "/organizations" })
export class OrganizationsPage extends Page {}

applyStyles(OrganizationsPage, `
  :host {
    display: flex;
    flex-direction: column;
  }
`);
```

## Complete Example

```typescript
import { Page, page, property, method, applyTemplate } from "@apexdesigner/dsl/page";
import { OrganizationFormGroup, StudentFormArray, TermFormArray } from "@business-objects-client";
import { AuthService } from "@services";
import { OrganizationsPage } from "@pages";
import { Administrator, Tutor, Student as StudentRole } from "@roles";

@page({
  path: "/organizations/:organization.id",
  parentPage: OrganizationsPage,
  roles: [Administrator, Tutor, StudentRole],
})
export class OrganizationPage extends Page {

  @property({
    read: "Automatically",
    save: "Automatically",
    include: {
      terms: { order: [{ field: "startDate", direction: "desc" }] },
      students: { order: [{ field: "lastName", direction: "asc" }, { field: "firstName", direction: "asc" }] },
    },
  })
  organization!: OrganizationFormGroup;

  students: StudentFormArray = this.organization.students;

  terms: TermFormArray = this.organization.terms;

  isAdmin!: boolean;

  authService!: AuthService;

  @method({ callOnLoad: true })
  async initialize(): Promise<void> {
    this.isAdmin = await this.authService.hasRole("Administrator");
  }

}

applyTemplate(OrganizationPage, `
  <if condition="organization.reading">
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  </if>
  <if condition="!organization.reading">
    <apex-flex-column>
      <apex-flex-row [centerVertical]="true" gap="0">
        <apex-breadcrumb-v2 [grow]="true">
          <apex-breadcrumb-level label="Organizations" path="/organizations"></apex-breadcrumb-level>
          <apex-breadcrumb-level [label]="organization.name"></apex-breadcrumb-level>
        </apex-breadcrumb-v2>
        <a mat-icon-button routerLink="/organizationDetails/{{organization.id}}" matTooltip="Edit Details">
          <mat-icon class="material-icons-outlined">edit</mat-icon>
        </a>
        <if condition="isAdmin">
          <apex-delete-button [object]="organization" afterDeleteRoute="/organizations"></apex-delete-button>
        </if>
      </apex-flex-row>
      <apex-flex-row [grow]="true" [gap]="40">
        <terms-section [terms]="terms" [organization]="organization" [grow]="true" [scroll]="true"></terms-section>
        <students-section [students]="students" [organization]="organization" [grow]="true" [scroll]="true"></students-section>
      </apex-flex-row>
    </apex-flex-column>
  </if>
`);
```
