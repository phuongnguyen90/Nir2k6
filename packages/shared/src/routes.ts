// REST route constants — shared so server and dashboard never drift.
export const API = {
  health: "/api/health",
  auth: {
    signup: "/api/auth/signup",
    login: "/api/auth/login",
    me: "/api/auth/me",
  },
  children: "/api/children",
  child: (id: string) => `/api/children/${id}`,
  devices: "/api/devices",
  device: (id: string) => `/api/devices/${id}`,
  enrollCode: "/api/devices/enroll-code",
  enroll: "/api/devices/enroll", // device-side, uses enroll code
  rules: "/api/rules",
  rule: (id: string) => `/api/rules/${id}`,
  rulesForChild: (childId: string) => `/api/children/${childId}/rules`,
  schedules: "/api/schedules",
  schedule: (id: string) => `/api/schedules/${id}`,
  schedulesForChild: (childId: string) => `/api/children/${childId}/schedules`,
  policyForDevice: (deviceId: string) => `/api/devices/${deviceId}/policy`,
  activity: "/api/ingest/activity", // device-side (device token)
  heartbeat: "/api/ingest/heartbeat", // device-side
  captures: "/api/ingest/captures", // device-side, multipart
  activityForDevice: (deviceId: string) => `/api/devices/${deviceId}/activity`,
  capturesForDevice: (deviceId: string) => `/api/devices/${deviceId}/captures`,
  alerts: "/api/alerts",
  ackAlert: (id: string) => `/api/alerts/${id}/ack`,
  ws: "/ws", // agent websocket
} as const;

export const DEVICE_TOKEN_HEADER = "x-device-token";
