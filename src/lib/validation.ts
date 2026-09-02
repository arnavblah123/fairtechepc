import { z } from "zod";

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .refine((s) => !isNaN(Date.parse(s + "T00:00:00Z")), "Use a valid date");

export const money = z.coerce.number().min(0).max(99999999);
export const qty = z.coerce.number().min(0).max(999999999);

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(30)
  .regex(/^[a-z0-9._-]+$/, "Only letters, numbers, dot, dash, underscore");

export const passwordSchema = z.string().min(6, "At least 6 characters").max(100);

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1),
});

export const roleSchema = z.enum(["SUPERADMIN", "SITE_INCHARGE", "SUPERVISOR", "VIEWER"]);

export const createUserSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(15).optional().or(z.literal("")),
    role: roleSchema,
    siteId: z.string().optional().nullable(),
  })
  .refine((v) => v.role === "SUPERADMIN" || !!v.siteId, {
    message: "Site is required for this role",
    path: ["siteId"],
  });

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(15).optional().or(z.literal("")),
    role: roleSchema,
    siteId: z.string().optional().nullable(),
    active: z.boolean(),
  })
  .refine((v) => v.role === "SUPERADMIN" || !!v.siteId, {
    message: "Site is required for this role",
    path: ["siteId"],
  });

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const siteSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(8)
    .regex(/^[A-Z0-9]+$/, "Letters and numbers only"),
  name: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(60),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  pettyCashThreshold: money.default(5000),
  active: z.boolean().default(true),
});

export const jobStatusSchema = z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CLOSED"]);
export const unitSchema = z.enum(["MT", "NOS", "METRE", "SQM"]);

export const jobSchema = z
  .object({
    siteId: z.string().min(1),
    name: z.string().trim().min(2).max(120),
    clientName: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    drawingRef: z.string().trim().max(120).optional().or(z.literal("")),
    plannedTonnage: z.coerce.number().positive("Must be more than 0").max(999999),
    plannedStart: dateKey,
    plannedEnd: dateKey,
    weldingNormKgPerMT: z.coerce.number().min(0).max(1000).optional().nullable(),
    status: jobStatusSchema.default("ACTIVE"),
  })
  .refine((v) => v.plannedEnd >= v.plannedStart, { message: "End date must be after start", path: ["plannedEnd"] });

export const jobUpdateSchema = jobSchema.innerType().omit({ siteId: true }).partial().refine(
  (v) => !v.plannedStart || !v.plannedEnd || v.plannedEnd >= v.plannedStart,
  { message: "End date must be after start", path: ["plannedEnd"] },
);

export const stageSchema = z.object({
  name: z.string().trim().min(2).max(60),
  unit: unitSchema,
  plannedQty: z.coerce.number().positive("Must be more than 0").max(999999999),
  plannedDays: z.coerce.number().int().positive("Must be at least 1").max(3650),
});

export const stageReorderSchema = z.object({
  order: z.array(z.string().min(1)).min(1),
});

export const voidSchema = z.object({ reason: z.string().trim().min(3, "Give a reason").max(300) });

export const STAGE_PRESETS = [
  "Marking",
  "Cutting",
  "Fit-up",
  "Welding",
  "Grinding",
  "Inspection",
  "Blasting/Painting",
  "Dispatch/Erection",
];
