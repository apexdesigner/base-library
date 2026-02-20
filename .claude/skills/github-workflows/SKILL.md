---
name: GitHub Workflows
description: Sets up GitHub Actions workflows for Apex Designer projects. Includes CI/CD with npm publishing and issue-to-project automation.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# GitHub Workflows Setup

Sets up GitHub Actions workflows for Apex Designer projects.

## Usage

Ask Claude to "set up GitHub workflows" or "add CI/CD workflows".

## Installation

Copy workflows from the package to your project:

```bash
mkdir -p .github/workflows
cp node_modules/@apexdesigner/claude-skills/.github/workflows/* .github/workflows/
```

## Available Workflows

### CI/CD (`ci-cd.yml`)
- Runs on push to main/master/release branches
- Publishes to npm on version tags (using trusted publishing/OIDC)
- Slack notifications for build/publish status

### Issue to Project (`add-issue-to-project.yml`)
- Automatically adds new issues to a GitHub project board

## Customizations

The workflows are fully parameterized - repo name, package name, and version are pulled automatically from GitHub context and `package.json`. No changes needed for most AD3 projects.

### add-issue-to-project.yml

The workflow is pre-configured for the **Apex Designer 3** project board. No changes needed for AD3 repos.

**For a different project board**, update the project ID:

```yaml
-f project="PVT_kwDOBg3r-c4BJdm5"  # Change to your project ID
```

To find your project ID:
1. Go to your GitHub project board
2. Open browser DevTools → Network tab
3. Refresh the page and look for GraphQL requests
4. Find `projectId` in the response (starts with `PVT_`)

## GitHub Configuration

These org-wide secrets/variables are already configured for Apex Designer repos:

| Name | Type | Description |
|------|------|-------------|
| `NPM_READ_ONLY_TOKEN` | Secret | npm token for installing private packages |
| `AD3_SLACK_WEBHOOK_URL` | Secret | Slack webhook for #apex-designer-3 channel |
| `APP_ID` | Variable | GitHub App ID for project automation |
| `APP_PEM` | Secret | GitHub App private key |

**For a different Slack channel**, update the secret name in ci-cd.yml:

```yaml
env:
  SLACK_WEBHOOK_URL: ${{ secrets.YOUR_WEBHOOK_SECRET }}
```

For non-Apex Designer repos, configure these secrets/variables in your repository or organization settings.

## Updating Workflows

Workflows are copied during installation and don't auto-update. After updating the npm package, compare and sync:

```bash
diff -r .github/workflows node_modules/@apexdesigner/claude-skills/.github/workflows
```

If there are differences, copy the updated workflows:

```bash
cp node_modules/@apexdesigner/claude-skills/.github/workflows/* .github/workflows/
```
