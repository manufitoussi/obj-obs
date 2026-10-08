import { describe, expect, it } from 'vitest';
import ObjObs, { observe, set } from '../src/index.js';

describe('registry', () => {
  it('keeps order and per key notifications on an object with many subscriptions', () => {
    // A data context shared by many bindings.
    const context = { properties: { color: 'red', width: 1 } };
    const calls: string[] = [];
    const disposers = Array.from({ length: 50 }, (_, i) => {
      const binding = { dataContext: context };
      const key = i % 2 ? 'width' : 'color';
      return observe(binding, `dataContext.properties.${key}`, () => calls.push(`${key}${i}`));
    });
    expect(ObjObs._countAttachments(context.properties)).toBe(50);

    set(context, 'properties.color', 'blue');
    expect(calls).toEqual(Array.from({ length: 25 }, (_, i) => `color${i * 2}`));

    calls.length = 0;
    set(context, 'properties', { color: 'green', width: 2 });
    expect(calls).toHaveLength(50);
    expect(calls[0]).toBe('color0');
    expect(calls[49]).toBe('width49');
    expect(ObjObs._countAttachments(context.properties)).toBe(50);

    disposers.forEach((dispose) => dispose());
    expect(ObjObs._countAttachments(context)).toBe(0);
    expect(ObjObs._countAttachments(context.properties)).toBe(0);
  });

  it('drops a subscription left on a chain changed without notification', () => {
    const o = { a: { b: 1 } };
    const old = o.a;
    const values: unknown[] = [];
    observe(o, 'a.b', (e) => values.push(e.newValue));

    // Direct change of an intermediate value, not notified.
    o.a = { b: 2 };
    set(old, 'b', 3);
    expect(values).toEqual([]);
    expect(ObjObs._countAttachments(old)).toBe(0);
  });
});
