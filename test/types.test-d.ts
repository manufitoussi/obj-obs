import { describe, expectTypeOf, it } from 'vitest';
import { get, observe, set } from '../src/index.js';
import type { Path } from '../src/index.js';

const actor = {
  name: 'Text 1',
  properties: { color: 'red', width: 100, tags: ['a', 'b'] },
  parent: null as null | { name: string },
  render() {},
};

describe('typed paths', () => {
  it('lists reachable paths', () => {
    expectTypeOf<Path<typeof actor>>().toEqualTypeOf<
      | 'name'
      | 'properties'
      | 'properties.color'
      | 'properties.width'
      | 'properties.tags'
      | `properties.tags.${number}`
      | 'properties.tags.length'
      | 'parent'
      | 'parent.name'
    >();
  });

  it('types get()', () => {
    expectTypeOf(get(actor, 'properties.width')).toEqualTypeOf<number | null>();
    expectTypeOf(get(actor, 'properties.tags.0')).toEqualTypeOf<string | null>();
    expectTypeOf(get(actor, 'parent.name')).toEqualTypeOf<string | null>();
  });

  it('falls back to unknown for dynamic paths', () => {
    const path: string = 'properties.color';
    expectTypeOf(get(actor, path)).toEqualTypeOf<unknown>();
  });

  it('types set()', () => {
    set(actor, 'properties.color', 'blue');
    // @ts-expect-error a number is not a color
    set(actor, 'properties.color', 1);
  });
});

describe('typed observations', () => {
  it('types the values given to the callback', () => {
    observe(actor, 'properties.width', (e) => {
      expectTypeOf(e.newValue).toEqualTypeOf<number | null>();
      expectTypeOf(e.root).toEqualTypeOf<typeof actor>();
    });
  });

  it('rejects unknown paths', () => {
    // @ts-expect-error unknown path
    observe(actor, 'properties.colr', () => {});
  });

  it('falls back to unknown for dynamic paths', () => {
    const path: string = 'properties.color';
    observe(actor, path, (e) => {
      expectTypeOf(e.newValue).toEqualTypeOf<unknown>();
    });
  });
});
