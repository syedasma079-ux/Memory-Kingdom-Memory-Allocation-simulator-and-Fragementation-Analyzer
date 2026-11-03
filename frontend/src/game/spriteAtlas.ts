/**
 * MEMORY KINGDOM: Sprite Atlas & Rasterizer
 * Converts palette-indexed character grids into crisp offscreen canvases.
 */

import { COLOR_MAP, SPRITES, SpriteDefinition } from './spriteData';

export type { SpriteDefinition } from './spriteData';

const canvasCache = new Map<string, HTMLCanvasElement>();

/**
 * Compiles a sprite definition into an offscreen HTMLCanvasElement.
 */
export function compileSprite(sprite: SpriteDefinition): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    // SSR / Node test fallback stub
    return {} as HTMLCanvasElement;
  }

  const existing = canvasCache.get(sprite.id);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < sprite.height; y++) {
    const row = sprite.rows[y] ?? '';
    for (let x = 0; x < sprite.width; x++) {
      const char = row[x] ?? '.';
      const color = COLOR_MAP[char] ?? 'transparent';
      if (color !== 'transparent') {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  canvasCache.set(sprite.id, canvas);
  return canvas;
}

/**
 * Pre-compiles all registered sprites into memory.
 */
export function initSpriteAtlas(): Map<string, HTMLCanvasElement> {
  for (const sprite of SPRITES) {
    compileSprite(sprite);
  }
  return canvasCache;
}

/**
 * Draws a sprite onto a destination 2D canvas context.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spriteId: string,
  dx: number,
  dy: number,
  scale: number = 1
): boolean {
  let canvas = canvasCache.get(spriteId);
  if (!canvas) {
    const def = SPRITES.find((s) => s.id === spriteId);
    if (!def) return false;
    canvas = compileSprite(def);
  }

  if (!canvas.width || !canvas.height) return false;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, dx, dy, canvas.width * scale, canvas.height * scale);
  return true;
}

export function getSpriteDef(spriteId: string): SpriteDefinition | undefined {
  return SPRITES.find((s) => s.id === spriteId);
}

export function getAllSpriteDefs(): SpriteDefinition[] {
  return SPRITES;
}

