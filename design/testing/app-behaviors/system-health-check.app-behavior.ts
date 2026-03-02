import { addAppBehavior } from "@apexdesigner/dsl";

addAppBehavior(
  {
    type: "Class Behavior",
    httpMethod: "Get",
    path: "/api/health",
  },
  async function systemHealthCheck() {
    return { status: "ok" };
  },
);
