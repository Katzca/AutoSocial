const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiClient } = require("../web/api-client");

test("API client surfaces a backend error message", async () => {
  const api = createApiClient(async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: "TikTok login is already in progress" }),
  }));

  await assert.rejects(
    api.post("/api/tiktok/login"),
    /TikTok login is already in progress/
  );
});

test("API client falls back to the HTTP status for non-JSON errors", async () => {
  const api = createApiClient(async () => ({
    ok: false,
    status: 502,
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
  }));

  await assert.rejects(api.get("/api/status"), /API Error: 502/);
});
