/**
 * Ambient declaration for pixelmatch (ships without types).
 * Must be a script file (no imports/exports) so `declare module` is ambient.
 */
declare module 'pixelmatch' {
  interface PixelmatchOptions {
    threshold?: number;
    includeAA?: boolean;
    alpha?: number;
    aaColor?: [number, number, number];
    diffColor?: [number, number, number];
    diffColorAlt?: [number, number, number];
    diffMask?: boolean;
    mask?: Uint8Array;
  }
  function pixelmatch(
    img1: Buffer | Uint8Array,
    img2: Buffer | Uint8Array,
    output: Buffer | Uint8Array,
    width: number,
    height: number,
    options?: PixelmatchOptions,
  ): number;
  export default pixelmatch;
}
