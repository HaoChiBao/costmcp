/** Vertical offset applied to all hooks (drops them below the top edge). */
export const HOOK_TOP_OFFSET = 40;

/** Global size multiplier for side bills (applied to each hook's scale). */
export const BILL_SIZE_MULTIPLIER = 2.5;

export type SideHookConfig = {
  id: string;
  left: string;
  drop: number;
  topExtra: number;
  scale: number;
  zIndex: number;
  swayDelay: number;
  swayDuration: number;
  swayAngle: number;
};

/**
 * Dense asymmetric gallery — more bills on the left, right matched in scale.
 * Tight horizontal spacing + z-index layering creates overlap.
 */
export const SIDE_HOOKS: SideHookConfig[] = [
  // —— Left cluster (10) ——
  {
    id: "l1",
    left: "2%",
    drop: 4,
    topExtra: 0,
    scale: 0.26,
    zIndex: 2,
    swayDelay: 0,
    swayDuration: 4.6,
    swayAngle: 1.6,
  },
  {
    id: "l2",
    left: "6%",
    drop: 38,
    topExtra: 12,
    scale: 0.28,
    zIndex: 5,
    swayDelay: 0.45,
    swayDuration: 5.4,
    swayAngle: 2.2,
  },
  {
    id: "l3",
    left: "10%",
    drop: 14,
    topExtra: 24,
    scale: 0.24,
    zIndex: 3,
    swayDelay: 0.9,
    swayDuration: 4.1,
    swayAngle: 1.3,
  },
  {
    id: "l4",
    left: "14%",
    drop: 52,
    topExtra: 6,
    scale: 0.27,
    zIndex: 7,
    swayDelay: 0.2,
    swayDuration: 6.1,
    swayAngle: 2.5,
  },
  {
    id: "l5",
    left: "18%",
    drop: 22,
    topExtra: 18,
    scale: 0.25,
    zIndex: 4,
    swayDelay: 1.2,
    swayDuration: 5,
    swayAngle: 1.8,
  },
  {
    id: "l6",
    left: "22%",
    drop: 46,
    topExtra: 32,
    scale: 0.29,
    zIndex: 8,
    swayDelay: 0.65,
    swayDuration: 4.8,
    swayAngle: 2,
  },
  {
    id: "l7",
    left: "26%",
    drop: 8,
    topExtra: 10,
    scale: 0.23,
    zIndex: 2,
    swayDelay: 1.55,
    swayDuration: 3.7,
    swayAngle: 1.1,
  },
  {
    id: "l8",
    left: "30%",
    drop: 34,
    topExtra: 20,
    scale: 0.28,
    zIndex: 6,
    swayDelay: 0.35,
    swayDuration: 5.6,
    swayAngle: 2.3,
  },
  {
    id: "l9",
    left: "34%",
    drop: 56,
    topExtra: 4,
    scale: 0.26,
    zIndex: 9,
    swayDelay: 1.8,
    swayDuration: 6.5,
    swayAngle: 1.7,
  },
  {
    id: "l10",
    left: "38%",
    drop: 18,
    topExtra: 14,
    scale: 0.25,
    zIndex: 4,
    swayDelay: 0.75,
    swayDuration: 4.4,
    swayAngle: 1.4,
  },
  {
    id: "l11",
    left: "42%",
    drop: 44,
    topExtra: 26,
    scale: 0.27,
    zIndex: 7,
    swayDelay: 1.25,
    swayDuration: 5.2,
    swayAngle: 2,
  },
  {
    id: "l12",
    left: "46%",
    drop: 10,
    topExtra: 8,
    scale: 0.24,
    zIndex: 3,
    swayDelay: 0.6,
    swayDuration: 4.6,
    swayAngle: 1.5,
  },
  // —— Right cluster (9) — matched scale to left ——
  {
    id: "r1",
    left: "58%",
    drop: 12,
    topExtra: 8,
    scale: 0.27,
    zIndex: 3,
    swayDelay: 1.1,
    swayDuration: 5.1,
    swayAngle: 1.9,
  },
  {
    id: "r2",
    left: "62%",
    drop: 42,
    topExtra: 22,
    scale: 0.28,
    zIndex: 6,
    swayDelay: 0.5,
    swayDuration: 4.7,
    swayAngle: 2.4,
  },
  {
    id: "r3",
    left: "66%",
    drop: 24,
    topExtra: 0,
    scale: 0.25,
    zIndex: 4,
    swayDelay: 1.65,
    swayDuration: 5.9,
    swayAngle: 1.5,
  },
  {
    id: "r4",
    left: "70%",
    drop: 50,
    topExtra: 16,
    scale: 0.29,
    zIndex: 8,
    swayDelay: 0.15,
    swayDuration: 6.2,
    swayAngle: 2.6,
  },
  {
    id: "r5",
    left: "74%",
    drop: 6,
    topExtra: 28,
    scale: 0.26,
    zIndex: 2,
    swayDelay: 0.95,
    swayDuration: 4.2,
    swayAngle: 1.2,
  },
  {
    id: "r6",
    left: "78%",
    drop: 36,
    topExtra: 10,
    scale: 0.28,
    zIndex: 7,
    swayDelay: 1.35,
    swayDuration: 5.3,
    swayAngle: 2.1,
  },
  {
    id: "r7",
    left: "82%",
    drop: 20,
    topExtra: 20,
    scale: 0.24,
    zIndex: 5,
    swayDelay: 0.55,
    swayDuration: 4.5,
    swayAngle: 1.6,
  },
  {
    id: "r8",
    left: "86%",
    drop: 48,
    topExtra: 6,
    scale: 0.27,
    zIndex: 9,
    swayDelay: 1.45,
    swayDuration: 6,
    swayAngle: 2.8,
  },
  {
    id: "r9",
    left: "90%",
    drop: 10,
    topExtra: 18,
    scale: 0.26,
    zIndex: 3,
    swayDelay: 0.25,
    swayDuration: 5.5,
    swayAngle: 1.7,
  },
  {
    id: "r10",
    left: "96%",
    drop: 40,
    topExtra: 10,
    scale: 0.28,
    zIndex: 10,
    swayDelay: 1.75,
    swayDuration: 5.7,
    swayAngle: 2.4,
  },
];

/** Center hook starts large; grows to full hero size on scroll. */
export const HOOK_SCALE_START = 0.72;
export const HOOK_SCALE_END = 1;

export function scaledBillSize(baseScale: number) {
  return baseScale * BILL_SIZE_MULTIPLIER;
}
