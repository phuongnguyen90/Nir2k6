import { z } from "zod";

export const platformSchema = z.enum(["windows", "macos", "linux", "android", "ios"]);
export const ruleKindSchema = z.enum(["domain", "app"]);
export const ruleActionSchema = z.enum(["block", "allow"]);
export const categorySchema = z.enum([
  "adult", "gambling", "violence", "drugs", "social",
  "games", "video", "malware", "custom", "unknown",
]);
export const severitySchema = z.enum(["info", "warn", "alert"]);
export const activityTypeSchema = z.enum(["web", "app", "system"]);
export const scheduleTypeSchema = z.enum(["lock", "allowance"]);

// ---- auth ----
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(80),
});
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

// ---- children / devices ----
export const createChildSchema = z.object({
  name: z.string().min(1).max(80),
  birthYear: z.number().int().min(1990).max(2025).optional(),
  avatarColor: z.string().max(16).optional(),
});
export const updateChildSchema = createChildSchema.partial();

export const enrollDeviceSchema = z.object({
  enrollCode: z.string().min(4).max(64),
  name: z.string().min(1).max(80),
  platform: platformSchema,
  agentVersion: z.string().max(40).optional(),
});
export const createEnrollCodeSchema = z.object({
  childId: z.string().min(1),
  name: z.string().min(1).max(80),
  platform: platformSchema,
});

// ---- rules ----
export const createRuleSchema = z.object({
  childId: z.string().min(1),
  kind: ruleKindSchema,
  pattern: z.string().min(1).max(255),
  action: ruleActionSchema,
  category: categorySchema.optional(),
  note: z.string().max(255).optional(),
});
export const updateRuleSchema = createRuleSchema.omit({ childId: true }).partial();

// ---- schedules ----
export const createScheduleSchema = z.object({
  childId: z.string().min(1),
  name: z.string().min(1).max(80),
  type: scheduleTypeSchema,
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1439),
  dailyQuotaMinutes: z.number().int().min(0).max(1440).optional(),
  enabled: z.boolean().default(true),
});
export const updateScheduleSchema = createScheduleSchema.omit({ childId: true }).partial();

// ---- ingest (device -> server) ----
export const activityEventInSchema = z.object({
  ts: z.string(),
  type: activityTypeSchema,
  title: z.string().max(1024).optional(),
  url: z.string().max(2048).optional(),
  app: z.string().max(255).optional(),
  meta: z.record(z.unknown()).optional(),
});
export const activityBatchSchema = z.object({
  events: z.array(activityEventInSchema).max(500),
});
export const heartbeatSchema = z.object({
  ts: z.string(),
  agentVersion: z.string().max(40).optional(),
  metrics: z.record(z.unknown()).optional(),
});

// ---- alerts ----
export const ackAlertSchema = z.object({ acknowledged: z.boolean().default(true) });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateChildInput = z.infer<typeof createChildSchema>;
export type EnrollDeviceInput = z.infer<typeof enrollDeviceSchema>;
export type CreateEnrollCodeInput = z.infer<typeof createEnrollCodeSchema>;
export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type ActivityEventInput = z.infer<typeof activityEventInSchema>;
export type ActivityBatchInput = z.infer<typeof activityBatchSchema>;
export type HeartbeatInput = z.infer<typeof heartbeatSchema>;
