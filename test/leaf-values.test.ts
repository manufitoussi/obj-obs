import { describe, expect, it } from 'vitest';
import { notify, observe, set } from '../src/index.js';
import type { ChangeEvent } from '../src/index.js';

function record<V>(events: ChangeEvent<V>[]) {
  return (e: ChangeEvent<V>) => events.push({ ...e, changed: { ...e.changed } });
}

describe('values at the end of the path', () => {
  it('gives the old and new values of a changed leaf', () => {
    const actor = { properties: { color: 'red' } };
    const events: ChangeEvent<string>[] = [];
    observe(actor, 'properties.color', record(events));
    set(actor, 'properties.color', 'blue');
    expect(events).toEqual([
      { path: 'properties.color', root: actor, oldValue: 'red', newValue: 'blue', changed: { object: actor.properties, key: 'color' } },
    ]);
  });

  it('gives the leaf values when an intermediate value is replaced', () => {
    const actor = { properties: { color: 'red' } };
    const oldProperties = actor.properties;
    const events: ChangeEvent<string>[] = [];
    observe(actor, 'properties.color', record(events));
    set(actor, 'properties', { color: 'blue' });
    expect(events).toEqual([{ path: 'properties.color', root: actor, oldValue: 'red', newValue: 'blue', changed: { object: actor, key: 'properties' } }]);
    expect(oldProperties).not.toBe(actor.properties);
  });

  it('does not notify when the replaced intermediate value holds the same leaf', () => {
    const actor = { properties: { color: 'red', width: 1 } };
    const events: ChangeEvent<unknown>[] = [];
    observe(actor, 'properties.color', record(events));
    observe(actor, 'properties.width', record(events));
    set(actor, 'properties', { color: 'red', width: 2 });
    expect(events.map((e) => e.path)).toEqual(['properties.width']);

    // Still following the new object.
    set(actor, 'properties.color', 'blue');
    expect(events.map((e) => e.path)).toEqual(['properties.width', 'properties.color']);
  });

  it('notifies an explicit notify() on an intermediate value changed in place', () => {
    const actor = { properties: { color: 'red' } };
    const events: ChangeEvent<string>[] = [];
    observe(actor, 'properties.color', record(events));
    actor.properties.color = 'blue';
    notify(actor, 'properties', actor.properties, actor.properties);
    expect(events).toHaveLength(1);
    expect(events[0].newValue).toBe('blue');
  });

  it('gives null for a missing leaf', () => {
    const o: { a: { b: number } | null } = { a: { b: 1 } };
    const events: ChangeEvent<number>[] = [];
    observe(o, 'a.b', record(events));
    set(o, 'a', null);
    set(o, 'a', { b: 2 });
    expect(events.map((e) => [e.oldValue, e.newValue])).toEqual([
      [1, null],
      [null, 2],
    ]);
  });
});
