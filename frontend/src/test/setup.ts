import '@testing-library/jest-dom/vitest';

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  window.ResizeObserver = window.ResizeObserver || (FakeResizeObserver as unknown as typeof ResizeObserver);
  // @ts-expect-error global polyfill
  global.ResizeObserver = global.ResizeObserver || FakeResizeObserver;

  if (typeof HTMLCanvasElement !== 'undefined') {
    const dummyCtx = {
      fillRect: () => {},
      clearRect: () => {},
      getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Array(w * h * 4) }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      fillText: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      bezierCurveTo: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {}
    };
    HTMLCanvasElement.prototype.getContext = function (type: string) {
      if (type === '2d') return dummyCtx as unknown as CanvasRenderingContext2D;
      return null;
    };
  }
}
