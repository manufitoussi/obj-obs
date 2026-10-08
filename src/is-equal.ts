/**
 * Compares two values structurally.
 *
 * - Primitives: `===`, with `NaN` equal to `NaN` (and `0` equal to `-0`).
 * - `Date`: same time. `RegExp`: same source and flags.
 * - Arrays, typed arrays, plain objects: same constructor, same keys, values compared deeply.
 * - `Map`: same keys (by identity), values compared deeply. `Set`: same elements (by identity).
 * - Any other object (class instances, functions…): identity only.
 *
 * Cyclic structures are supported.
 */
export function isEqual(a: unknown, b: unknown): boolean {
  return equals(a, b, new Map());
}

type Seen = Map<object, Set<object>>;

function equals(a: unknown, b: unknown, seen: Seen): boolean {
  if (a === b) return true;
  if (a !== a && b !== b) return true; // NaN
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  // A pair already being compared is assumed equal: the comparison goes on elsewhere.
  let pairs = seen.get(a);
  if (pairs?.has(b)) return true;
  if (!pairs) {
    pairs = new Set();
    seen.set(a, pairs);
  }
  pairs.add(b);

  if (a instanceof Date) return equals(a.getTime(), (b as Date).getTime(), seen);
  if (a instanceof RegExp) return a.source === (b as RegExp).source && a.flags === (b as RegExp).flags;
  if (Array.isArray(a)) return equalArrays(a, b as unknown[], seen);
  if (ArrayBuffer.isView(a)) return equalViews(a, b as ArrayBufferView);
  if (a instanceof Map) return equalMaps(a, b as Map<unknown, unknown>, seen);
  if (a instanceof Set) return equalSets(a, b as Set<unknown>);
  if (isPlainObject(a)) return equalObjects(a, b as Record<string, unknown>, seen);
  return false;
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function equalArrays(a: unknown[], b: unknown[], seen: Seen): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!equals(a[i], b[i], seen)) return false;
  }
  return true;
}

function equalViews(a: ArrayBufferView, b: ArrayBufferView): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const bytesA = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bytesB = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < bytesA.length; i++) {
    if (bytesA[i] !== bytesB[i]) return false;
  }
  return true;
}

function equalMaps(a: Map<unknown, unknown>, b: Map<unknown, unknown>, seen: Seen): boolean {
  if (a.size !== b.size) return false;
  for (const [key, value] of a) {
    if (!b.has(key) || !equals(value, b.get(key), seen)) return false;
  }
  return true;
}

function equalSets(a: Set<unknown>, b: Set<unknown>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function equalObjects(a: Record<string, unknown>, b: Record<string, unknown>, seen: Seen): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !equals(a[key], b[key], seen)) return false;
  }
  return true;
}
