export const MACHINE_TYPES: [string, string][] = [
  ["WELDING_MACHINE", "Welding machine"],
  ["GRINDER", "Grinder"],
  ["GAS_CUTTING_SET", "Gas cutting set"],
  ["DRILLING_MACHINE", "Drilling machine"],
  ["CHAIN_PULLEY_BLOCK", "Chain pulley block"],
  ["DG_SET", "DG set"],
  ["COMPRESSOR", "Compressor"],
  ["OTHER", "Other"],
];
export const MACHINE_STATUS_TONE = {
  AT_FACTORY: "slate",
  RUNNING: "green",
  IDLE: "amber",
  UNDER_REPAIR: "red",
  SENT_OUT_FOR_REPAIR: "red",
  RETURNED_TO_FACTORY: "blue",
} as const;
