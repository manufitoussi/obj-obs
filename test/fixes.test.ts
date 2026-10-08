import { describe, expect, it } from 'vitest';
import { get, observe, set, unobserve } from '../src/index.js';
import type { ChangeEvent } from '../src/index.js';

describe('subscriptions', () => {
  it('keeps the paths of a same callback independent', () => {
    const o = { a: { x: 1, y: 1 } };
    const paths: string[] = [];
    const cb = (e: ChangeEvent) => paths.push(e.origin.path);
    observe(o, 'a.x', cb);
    observe(o, 'a.y', cb);

    unobserve(o, 'a.x', cb);
    set(o, 'a', { x: 2, y: 2 });
    expect(paths).toEqual(['a.y']);

    set(o, 'a.x', 3);
    set(o, 'a.y', 3);
    expect(paths).toEqual(['a.y', 'a.y']);
  });

  it('keeps the roots of a same callback independent through a shared object', () => {
    // Two bindings sharing the same data context and the same prototype method.
    const context = { properties: { color: 'red' } };
    const binding1 = { dataContext: context };
    const binding2 = { dataContext: context };
    const roots: object[] = [];
    const cb = (e: ChangeEvent) => roots.push(e.origin.object.deref()!);
    observe(binding1, 'dataContext.properties.color', cb);
    observe(binding2, 'dataContext.properties.color', cb);

    unobserve(binding1, 'dataContext.properties.color', cb);
    set(context, 'properties.color', 'blue');
    expect(roots).toEqual([binding2]);

    set(binding2, 'dataContext', { properties: { color: 'green' } });
    set(context, 'properties.color', 'black');
    expect(roots).toEqual([binding2, binding2]);
  });

  it('ignores a second identical observation', () => {
    const o = { v: 1 };
    let calls = 0;
    const cb = () => calls++;
    observe(o, 'v', cb);
    observe(o, 'v', cb);
    set(o, 'v', 2);
    expect(calls).toBe(1);
  });

  it('returns a function that stops the observation', () => {
    const o = { a: { b: 1 } };
    let calls = 0;
    const dispose = observe(o, 'a.b', () => calls++);
    set(o, 'a.b', 2);
    dispose();
    dispose();
    set(o, 'a.b', 3);
    set(o, 'a', { b: 4 });
    expect(calls).toBe(1);
  });

  it('does not call an observer disposed by a previous callback', () => {
    const o = { v: 1 };
    let calls = 0;
    let dispose2 = () => {};
    observe(o, 'v', () => dispose2());
    dispose2 = observe(o, 'v', () => calls++);
    set(o, 'v', 2);
    expect(calls).toBe(0);
  });

  it('follows a chain completed later', () => {
    const o: { a: { b: number } | null } = { a: null };
    const values: unknown[] = [];
    observe(o, 'a.b', (e) => values.push(structuredClone(e.newValue)));
    set(o, 'a', { b: 1 });
    set(o, 'a.b', 2);
    expect(values).toEqual([{ b: 1 }, 2]);
  });
});

describe('callback errors', () => {
  it('calls every callback and throws the error afterwards', () => {
    const o = { v: 1 };
    let called = false;
    observe(o, 'v', () => {
      throw new Error('boom');
    });
    observe(o, 'v', () => {
      called = true;
    });
    expect(() => set(o, 'v', 2)).toThrow('boom');
    expect(called).toBe(true);
    expect(o.v).toBe(2);
  });

  it('throws an AggregateError when several callbacks fail', () => {
    const o = { v: 1 };
    observe(o, 'v', () => {
      throw new Error('a');
    });
    observe(o, 'v', () => {
      throw new Error('b');
    });
    expect(() => set(o, 'v', 2)).toThrow(AggregateError);
  });
});

describe('get', () => {
  it('returns null on a null or undefined object', () => {
    expect(get(null, 'a' as string)).toBe(null);
    expect(get(undefined, 'a.b' as string)).toBe(null);
  });
});
