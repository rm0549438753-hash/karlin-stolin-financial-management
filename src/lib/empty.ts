// Stable empty array for query defaults. `data = []` creates a new array every
// render, which re-triggers effects/memos and can loop until React crashes.
export const EMPTY_ARRAY: never[] = Object.freeze([]) as unknown as never[];
