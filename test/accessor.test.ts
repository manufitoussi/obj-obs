import { describe, expect, it } from 'vitest';
import { get, notify, observe, set } from '../src/index.js';

/** Like a Synapps actor: properties mapped to accessors notifying their changes. */
class Properties {
  private _color = 'red';
  private _width = 100;

  get color() {
    return this._color;
  }

  set color(value: string) {
    const oldValue = this._color;
    if (oldValue === value) return;
    this._color = value;
    notify(this, 'color', oldValue, value);
  }

  // Accessor that does not notify.
  get width() {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
  }
}

describe('accessors notifying by themselves', () => {
  it('notifies once through set()', () => {
    const actor = { properties: new Properties() };
    const values: unknown[] = [];
    observe(actor, 'properties.color', (e) => values.push(e.newValue));
    set(actor, 'properties.color', 'blue');
    expect(values).toEqual(['blue']);
    expect(get(actor, 'properties.color')).toBe('blue');
  });

  it('notifies on a direct assignment', () => {
    const actor = { properties: new Properties() };
    const values: unknown[] = [];
    observe(actor, 'properties.color', (e) => values.push(e.newValue));
    actor.properties.color = 'green';
    expect(values).toEqual(['green']);
  });

  it('still notifies through set() for an accessor that does not notify', () => {
    const actor = { properties: new Properties() };
    const values: unknown[] = [];
    observe(actor, 'properties.width', (e) => values.push(e.newValue));
    set(actor, 'properties.width', 200);
    expect(values).toEqual([200]);
  });

  it('only skips the notification of the assigned property', () => {
    class Linked {
      private _a = 0;
      b = 0;

      get a() {
        return this._a;
      }

      // Notifies another property only.
      set a(value: number) {
        this._a = value;
        const oldB = this.b;
        this.b = value * 2;
        notify(this, 'b', oldB, this.b);
      }
    }

    const o = new Linked();
    const keys: string[] = [];
    observe(o, 'a', (e) => keys.push(e.changed.key));
    observe(o, 'b', (e) => keys.push(e.changed.key));
    set(o, 'a', 1);
    expect(keys).toEqual(['b', 'a']);
  });

  it('recovers when an accessor throws', () => {
    class Failing {
      set v(_value: number) {
        throw new Error('rejected');
      }
    }

    const o = { f: new Failing() as unknown as { v: number }, w: 0 };
    let calls = 0;
    observe(o, 'w', () => calls++);
    expect(() => set(o, 'f.v', 1)).toThrow('rejected');
    set(o, 'w', 1);
    expect(calls).toBe(1);
  });
});
