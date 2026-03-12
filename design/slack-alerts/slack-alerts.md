# Slack Alerts

The slack-alerts feature sends lifecycle notifications to a Slack channel via webhook.

## Setup

The [slack alerts](slack-alerts-properties.app-properties.ts) app properties hold the `SlackAlerts` client instance as a server-side singleton. The [setup slack alerts](setup-slack-alerts.app-behavior.ts) app behavior initializes the client at startup (sequence 50), reading the app name and version from `package.json`. It requires the `SLACK_WEBHOOK_URL` environment variable; if not set, alerts are disabled gracefully.

## Lifecycle Notifications

On startup, the setup behavior sends a "started" notification with the app name, version, URL, and environment context. The [slack alerts shutdown](slack-alerts-shutdown.app-behavior.ts) app behavior sends a "stopped" notification during graceful shutdown (sequence 900). This requires the process to receive `SIGTERM`; a `SIGKILL` (e.g., `kill -9`) bypasses shutdown handlers.

## Error Handling

The [slack alerts error handler](slack-alerts-error-handler.app-behavior.ts) app behavior registers global handlers for `uncaughtException` and `unhandledRejection` events at startup (sequence 60). When triggered, it sends an error notification to Slack with the exception details.
