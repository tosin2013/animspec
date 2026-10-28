/**
 * Per-primitive demo content for the gallery and loop generators. Most
 * primitives render the generic synthetic sweep; a primitive whose look comes
 * from frame data the sweep does not carry (labels/coords, or a reveal driven
 * by frame index) gets a specific, on-purpose example here, so its committed
 * thumbnail and loop show something a real caller would draw. Generator-only:
 * never imported by `src/`.
 */

export interface Demo {
  /** Raw layer params merged over the primitive type before sanitize. */
  layer?: Record<string, unknown>;
  /** Frame labels. */
  labels?: string[];
  /** Frame coords (normalized 0..1). */
  coords?: { x: number; y: number }[];
  /** Frame index at which the demo is fully built (for the gallery thumbnail). */
  fullIndex: number;
}

export const DEMOS: Record<string, Demo> = {
  "diagram-build": {
    layer: { framesPerStep: 1, labelSize: 13 },
    labels: ["Claim", "Evidence", "Warrant", "Conclusion"],
    coords: [
      { x: 0.13, y: 0.5 },
      { x: 0.37, y: 0.5 },
      { x: 0.61, y: 0.5 },
      { x: 0.87, y: 0.5 },
    ],
    fullIndex: 20,
  },
  "chapter-card": {
    layer: {
      kicker: "PART I",
      title: "The Blur",
      subtitle: "Why everything online looks the same",
      fadeFrames: 3,
      holdFrames: 6,
      kickerSize: 16,
      titleSize: 40,
      subtitleSize: 20,
    },
    fullIndex: 5,
  },
  "type-reveal": {
    layer: {
      text: "the frame tells the story",
      framesPerUnit: 2,
      fontSize: 34,
      emphasisStart: 4,
      emphasisEnd: 4,
    },
    fullIndex: 10,
  },
  "quote-card": {
    layer: {
      quote: '"the same spec, the same frame"',
      attribution: "— the animspec promise",
      framesPerUnit: 1,
      quoteSize: 22,
      attrSize: 14,
    },
    fullIndex: 10,
  },
  "rig": {
    layer: {
      rig: "host",
      pose: "talk",
      headAngle: -6,
      scale: 0.55,
      y: 0.88,
    },
    fullIndex: 12,
  },
  "emitter": {
    layer: {
      shape: "petal",
      source: "top",
      rate: 200,
      life: 3,
      speed: 0.35,
      gravity: 0.3,
      spread: 60,
      size: 26,
    },
    fullIndex: 150,
  },
  "figure": {
    layer: {
      count: 6,
      stance: "stand",
      arrangement: "row",
      highlight: 3,
      reveal: 0.25,
    },
    labels: ["Ana", "Ben", "Cal", "Dot", "Eli", "Fay"],
    fullIndex: 90,
  },
  // #133: a data series the host supplies (each coord's y a value), fully revealed.
  "line-chart": {
    layer: { points: 12, fill: true, thickness: 3 },
    coords: [0.22, 0.3, 0.27, 0.41, 0.38, 0.52, 0.47, 0.6, 0.56, 0.71, 0.66, 0.82].map((y, i) => ({ x: i / 11, y })),
    fullIndex: 12,
  },
};
