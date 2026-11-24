import { test } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "./index.js";
import { makeTestConfig } from "./test-helpers.js";

test("health, auth flow and child creation work end-to-end", async () => {
  const { app } = await buildServer({ config: makeTestConfig(), scheduleLoop: false });
  await app.ready();

  // health
  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.equal(health.json().status, "ok");

  // signup
  const signup = await app.inject({
    method: "POST",
    url: "/api/auth/signup",
    payload: { email: "parent@example.com", password: "supersecret", displayName: "Parent" },
  });
  assert.equal(signup.statusCode, 201);
  const token: string = signup.json().token;
  assert.ok(token);

  // me (authed)
  const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${token}` } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().parent.email, "parent@example.com");

  // me (unauthed)
  const unauth = await app.inject({ method: "GET", url: "/api/auth/me" });
  assert.equal(unauth.statusCode, 401);

  // login
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "parent@example.com", password: "supersecret" },
  });
  assert.equal(login.statusCode, 200);

  // bad login
  const badLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "parent@example.com", password: "nope" },
  });
  assert.equal(badLogin.statusCode, 401);

  // create child + enroll flow
  const child = await app.inject({
    method: "POST",
    url: "/api/children",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Kiddo", birthYear: 2015 },
  });
  assert.equal(child.statusCode, 201);
  const childId: string = child.json().child.id;

  const codeRes = await app.inject({
    method: "POST",
    url: "/api/devices/enroll-code",
    headers: { authorization: `Bearer ${token}` },
    payload: { childId, name: "Tablet", platform: "android" },
  });
  assert.equal(codeRes.statusCode, 201);
  const enrollCode: string = codeRes.json().enrollCode;

  const enroll = await app.inject({
    method: "POST",
    url: "/api/devices/enroll",
    payload: { enrollCode, name: "Tablet", platform: "android" },
  });
  assert.equal(enroll.statusCode, 201);
  assert.ok(enroll.json().token);
  const deviceId: string = enroll.json().device.id;

  // reusing an enroll code fails
  const reuse = await app.inject({
    method: "POST",
    url: "/api/devices/enroll",
    payload: { enrollCode, name: "Tablet2", platform: "android" },
  });
  assert.equal(reuse.statusCode, 400);

  // policy fetch as parent
  const policy = await app.inject({
    method: "GET",
    url: `/api/devices/${deviceId}/policy`,
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(policy.statusCode, 200);
  assert.equal(policy.json().policy.deviceId, deviceId);

  // validation error -> 400
  const bad = await app.inject({
    method: "POST",
    url: "/api/children",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "" },
  });
  assert.equal(bad.statusCode, 400);

  await app.close();
});

test("device-token ingest records activity and raises an alert", async () => {
  const { app } = await buildServer({ config: makeTestConfig(), scheduleLoop: false });
  await app.ready();

  const token: string = (
    await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: { email: "a@b.com", password: "password123", displayName: "A" },
    })
  ).json().token;
  const auth = { authorization: `Bearer ${token}` };
  const childId: string = (
    await app.inject({ method: "POST", url: "/api/children", headers: auth, payload: { name: "C" } })
  ).json().child.id;
  const code: string = (
    await app.inject({
      method: "POST",
      url: "/api/devices/enroll-code",
      headers: auth,
      payload: { childId, name: "PC", platform: "windows" },
    })
  ).json().enrollCode;
  const enrolled = (
    await app.inject({
      method: "POST",
      url: "/api/devices/enroll",
      payload: { enrollCode: code, name: "PC", platform: "windows" },
    })
  ).json();
  const deviceToken: string = enrolled.token;
  const deviceId: string = enrolled.device.id;

  const ingest = await app.inject({
    method: "POST",
    url: "/api/ingest/activity",
    headers: { "x-device-token": deviceToken },
    payload: { events: [{ ts: new Date().toISOString(), type: "web", url: "https://pornhub.com/x" }] },
  });
  assert.equal(ingest.statusCode, 200);
  assert.equal(ingest.json().alerts, 1);

  const alerts = await app.inject({ method: "GET", url: "/api/alerts", headers: auth });
  assert.equal(alerts.statusCode, 200);
  assert.equal(alerts.json().alerts.length, 1);

  const activity = await app.inject({
    method: "GET",
    url: `/api/devices/${deviceId}/activity`,
    headers: auth,
  });
  assert.equal(activity.statusCode, 200);
  assert.equal(activity.json().total, 1);

  // missing device token -> 401
  const noToken = await app.inject({
    method: "POST",
    url: "/api/ingest/heartbeat",
    payload: { ts: new Date().toISOString() },
  });
  assert.equal(noToken.statusCode, 401);

  await app.close();
});
