import type { Trade } from "@prisma/client";

export const TRADE_LABELS: Record<Trade, { en: string; hi: string }> = {
  FITTER: { en: "Fitter", hi: "फिटर" },
  WELDER: { en: "Welder", hi: "वेल्डर" },
  GRINDER: { en: "Grinder", hi: "ग्राइंडर" },
  GAS_CUTTER: { en: "Gas Cutter", hi: "गैस कटर" },
  HELPER: { en: "Helper", hi: "हेल्पर" },
  RIGGER: { en: "Rigger", hi: "रिगर" },
  PAINTER: { en: "Painter", hi: "पेंटर" },
};
