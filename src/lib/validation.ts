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

// ---- Phase 2 ----
export const tradeSchema = z.enum(["FITTER", "WELDER", "GRINDER", "GAS_CUTTER", "HELPER", "RIGGER", "PAINTER"]);
export const wageTypeSchema = z.enum(["PER_HOUR", "PER_DAY"]);

export const workerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(15).optional().or(z.literal("")),
  trade: tradeSchema,
  joiningDate: dateKey,
  wageType: wageTypeSchema,
  contractorName: z.string().trim().max(80).optional().or(z.literal("")),
  idDocRef: z.string().trim().max(60).optional().or(z.literal("")),
  photoUrl: z.string().max(500).optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const wageRateSchema = z.object({
  rate: z.coerce.number().positive().max(100000),
  otRate: z.coerce.number().positive().max(100000).optional().nullable(),
  effectiveFrom: dateKey,
});

export const attendanceMarkSchema = z.object({
  workerId: z.string().min(1),
  date: dateKey,
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "HOLIDAY"]),
  inTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  outTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  otHours: z.coerce.number().min(0).max(16).default(0),
  remark: z.string().trim().max(200).optional().or(z.literal("")),
});

export const musterSchema = z.object({
  date: dateKey,
  url: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100),
});

export const holidaySchema = z.object({ siteId: z.string().min(1), date: dateKey, name: z.string().trim().min(2).max(80) });

export const dailyPlanSchema = z.object({
  date: dateKey,
  remark: z.string().trim().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        jobId: z.string().min(1),
        stageId: z.string().min(1),
        targetQty: z.coerce.number().min(0).max(999999),
        manpowerPlanned: z.coerce.number().int().min(0).max(10000),
        note: z.string().trim().max(200).optional().or(z.literal("")),
      }),
    )
    .min(1, "Add at least one line")
    .max(50),
});

// ---- Phase 3 ----
export const progressSchema = z.object({
  stageId: z.string().min(1),
  date: dateKey,
  qtyDone: z.coerce.number().min(0).max(999999),
  percentComplete: z.coerce.number().min(0).max(100),
  remark: z.string().trim().max(300).optional().or(z.literal("")),
  workers: z
    .array(z.object({ workerId: z.string().min(1), hours: z.coerce.number().min(0.5).max(16), shift: z.enum(["DAY", "NIGHT"]).default("DAY") }))
    .max(200)
    .default([]),
});

export const dprSubmitSchema = z.object({ date: dateKey, remark: z.string().trim().max(1000).optional().or(z.literal("")) });

// ---- Phase 4/5 ----
export const sitePhotoSchema = z.object({
  url: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100),
  caption: z.string().trim().max(200).optional().or(z.literal("")),
  jobId: z.string().optional().nullable(),
  stageId: z.string().optional().nullable(),
});

export const issueSchema = z.object({
  category: z.enum(["MATERIAL_SHORTAGE", "MACHINE_BREAKDOWN", "MANPOWER_SHORT", "DRAWING_CLARIFICATION", "CLIENT_HOLD", "POWER_WATER", "SAFETY", "PAYMENT", "OTHER"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "WORK_STOPPED"]),
  description: z.string().trim().min(5).max(1000),
  neededFromHO: z.string().trim().max(500).optional().or(z.literal("")),
  photoUrl: z.string().max(500).optional().or(z.literal("")),
  jobId: z.string().optional().nullable(),
});

export const issueActionSchema = z.object({
  action: z.enum(["ACKNOWLEDGE", "IN_PROGRESS", "RESOLVE"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

// ---- Phase 6 ----
export const consCategorySchema = z.enum(["WELDING_ELECTRODE", "MIG_WIRE", "GAS", "GRINDING", "CUTTING", "HAND_TOOL", "PPE_SAFETY", "PAINT", "HARDWARE", "OTHER"]);

export const itemSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: consCategorySchema,
  unit: z.string().trim().min(1).max(20),
  reorderLevel: z.coerce.number().min(0).max(999999).default(0),
  isWeldingConsumable: z.boolean().default(false),
  kgPerUnit: z.coerce.number().positive().max(10000).optional().nullable(),
  active: z.boolean().default(true),
});

export const consDispatchSchema = z.object({
  siteId: z.string().min(1),
  itemId: z.string().min(1),
  qty: z.coerce.number().positive().max(999999),
  dispatchDate: dateKey,
  photoUrl: z.string().max(500).optional().or(z.literal("")),
  vehicleRef: z.string().trim().max(80).optional().or(z.literal("")),
});

export const consReceiveSchema = z.object({
  receivedQty: z.coerce.number().min(0).max(999999),
  remark: z.string().trim().max(300).optional().or(z.literal("")),
});

export const consumeSchema = z.object({
  itemId: z.string().min(1),
  jobId: z.string().min(1),
  stageId: z.string().optional().nullable(),
  date: dateKey,
  qty: z.coerce.number().positive().max(999999),
  remark: z.string().trim().max(200).optional().or(z.literal("")),
});

export const consRequestSchema = z.object({
  itemId: z.string().min(1),
  qty: z.coerce.number().positive().max(999999),
  reason: z.string().trim().min(3).max(300),
  neededBy: dateKey,
});

export const consDecideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  fulfilment: z.enum(["FROM_FACTORY", "LOCAL_PURCHASE"]).optional().nullable(),
  note: z.string().trim().max(300).optional().or(z.literal("")),
}).refine((v) => v.decision === "REJECTED" || !!v.fulfilment, { message: "Choose how it will be fulfilled", path: ["fulfilment"] });

export const consCloseSchema = z.object({
  price: money,
  billPhotoUrl: z.string().min(1, "Bill photo is required").max(500),
});

// ---- Phase 7 ----
export const machineTypeSchema = z.enum(["WELDING_MACHINE", "GRINDER", "GAS_CUTTING_SET", "DRILLING_MACHINE", "CHAIN_PULLEY_BLOCK", "DG_SET", "COMPRESSOR", "OTHER"]);
export const conditionSchema = z.enum(["GOOD", "AVERAGE", "NEEDS_REPAIR"]);

export const machineSchema = z.object({
  type: machineTypeSchema,
  make: z.string().trim().max(80).optional().or(z.literal("")),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  serialNo: z.string().trim().max(80).optional().or(z.literal("")),
});

export const machineDispatchSchema = z.object({
  direction: z.enum(["TO_SITE", "TO_FACTORY"]),
  siteId: z.string().min(1),
  dispatchDate: dateKey,
  condition: conditionSchema,
  photoUrl: z.string().max(500).optional().or(z.literal("")),
  remark: z.string().trim().max(300).optional().or(z.literal("")),
});

export const machineReceiveSchema = z.object({
  condition: conditionSchema,
  photoUrl: z.string().max(500).optional().or(z.literal("")),
  remark: z.string().trim().max(300).optional().or(z.literal("")),
});

export const machineStatusSchema = z.object({ status: z.enum(["RUNNING", "IDLE", "UNDER_REPAIR"]) });

export const ticketSchema = z.object({
  problem: z.string().trim().min(5).max(500),
  raisedOn: dateKey,
});

export const ticketUpdateSchema = z.object({
  repairType: z.enum(["IN_HOUSE", "SENT_OUT"]).optional().nullable(),
  repairedBy: z.string().trim().max(100).optional().or(z.literal("")),
  repairCost: z.coerce.number().min(0).max(99999999).optional().nullable(),
  downtimeDays: z.coerce.number().min(0).max(3650).optional().nullable(),
  parts: z.array(z.object({ item: z.string().trim().min(1).max(100), qty: z.coerce.number().positive().max(1000), price: z.coerce.number().min(0).max(9999999) })).max(30).optional(),
  resolve: z.boolean().default(false),
  verificationNote: z.string().trim().max(500).optional().or(z.literal("")),
});

// ---- Phase 8 ----
export const pettyRequestSchema = z.object({
  amount: money.refine((v) => v > 0, "Amount must be more than 0"),
  reason: z.string().trim().min(3).max(300),
  urgency: z.enum(["NORMAL", "URGENT", "WORK_STOPPED"]).default("NORMAL"),
});

export const pettyDecideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const pettySentSchema = z.object({
  mode: z.enum(["UPI", "BANK", "CASH"]),
  ref: z.string().trim().max(80).optional().or(z.literal("")),
});

export const expenseSchema = z.object({
  date: dateKey,
  amount: money.refine((v) => v > 0, "Amount must be more than 0"),
  category: z.enum(["LABOUR_FOOD", "LOCAL_TRANSPORT", "SMALL_PURCHASE", "HARDWARE", "MEDICAL", "MISC"]),
  description: z.string().trim().min(3).max(300),
  paidTo: z.string().trim().max(100).optional().or(z.literal("")),
  billPhotoUrl: z.string().min(1, "Bill photo is required").max(500),
});

export const reconcileSchema = z.object({
  month: dateKey, // first of month
  physicalCash: money,
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const advanceRequestSchema = z.object({
  workerId: z.string().min(1),
  amount: money.refine((v) => v > 0, "Amount must be more than 0"),
  reason: z.string().trim().min(3).max(300),
});

export const advanceDecideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

export const wageGenerateSchema = z.object({
  period: z.enum(["WEEKLY", "MONTHLY"]),
  start: dateKey,
});
