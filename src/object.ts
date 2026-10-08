import { _resolve } from './observe.js';
import type { PathOf, ValueOf } from './types.js';

/** Assignments in progress in `set()`, to detect accessors that notify by themselves. */
const assignments: { object: object; key: string; notified: boolean }[] = [];

function splitLast(path: string): [string[], string] {
  const keys = path.split('.');
  const lastKey = keys.pop() as string;
  return [keys, lastKey];
}

/**
 * Change the value following a path of an object.
 * Observers are not notified when the value is the same (`Object.is`),
 * nor a second time when the property is an accessor calling `notify()` by itself.
 * @param object Object to change.
 * @param path Path to the value to change.
 * @param value New value.
 */
export function set<T, P extends string>(object: T, path: P & PathOf<T, P>, value: ValueOf<T, P>): null | void {
  if (!path) return;
  if (!object) return;
  if (typeof object !== 'object') return;
  const [keys, lastKey] = splitLast(path);
  let current = object as Record<string, unknown>;
  for (const key of keys) {
    current = current[key] as Record<string, unknown>;
    if (!current || typeof current !== 'object') return null;
  }

  const oldValue = current[lastKey];
  const assignment = { object: current, key: lastKey, notified: false };
  assignments.push(assignment);
  try {
    current[lastKey] = value;
  } finally {
    assignments.pop();
  }

  // An accessor that notifies by itself has already done the job.
  if (assignment.notified || Object.is(oldValue, value)) return;
  _resolve(current, lastKey, oldValue, value);
}

/**
 * Obtains the value following a path of an object.
 * @param object Object.
 * @param path Path to the value.
 * @returns Value, `null` when not found.
 */
export function get<T, P extends string>(object: T, path: P & PathOf<T, P>): ValueOf<T, P> | null;
export function get<T>(object: T, path?: '' | null): T;
export function get(object: unknown, path?: string | null): unknown {
  if (!path) return object;
  if (!object || typeof object !== 'object') return null;
  const [keys, lastKey] = splitLast(path);
  let current = object as Record<string, unknown>;
  for (const key of keys) {
    current = current[key] as Record<string, unknown>;
    if (!current || typeof current !== 'object') return null;
  }
  const result = current[lastKey];
  if (result === undefined) return null;
  return result;
}

/**
 * Notify a value change.
 * @param object Object that has changed
 * @param path Path to the changed value.
 * @param oldValue Old value.
 * @param newValue New value.
 */
export function notify(object: object, path: string, oldValue: unknown, newValue: unknown): void {
  const [keys, lastKey] = splitLast(path);
  const target = get(object, keys.join('.') as string);
  for (let i = assignments.length - 1; i >= 0; i--) {
    if (assignments[i].object === target && assignments[i].key === lastKey) {
      assignments[i].notified = true;
      break;
    }
  }

  _resolve(target, lastKey, oldValue, newValue);
}

export default {
  get,
  set,
  notify,
};
