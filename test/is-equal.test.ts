import { describe, expect, it } from 'vitest';
import { isEqual, observe, set } from '../src/index.js';

describe('isEqual', () => {
  it('compares primitives', () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual('a', 'a')).toBe(true);
    expect(isEqual(NaN, NaN)).toBe(true);
    expect(isEqual(0, -0)).toBe(true);
    expect(isEqual(null, null)).toBe(true);
    expect(isEqual(1, '1')).toBe(false);
    expect(isEqual(null, undefined)).toBe(false);
    expect(isEqual(0, null)).toBe(false);
    expect(isEqual(1, { valueOf: () => 1 })).toBe(false);
  });

  it('compares dates and regular expressions by value', () => {
    expect(isEqual(new Date(1000), new Date(1000))).toBe(true);
    expect(isEqual(new Date(1000), new Date(2000))).toBe(false);
    expect(isEqual(new Date(NaN), new Date(NaN))).toBe(true);
    expect(isEqual(/a/g, /a/g)).toBe(true);
    expect(isEqual(/a/g, /a/i)).toBe(false);
  });

  it('compares arrays and plain objects deeply', () => {
    expect(isEqual([1, { a: [2, 3] }], [1, { a: [2, 3] }])).toBe(true);
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(isEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isEqual({ a: undefined }, { b: undefined })).toBe(false);
    expect(isEqual([], {})).toBe(false);
    expect(isEqual(Object.create(null), {})).toBe(false);
  });

  it('compares typed arrays by content', () => {
    expect(isEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
    expect(isEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
    expect(isEqual(new Uint8Array([1]), new Int8Array([1]))).toBe(false);
  });

  it('compares maps and sets', () => {
    const key = {};
    expect(isEqual(new Map([[key, { a: 1 }]]), new Map([[key, { a: 1 }]]))).toBe(true);
    expect(isEqual(new Map([[{}, 1]]), new Map([[{}, 1]]))).toBe(false);
    expect(isEqual(new Set([1, key]), new Set([key, 1]))).toBe(true);
    expect(isEqual(new Set([{}]), new Set([{}]))).toBe(false);
  });

  it('compares class instances by identity', () => {
    class Actor {
      constructor(public name: string) {}
    }
    const actor = new Actor('a');
    expect(isEqual(actor, actor)).toBe(true);
    expect(isEqual(new Actor('a'), new Actor('a'))).toBe(false);
    expect(isEqual({ actor }, { actor })).toBe(true);
    expect(isEqual({ actor: new Actor('a') }, { actor: new Actor('a') })).toBe(false);
  });

  it('supports cyclic structures', () => {
    const a: Record<string, unknown> = { v: 1 };
    a.self = a;
    const b: Record<string, unknown> = { v: 1 };
    b.self = b;
    expect(isEqual(a, b)).toBe(true);
    b.v = 2;
    expect(isEqual(a, b)).toBe(false);
  });
});

describe('set', () => {
  it('does not notify when the value is the same', () => {
    const o = { v: 1, n: NaN, obj: { a: 1 } };
    let calls = 0;
    observe(o, 'v', () => calls++);
    observe(o, 'n', () => calls++);
    observe(o, 'obj', () => calls++);
    set(o, 'v', 1);
    set(o, 'n', NaN);
    set(o, 'obj', o.obj);
    expect(calls).toBe(0);

    // Identity only: an equal but new object is a change.
    set(o, 'obj', { a: 1 });
    set(o, 'v', 2);
    expect(calls).toBe(2);
  });
});
