import { useEffect, useRef, useState } from 'react';
import { getAllSpriteDefs, compileSprite, SpriteDefinition } from '../game/spriteAtlas';
import { PALETTE } from '../game/spriteData';

export function SpritesDevPage() {
  const sprites = getAllSpriteDefs();
  const [category, setCategory] = useState<string>('all');
  const [scale, setScale] = useState<number>(2);

  const categories = ['all', ...Array.from(new Set(sprites.map((s) => s.category)))];

  const filtered = category === 'all' ? sprites : sprites.filter((s) => s.category === category);

  return (
    <section data-testid="page-sprites" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-pixel text-sm text-gold-2">16-Bit SNES Sprite Atlas</h2>
          <p className="mt-1 text-xs text-stone-2">
            In-repo sprite pipeline · 32-color fixed palette · Pixel-perfect canvas rasterization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-stone-2">Scale:</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                type="button"
                className={`btn px-2 py-1 text-xs ${scale === s ? 'bg-ink-3 text-gold-2' : ''}`}
                onClick={() => setScale(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 32-Color Palette Display */}
      <div className="panel p-4">
        <h3 className="font-pixel text-[10px] text-gold-2">Art Bible 32-Color Fixed Palette</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-8">
          {Object.entries(PALETTE).map(([ramp, colors]) => (
            <div key={ramp} className="space-y-1">
              <span className="text-[10px] uppercase text-stone-3">{ramp}</span>
              <div className="flex gap-1">
                {colors.map((c, i) => (
                  <div
                    key={i}
                    className="h-6 w-6 border border-ink-3"
                    style={{ backgroundColor: c }}
                    title={`${ramp}[${i}]: ${c}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`btn text-xs ${category === c ? 'border-gold-2 bg-ink-3 text-gold-2' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Sprite Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((sprite) => (
          <SpriteCard key={sprite.id} sprite={sprite} scale={scale} />
        ))}
      </div>
    </section>
  );
}

function SpriteCard({ sprite, scale }: { sprite: SpriteDefinition; scale: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const compiled = compileSprite(sprite);
    canvas.width = sprite.width * scale;
    canvas.height = sprite.height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(compiled, 0, 0, canvas.width, canvas.height);
  }, [sprite, scale]);

  return (
    <div className="panel flex flex-col items-center p-3 text-center">
      <div className="flex min-h-[96px] w-full items-center justify-center rounded border border-ink-3 bg-ink-0 p-2">
        <canvas ref={canvasRef} className="pixelated" />
      </div>
      <p className="mt-2 font-pixel text-[9px] text-gold-2">{sprite.name}</p>
      <p className="mt-1 font-mono text-[10px] text-stone-3">
        {sprite.width}×{sprite.height} · {sprite.category}
      </p>
      <p className="font-mono text-[9px] text-stone-4">{sprite.id}</p>
    </div>
  );
}

