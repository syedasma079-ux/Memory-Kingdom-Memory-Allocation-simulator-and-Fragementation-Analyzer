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
}
