import { useEffect, useRef } from 'react';
import { drawSprite } from './spriteAtlas';
import { useSimStore } from '../store/simStore';

interface DragonCanvasProps {
  tier: number; // 0 to 4
  power: number; // 0 to 100
  cracks: number;
}

const TIER_NAMES = ['Sleeping', 'Stirring', 'Awake', 'Enraged', 'Inferno'] as const;
const TIER_SPRITES = [
  'dragon_tier0_sleeping',
  'dragon_tier1_stirring',
  'dragon_tier2_awake',
  'dragon_tier3_enraged',
  'dragon_tier4_inferno'
] as const;

export function DragonCanvas({ tier, power, cracks }: DragonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useSimStore((s) => s.reducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const w = 480;
      const h = 200;
      ctx.imageSmoothingEnabled = false;

      // 1. Dark Dungeon Chamber Background
      ctx.fillStyle = '#120e1c';
      ctx.fillRect(0, 0, w, h);

      // Dungeon stone wall pattern (#241a38, #3c3a41)
      ctx.fillStyle = '#241a38';
      for (let y = 0; y < 140; y += 16) {
        const offset = (y / 16) % 2 === 0 ? 0 : 8;
        for (let x = -8; x < w; x += 16) {
          ctx.fillRect(x + offset, y, 15, 15);
        }
      }

      // Dungeon Floor (#1f3d2b or stone #3c3a41)
      ctx.fillStyle = '#3c3a41';
      ctx.fillRect(0, 140, w, 60);

      // 2. Fissure Cracks scaling with `cracks` (freeBlockCount - 1)
      const numCracks = Math.min(cracks, 20);
      for (let i = 0; i < numCracks; i++) {
        const cx = 30 + (i * 22) % (w - 60);
        const cy = 150 + ((i * 17) % 35);
        // Draw crack
        ctx.strokeStyle = tier >= 3 ? '#d4483b' : tier >= 1 ? '#c98a1b' : '#5e5b66';
        ctx.lineWidth = tier >= 3 ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 8, cy + 6);
        ctx.lineTo(cx + 14, cy + 4);
        ctx.lineTo(cx + 22, cy + 10);
        ctx.stroke();

        // Ember glow for high tiers
        if (tier >= 2 && !reducedMotion) {
          const glow = Math.sin(tick * 0.15 + i) > 0;
          if (glow) {
            ctx.fillStyle = '#f2845c';
            ctx.fillRect(cx + 10, cy + 5, 2, 2);
          }
        }
      }

      // 3. Central Dragon Dais
      ctx.fillStyle = '#5e5b66';
      ctx.fillRect(w / 2 - 60, 130, 120, 14);
      ctx.fillStyle = '#8c8996';
      ctx.fillRect(w / 2 - 50, 126, 100, 6);

      // 4. Render Dragon Sprite
      const spriteId = TIER_SPRITES[Math.max(0, Math.min(tier, 4))] ?? 'dragon_tier0_sleeping';
      const bob = reducedMotion ? 0 : Math.round(Math.sin(tick * 0.08) * (tier + 1));
      drawSprite(ctx, spriteId, w / 2 - 48, 45 + bob, 2);

      // 5. Ambient Aura for Enraged & Inferno
      if (tier >= 3 && !reducedMotion) {
        const auraAlpha = 0.1 + Math.sin(tick * 0.2) * 0.08;
        ctx.fillStyle = tier === 4 ? `rgba(212, 72, 59, ${auraAlpha})` : `rgba(242, 193, 78, ${auraAlpha})`;
        ctx.beginPath();
        ctx.arc(w / 2, 85, 60, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [tier, power, cracks, reducedMotion]);

  const tierName = TIER_NAMES[Math.max(0, Math.min(tier, 4))] ?? 'Unknown';

  return (
    <div
      data-testid="dragon-dungeon-view"
      className="panel overflow-hidden border-2 border-ember-2 bg-ink-0"
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={480}
          height={200}
          className="pixelated block h-auto w-full object-contain"
          aria-label={`Dragon of Fragmentation: Tier ${tier} (${tierName}), Power ${power}%`}
        />
        <div className="absolute top-2 right-2 rounded border border-ink-3 bg-ink-1/90 px-2 py-1 font-mono text-[10px]">
          <span className="text-stone-3">Power: </span>
          <span className="font-pixel text-ember-3">{power}%</span>
          <span className="ml-2 text-stone-3">Tier {tier}: </span>
          <span className="font-pixel text-gold-2">{tierName}</span>
        </div>
      </div>
    </div>
  );
}

