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
};
