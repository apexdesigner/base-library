# Storybook Skill

Setup and manage Storybook for Angular projects with Compodoc integration, accessibility testing, and development utilities.

## Commands

### Initial Setup

Set up Storybook in an Angular project:

```bash
npx storybook@latest init --type angular
```

Install additional recommended addons:

```bash
npm install -D @storybook/addon-a11y @compodoc/compodoc
```

### Development

```bash
# Start Storybook dev server
npm run storybook

# Restart Storybook (kills existing, starts fresh with logging)
.claude/skills/storybook/scripts/restart-storybook.sh

# Build static Storybook
npm run build-storybook
```

**Note:** Storybook watches source files and rebuilds automatically when you add/remove stories or update components. You don't need to run `npm run build` separately. Configuration changes (main.ts, preview.ts) may require a restart.

---

## Configuration Guide

### 1. Angular Configuration (angular.json)

Add or update the storybook targets. Replace `<project>` with your project name (found as a key under `projects` in angular.json):

```json
"storybook": {
  "builder": "@storybook/angular:start-storybook",
  "options": {
    "configDir": ".storybook",
    "browserTarget": "<project>:build",
    "compodoc": true,
    "compodocArgs": ["-e", "json", "-d", ".storybook", "--disableInternal", "--disablePrivate"],
    "port": 6006
  }
},
"build-storybook": {
  "builder": "@storybook/angular:build-storybook",
  "options": {
    "configDir": ".storybook",
    "browserTarget": "<project>:build",
    "compodoc": true,
    "compodocArgs": ["-e", "json", "-d", ".storybook", "--disableInternal", "--disablePrivate"],
    "outputDir": "storybook-static"
  }
}
```

**Compodoc flags:**
- `--disableInternal`: Hides members marked with `@internal` JSDoc tag
- `--disablePrivate`: Hides private/protected class members

### 2. Storybook Main Config (.storybook/main.ts)

```typescript
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
  staticDirs: ['./public'],
  docs: {
    autodocs: 'tag',
  },
};

export default config;
```

### 3. Preview Config (.storybook/preview.ts)

```typescript
import type { Preview } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { provideAnimations } from '@angular/platform-browser/animations';
import { setCompodocJson } from '@storybook/addon-docs/angular';
import docJson from './documentation.json';

setCompodocJson(docJson);

const preview: Preview = {
  decorators: [
    applicationConfig({
      providers: [provideAnimations()],
    }),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
```

### 4. TypeScript Config (.storybook/tsconfig.json)

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": ["node"],
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true
  },
  "include": ["../src/**/*.stories.*", "./preview.ts"],
  "exclude": ["../src/**/*.spec.ts"]
}
```

### 5. Type Declarations (.storybook/typings.d.ts)

```typescript
declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.md' {
  const content: string;
  export default content;
}
```

### 6. Preview Head (.storybook/preview-head.html)

For Angular Material projects:

```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
```

### 7. GitIgnore Updates

Add to `.gitignore`:

```
# Storybook
.storybook/documentation.json
storybook-static/
```

---

## Custom Branding (Optional)

Create `.storybook/manager.ts` for custom theming:

```typescript
import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming/create';

const theme = create({
  base: 'light',
  brandTitle: 'My Component Library',
  brandUrl: 'https://github.com/myorg/myrepo',
  brandImage: '/logo.svg',
  colorPrimary: '#3f51b5',
  colorSecondary: '#3f51b5',
  appBg: '#f5f5f5',
  appContentBg: '#ffffff',
  barBg: '#ffffff',
  fontBase: '"Roboto", "Helvetica Neue", Arial, sans-serif',
});

addons.setConfig({ theme });
```

---

## Angular Material Integration

### A11y Configuration

Material components may trigger false positives for color-contrast. Add to `.storybook/preview.ts`:

```typescript
parameters: {
  a11y: {
    config: {
      rules: [
        {
          id: 'color-contrast',
          selector: '*:not(input.mat-mdc-input-element):not(textarea.mat-mdc-input-element)',
        },
      ],
    },
  },
},
```

### Dynamic Form Field Options

Add toolbar controls for Material form field appearance:

```typescript
// .storybook/preview.ts
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

const preview: Preview = {
  globalTypes: {
    formFieldAppearance: {
      description: 'Material form field appearance',
      toolbar: {
        title: 'Appearance',
        icon: 'form',
        items: [
          { value: 'outline', title: 'Outline' },
          { value: 'fill', title: 'Fill' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    formFieldAppearance: 'outline',
  },
  decorators: [
    applicationConfig({
      providers: [
        provideAnimations(),
        {
          provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
          useFactory: () => ({ appearance: 'outline' }), // Use global value
        },
      ],
    }),
  ],
};
```

---

## Story Conventions

### Basic Story Structure

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { MyComponent } from './my-component.component';

const meta: Meta<MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  tags: ['autodocs'],
  argTypes: {
    complexInput: { control: false },  // Disable control for complex objects
    label: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: {
    label: 'Default Label',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    disabled: true,
  },
};
```

### Interaction Testing

```typescript
import { expect, within, userEvent } from '@storybook/test';

export const WithInteraction: Story = {
  args: { label: 'Click me' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /click me/i });
    await userEvent.click(button);
    await expect(canvas.getByText('Clicked!')).toBeInTheDocument();
  },
};
```

### Custom Render Function

```typescript
export const CustomTemplate: Story = {
  render: (args) => ({
    props: args,
    template: `
      <div class="wrapper">
        <my-component [label]="label"></my-component>
      </div>
    `,
  }),
  args: {
    label: 'Wrapped Component',
  },
};
```

### Wrapper Components and Autodocs

**Important:** The `component` in meta determines what autodocs documents. If you use a wrapper component, autodocs will document the wrapper's inputs instead of the actual component.

```typescript
// BAD - autodocs documents WrapperComponent's inputs
const meta: Meta<WrapperComponent> = {
  component: WrapperComponent,
  tags: ['autodocs'],
};

// GOOD - autodocs documents ActualComponent's inputs
const meta: Meta<ActualComponent> = {
  component: ActualComponent,
  tags: ['autodocs'],
};

export const WithContext: Story = {
  render: () => ({
    props: { /* ... */ },
    template: `<wrapper-component><actual-component [control]="control"></actual-component></wrapper-component>`
  }),
};
```

---

## Component Documentation with JSDoc

### Class-Level Documentation

```typescript
/**
 * A reusable button component with multiple variants.
 *
 * Supports primary, secondary, and danger styles.
 */
@Component({...})
export class ButtonComponent { ... }
```

### Input/Output Documentation

```typescript
/** The button label text */
@Input() label!: string;

/** Visual style variant */
@Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';

/** Emitted when the button is clicked */
@Output() buttonClick = new EventEmitter<void>();
```

### Hiding Internal Members

```typescript
/** @internal */
@ViewChild('buttonRef') buttonRef!: ElementRef;

/** @internal */
private internalState = {};

/** @internal */
ngOnInit(): void { ... }
```

### Visibility Summary

| Visibility | JSDoc Tag | Shown in Docs |
|------------|-----------|---------------|
| public | none | Yes |
| public | @internal | No |
| private | any | No |
| protected | any | No |

---

## MDX Pages for Non-Component Classes

Compodoc autodocs only displays Angular **components** (decorated with `@Component`). Standalone classes like form controls, services, and utilities won't appear automatically.

To document these, create MDX files:

```mdx
{/* src/lib/api-reference.mdx */}
import { Meta } from '@storybook/blocks';

<Meta title="API Reference" />

# API Reference

## MyFormGroup

A reactive form group bound to a JSON Schema...

| Property | Type | Description |
|----------|------|-------------|
| `schema` | `JsonSchema` | The bound schema |
| `value` | `T` | Current form value |

## MyService

Provides data fetching and caching...

| Method | Returns | Description |
|--------|---------|-------------|
| `fetch()` | `Observable<T>` | Fetches data from API |
```

The JSDoc on these classes still provides IDE intellisense - MDX pages are for Storybook visibility.

---

## Scripts

### restart-storybook.sh

Restarts Storybook with logging and build status monitoring:

```bash
.claude/skills/storybook/scripts/restart-storybook.sh
```

Features:
- Kills any existing Storybook process
- Starts Storybook in background
- Monitors build for success/failure (90s timeout)
- Outputs build status and URL on completion
- Logs to `logs/storybook.log`

---

## Troubleshooting

### "Cannot find module './documentation.json'"

The compodoc documentation hasn't been generated yet. Run Storybook once to generate it, or run compodoc manually:

```bash
npx compodoc -e json -d .storybook
```

### TypeScript errors with JSON imports

Ensure `resolveJsonModule: true` is set in `.storybook/tsconfig.json`.

### Stories not appearing

Check that story files match the glob patterns in `.storybook/main.ts`:
- Default: `../src/**/*.stories.@(js|jsx|mjs|ts|tsx)`

### A11y false positives with Material

Material's layered styling can trigger color-contrast warnings. Add selector exclusions to the a11y config (see Angular Material Integration section).

### Monaco Editor in Docs View

If using Monaco editor, be aware that Monaco's TypeScript language service is shared across all editor instances on a page. In the Docs tab (which renders multiple stories), type definitions can interfere with each other.

**Solution:** Track extra libs per editor instance using a Map keyed by instance ID, not a global array:

```typescript
// Bad - editors clobber each other
let extraLibDisposables: any[] = [];

// Good - each editor manages its own
const extraLibDisposablesMap = new Map<string, any[]>();
```

Also set `fixedOverflowWidgets: false` in Monaco options to prevent hover tooltips from appearing in wrong positions in docs view.

---

## File Structure

```
.storybook/
├── main.ts              # Storybook config (stories, addons, framework)
├── preview.ts           # Preview settings (decorators, globals, compodoc)
├── preview-head.html    # HTML head content (fonts, CSS)
├── manager.ts           # UI theme/branding (optional)
├── typings.d.ts         # Module declarations
├── tsconfig.json        # TypeScript config
├── public/              # Static assets (logos, images)
└── documentation.json   # Auto-generated by compodoc (gitignored)
```
