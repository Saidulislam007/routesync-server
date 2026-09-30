import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import request from "supertest";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017";
process.env.CLIENT_URL ??= "http://localhost:3000";
process.env.API_SHARED_SECRET ??= "local-test-secret";

let app;

before(async () => {
  ({ default: app } = await import("../src/app.js"));
});

after(() => {
  delete process.env.MONGODB_URI;
});

test("GET / returns the API welcome response", async () => {
  const response = await request(app).get("/").expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.message, "Welcome to the RouteSync API");
});

test("GET /api/v1/health returns health information", async () => {
  const response = await request(app).get("/api/v1/health").expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.data.service, "routesync-server");
});

test("unknown routes return a JSON 404 response", async () => {
  const response = await request(app).get("/missing-route").expect(404);

  assert.equal(response.body.success, false);
  assert.match(response.body.message, /Route not found/);
});

test("operations reject requests without a signed session identity", async () => {
  const response = await request(app).get("/api/v1/operations/requests").expect(401);
  assert.equal(response.body.success, false);
});
