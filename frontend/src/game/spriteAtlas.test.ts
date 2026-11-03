import { describe, expect, it } from 'vitest';
import { getAllSpriteDefs, getSpriteDef, compileSprite } from './spriteAtlas';
import { PALETTE, COLOR_MAP, SPRITES } from './spriteData';

describe('Sprite Pipeline & Atlas', () => {
  it('contains all required sprite sets matching the Art Bible', () => {
    const sprites = getAllSpriteDefs();
    expect(sprites.length).toBeGreaterThanOrEqual(15);

    // Verify categories
    const categories = new Set(sprites.map((s) => s.category));
    expect(categories.has('terrain')).toBe(true);
    expect(categories.has('territory')).toBe(true);
    expect(categories.has('adventurer')).toBe(true);
    expect(categories.has('guild')).toBe(true);
    expect(categories.has('dragon')).toBe(true);
  });

  it('strictly adheres to the 32-color palette', () => {
    const validColors = new Set<string>();
    validColors.add('transparent');
    Object.values(PALETTE).forEach((ramp) => {
      ramp.forEach((c) => validColors.add(c.toLowerCase()));
    });

    for (const [char, hex] of Object.entries(COLOR_MAP)) {
      if (hex !== 'transparent') {
        expect(validColors.has(hex.toLowerCase())).toBe(true);
      }
    }

    for (const sprite of SPRITES) {
      for (const [idx, row] of sprite.rows.entries()) {
        if (row.length !== sprite.width) {
          throw new Error(
            `Sprite ${sprite.id} row ${idx} has length ${row.length}, expected ${sprite.width}: "${row}"`
          );
        }
        for (const ch of row) {
          expect(COLOR_MAP[ch]).toBeDefined();
        }
      }
      expect(sprite.rows.length).toBe(sprite.height);
    }
  });

  it('compiles 5 distinct dragon power tiers', () => {
    const dragon0 = getSpriteDef('dragon_tier0_sleeping');
    const dragon1 = getSpriteDef('dragon_tier1_stirring');
    const dragon2 = getSpriteDef('dragon_tier2_awake');
    const dragon3 = getSpriteDef('dragon_tier3_enraged');
    const dragon4 = getSpriteDef('dragon_tier4_inferno');

    expect(dragon0).toBeDefined();
    expect(dragon1).toBeDefined();
    expect(dragon2).toBeDefined();
    expect(dragon3).toBeDefined();
    expect(dragon4).toBeDefined();

    expect(dragon0?.width).toBe(48);
    expect(dragon0?.height).toBe(48);
  });

  it('compiles offscreen canvases for sprites', () => {
    const grass = getSpriteDef('terrain_grass_plain');
    expect(grass).toBeDefined();
    if (grass) {
      const canvas = compileSprite(grass);
      expect(canvas).toBeDefined();
    }
  });
});
