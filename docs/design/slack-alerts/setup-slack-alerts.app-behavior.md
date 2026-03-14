---
generated-from: design/slack-alerts/setup-slack-alerts.app-behavior.ts
generated-by: design-docs.app-behavior.doc.md
---
# Setup Slack Alerts App Behavior

Initializes the SlackAlerts client and sends a startup notification.
Requires `SLACK_WEBHOOK_URL` env var to enable. If not set, alerts
are disabled gracefully.

**Type:** Lifecycle Behavior

**Stage:** Startup
