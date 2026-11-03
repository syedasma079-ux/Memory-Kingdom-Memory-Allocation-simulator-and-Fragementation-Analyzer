import { useEffect, useRef, useState } from 'react';
import { useSimStore } from '../store/simStore';
import { drawSprite } from '../game/spriteAtlas';

export function LandingScene({
  onEnter,
  onHowToPlay,
  onChallenges,
  onAbout
}: {
  onEnter?: () => void;
  onHowToPlay?: () => void;
  onChallenges?: () => void;
  onAbout?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useSimStore((s) => s.reducedMotion);
  const setLocation = useSimStore((s) => s.setLocation);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let tick = 0;

    const render = () => {
      tick++;
      // Internal resolution 480x270
      const w = 480;
      ctx.imageSmoothingEnabled = false;

      // 1. Sky Gradient (Ink #241a38 down to #3a2c55)
      const grad = ctx.createLinearGradient(0, 0, 0, 160);
      grad.addColorStop(0, '#120e1c');
      grad.addColorStop(0.4, '#241a38');
      grad.addColorStop(1, '#3a2c55');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, 160);

      // 2. Animated Clouds
      const cloudSpeed = reducedMotion ? 0 : (tick * 0.25) % (w + 100);
      ctx.fillStyle = '#8c8996';
      ctx.fillRect((cloudSpeed + 50) % (w + 80) - 40, 25, 48, 10);
      ctx.fillRect((cloudSpeed + 60) % (w + 80) - 40, 20, 28, 16);
      ctx.fillStyle = '#c4c1c9';
      ctx.fillRect((cloudSpeed + 260) % (w + 80) - 40, 45, 60, 12);
      ctx.fillRect((cloudSpeed + 275) % (w + 80) - 40, 40, 32, 18);

      // 3. Mountains in background
      ctx.fillStyle = '#3c3a41';
      ctx.beginPath();
      ctx.moveTo(0, 150);
      ctx.lineTo(80, 70);
      ctx.lineTo(160, 150);
      ctx.lineTo(240, 85);
      ctx.lineTo(330, 150);
      ctx.lineTo(410, 60);
      ctx.lineTo(480, 150);
      ctx.lineTo(480, 170);
      ctx.lineTo(0, 170);
      ctx.fill();

      // Mountain snow caps (#c4c1c9)
      ctx.fillStyle = '#c4c1c9';
      ctx.beginPath();
      ctx.moveTo(80, 70);
      ctx.lineTo(65, 95);
      ctx.lineTo(95, 95);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(410, 60);
      ctx.lineTo(390, 88);
      ctx.lineTo(430, 88);
      ctx.fill();

      // 4. Forest and Hill layer (#1f3d2b, #2f6b3a)
      ctx.fillStyle = '#1f3d2b';
      ctx.fillRect(0, 140, w, 40);
      ctx.fillStyle = '#2f6b3a';
      ctx.fillRect(0, 155, w, 115);

      // 5. River winding across the realm (#1f5a8a, #3b8fc4)
      ctx.fillStyle = '#17304f';
      ctx.beginPath();
      ctx.moveTo(120, 155);
      ctx.bezierCurveTo(150, 180, 200, 200, 280, 270);
      ctx.lineTo(330, 270);
      ctx.bezierCurveTo(240, 200, 180, 180, 160, 155);
      ctx.fill();

      ctx.fillStyle = '#3b8fc4';
      ctx.beginPath();
      ctx.moveTo(130, 155);
      ctx.bezierCurveTo(155, 180, 205, 200, 290, 270);
      ctx.lineTo(315, 270);
      ctx.bezierCurveTo(235, 200, 175, 180, 150, 155);
      ctx.fill();

      // River ripple highlights
      const ripple = reducedMotion ? 0 : Math.sin(tick * 0.1) * 3;
      ctx.fillStyle = '#8fd3ef';
      ctx.fillRect(170 + ripple, 185, 20, 2);
      ctx.fillRect(230 - ripple, 225, 28, 2);

      // 6. Castle & Watchtowers on left hill
      // Main Keep
      ctx.fillStyle = '#5e5b66';
      ctx.fillRect(30, 115, 60, 45);
      // Castle battlements
      ctx.fillStyle = '#8c8996';
      for (let bx = 30; bx < 90; bx += 10) {
        ctx.fillRect(bx, 108, 6, 7);
      }
      // Roof and tower door
      ctx.fillStyle = '#120e1c';
      ctx.fillRect(50, 138, 14, 22);

      // Tallest Watchtower (where Dragon is coiled)
      ctx.fillStyle = '#3c3a41';
      ctx.fillRect(85, 90, 24, 70);
      ctx.fillStyle = '#5e5b66';
      ctx.fillRect(81, 82, 32, 10);
      // Banner on tower
      drawSprite(ctx, 'kingdom_flag', 105, 68, 1);

      // Coiled Dragon on Watchtower
      const dragonTierSprite = 'dragon_tier0_sleeping';
      drawSprite(ctx, dragonTierSprite, 70, 42, 0.9);

      // 7. Villages, Watchtower on right, and Pine Trees
      drawSprite(ctx, 'territory_alloc_building', 210, 165, 1.5);
      drawSprite(ctx, 'territory_alloc_building', 245, 175, 1.2);
      drawSprite(ctx, 'territory_alloc_building', 350, 180, 1.8);

      // Gate & walls
      drawSprite(ctx, 'terrain_stone_path', 180, 195, 1);
      drawSprite(ctx, 'terrain_stone_path', 196, 195, 1);

      // Trees scattered
      for (let tx = 10; tx < 460; tx += 45) {
        if (tx < 110 || (tx > 200 && tx < 350)) {
          ctx.fillStyle = '#1f3d2b';
          ctx.beginPath();
          ctx.moveTo(tx, 165);
          ctx.lineTo(tx + 8, 145);
          ctx.lineTo(tx + 16, 165);
          ctx.fill();
        }
      }

      // Torches with animated flicker
      const torchColor = Math.floor(tick / 8) % 2 === 0 ? '#f2c14e' : '#d4483b';
      ctx.fillStyle = '#7a4e12';
      ctx.fillRect(45, 130, 2, 6);
      ctx.fillStyle = torchColor;
      ctx.fillRect(44, 127, 4, 3);

      ctx.fillStyle = '#7a4e12';
      ctx.fillRect(205, 175, 2, 6);
      ctx.fillStyle = torchColor;
      ctx.fillRect(204, 172, 4, 3);

      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [reducedMotion]);

  const handleEnter = () => {
    if (transitioning) return;
    if (reducedMotion) {
      if (onEnter) onEnter();
      else setLocation('arena');
      return;
    }
    setTransitioning(true);
    setTimeout(() => {
      if (onEnter) onEnter();
      else setLocation('arena');
    }, 400); // 400ms transition <= 1.2s requirement
  };

  return (
    <div
      data-testid="landing-scene"
      className={`relative overflow-hidden rounded-lg border-4 border-ink-3 shadow-2xl transition-opacity duration-300 ${
        transitioning ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* 480x270 Pixel-Art Canvas */}
      <canvas
        ref={canvasRef}
        width={480}
        height={270}
        className="pixelated block h-auto w-full object-contain"
        aria-label="Cinematic view of Memory Kingdom with castle, river, forest, and dragon on watchtower"
      />

      {/* JRPG Title Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-between bg-gradient-to-t from-ink-0/90 via-transparent to-ink-0/80 p-4 text-center sm:p-6">
        <div className="space-y-1">
          <h1 className="font-pixel text-xl tracking-wider text-gold-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] sm:text-2xl md:text-3xl">
            MEMORY KINGDOM
          </h1>
          <p className="font-mono text-xs font-semibold tracking-widest text-gold-3 drop-shadow sm:text-sm">
            THE ART OF MANAGING THE REALM
          </p>
        </div>

        {/* 4 Primary Action Buttons per v3 Spec */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="btn border-gold-2 bg-ink-1 px-4 py-2 font-pixel text-xs text-gold-3 shadow-lg hover:bg-gold-0"
            data-testid="landing-enter"
            onClick={handleEnter}
          >
            ENTER THE KINGDOM
          </button>
          <button
            type="button"
            className="btn bg-ink-2 px-3 py-2 text-xs text-stone-3 hover:text-gold-2"
            data-testid="landing-how"
            onClick={() => {
              if (onHowToPlay) onHowToPlay();
              else setLocation('settings');
            }}
          >
            HOW TO PLAY
          </button>
          <button
            type="button"
            className="btn bg-ink-2 px-3 py-2 text-xs text-stone-3 hover:text-gold-2"
            data-testid="landing-challenges"
            onClick={() => {
              if (onChallenges) onChallenges();
              else setLocation('quests');
            }}
          >
            MEMORY CHALLENGES
          </button>
          <button
            type="button"
            className="btn bg-ink-2 px-3 py-2 text-xs text-stone-3 hover:text-gold-2"
            data-testid="landing-about"
            onClick={() => {
              if (onAbout) onAbout();
              else setLocation('overview');
            }}
          >
            ABOUT THE REALM
          </button>
        </div>
      </div>
    </div>
  );
}

