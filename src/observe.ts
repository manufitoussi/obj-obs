import type { ChangeCallback, PathOf, ValueOf } from './types.js';

/** One `observe()` call: a callback on a path from a root object. */
interface Subscription {
  /** Creation order: subscriptions are notified in this order. */
  id: number;
  root: WeakRef<object>;
  path: string;
  keys: readonly string[];
  callback: ChangeCallback;
  /** False once disposed. */
  active: boolean;
}

/**
 * Subscriptions attached to an object, as flat `[subscription, depth, …]` pairs sorted by subscription id.
 * The observed key of a pair is `subscription.keys[depth]`.
 */
type Attachments = (Subscription | number)[];

/**
 * Subscriptions attached to each object of an observed chain.
 *
 * A single list holds every key of an object; it is split by key once it holds many subscriptions.
 *
 * observed
 *   object1: [subscription1, 0, subscription2, 1]
 *   object2: { key1: [subscription3, 2], key2: [subscription1, 1, subscription4, 1] }
 */
const OBSERVED = new WeakMap<object, Attachments | Map<string, Attachments>>();

/** Pairs in a single list before splitting it by key. */
const SPLIT_SIZE = 32;

/** Subscriptions by root object, to find them back in `unobserve()`. */
const ROOTS = new WeakMap<object, Subscription | Subscription[]>();

/** Split paths, shared by the subscriptions of a same path. */
const KEYS = new Map<string, readonly string[]>();

let lastId = 0;

function isObject(value: unknown): value is object {
  return !!value && typeof value === 'object';
}

function splitPath(path: string): readonly string[] {
  let keys = KEYS.get(path);
  if (!keys) {
    keys = Object.freeze(path.split('.'));
    KEYS.set(path, keys);
  }

  return keys;
}

/** Inserts a pair, keeping the list sorted by subscription id. */
function insertPair(list: Attachments, subscription: Subscription, depth: number): void {
  let index = list.length;
  while (index > 0 && (list[index - 2] as Subscription).id > subscription.id) index -= 2;
  list.splice(index, 0, subscription, depth);
}

function removePair(list: Attachments, subscription: Subscription, depth: number): boolean {
  for (let i = 0; i < list.length; i += 2) {
    if (list[i] === subscription && list[i + 1] === depth) {
      list.splice(i, 2);
      return true;
    }
  }

  return false;
}

function splitByKey(list: Attachments): Map<string, Attachments> {
  const byKey = new Map<string, Attachments>();
  for (let i = 0; i < list.length; i += 2) {
    const subscription = list[i] as Subscription;
    const key = subscription.keys[list[i + 1] as number];
    let keyList = byKey.get(key);
    if (!keyList) {
      keyList = [];
      byKey.set(key, keyList);
    }

    keyList.push(subscription, list[i + 1]);
  }

  return byKey;
}

function add(node: object, subscription: Subscription, depth: number): void {
  const entry = OBSERVED.get(node);
  if (!entry) {
    OBSERVED.set(node, [subscription, depth]);
    return;
  }

  if (Array.isArray(entry)) {
    insertPair(entry, subscription, depth);
    if (entry.length > SPLIT_SIZE * 2) OBSERVED.set(node, splitByKey(entry));
    return;
  }

  const key = subscription.keys[depth];
  const list = entry.get(key);
  if (list) insertPair(list, subscription, depth);
  else entry.set(key, [subscription, depth]);
}

function remove(node: object, subscription: Subscription, depth: number): void {
  const entry = OBSERVED.get(node);
  if (!entry) return;
  if (Array.isArray(entry)) {
    if (removePair(entry, subscription, depth) && !entry.length) OBSERVED.delete(node);
    return;
  }

  const key = subscription.keys[depth];
  const list = entry.get(key);
  if (!list || !removePair(list, subscription, depth) || list.length) return;
  entry.delete(key);
  if (!entry.size) OBSERVED.delete(node);
}

/** Pairs observing `node[key]`, in subscription order. */
function attachedTo(node: object, key: string): Attachments {
  const entry = OBSERVED.get(node);
  if (!entry) return [];
  if (!Array.isArray(entry)) return entry.get(key)?.slice() ?? [];
  const pairs: Attachments = [];
  for (let i = 0; i < entry.length; i += 2) {
    if ((entry[i] as Subscription).keys[entry[i + 1] as number] === key) pairs.push(entry[i], entry[i + 1]);
  }

  return pairs;
}

/** Calls `visit` on each object of the chain of `subscription`, from `from` at `depth`. */
function walk(subscription: Subscription, from: unknown, depth: number, visit: typeof add): void {
  let child = from;
  for (let i = depth; i < subscription.keys.length; i++) {
    if (!isObject(child)) return;
    visit(child, subscription, i);
    child = (child as Record<string, unknown>)[subscription.keys[i]];
  }
}

/** Value at the end of the path of `subscription`, from `from` at `depth`; `null` when not found. */
function valueAt(subscription: Subscription, from: unknown, depth: number): unknown {
  let child = from;
  for (let i = depth; i < subscription.keys.length; i++) {
    if (!isObject(child)) return null;
    child = (child as Record<string, unknown>)[subscription.keys[i]];
  }

  return child === undefined ? null : child;
}

/** Is `node` the object of the chain of `subscription` at `depth`? */
function isAttachedAt(subscription: Subscription, root: object, node: object, depth: number): boolean {
  let child: unknown = root;
  for (let i = 0; i < depth; i++) {
    if (!isObject(child)) return false;
    child = (child as Record<string, unknown>)[subscription.keys[i]];
  }

  return child === node;
}

function findSubscription(root: object, path: string, callback: ChangeCallback): Subscription | undefined {
  const entry = ROOTS.get(root);
  if (!entry) return undefined;
  if (!Array.isArray(entry)) return entry.path === path && entry.callback === callback ? entry : undefined;
  return entry.find((subscription) => subscription.path === path && subscription.callback === callback);
}

function dispose(subscription: Subscription): void {
  if (!subscription.active) return;
  subscription.active = false;
  const root = subscription.root.deref();
  // Without its root, the pairs left are removed when they are met, or with their objects.
  if (!root) return;
  walk(subscription, root, 0, remove);
  const entry = ROOTS.get(root);
  if (entry === subscription) {
    ROOTS.delete(root);
  } else if (Array.isArray(entry)) {
    entry.splice(entry.indexOf(subscription), 1);
    if (entry.length === 1) ROOTS.set(root, entry[0]);
  }
}

/**
 * Observes the value at the end of a path of an object.
 *
 * Changes are notified by using set() method to change the value on the object or by using notify() method after classical change.
 * A change of an intermediate value of the path is notified when the value at the end of the path differs.
 * Observing twice the same path of the same object with the same callback has no effect.
 * @param object Object to observe.
 * @param path Path to the value to observe. ex: "a.b.c", "props.name" or "name".
 * @param onChangeCallback Callback function executed when value changed.
 * @returns A function that stops the observation, like `unobserve()`.
 */
export function observe<T extends object, P extends string>(
  object: T,
  path: P & PathOf<T, P>,
  onChangeCallback: ChangeCallback<ValueOf<T, P>, T>,
): () => void {
  let subscription = findSubscription(object, path, onChangeCallback);
  if (!subscription) {
    subscription = {
      id: ++lastId,
      root: new WeakRef(object),
      path,
      keys: splitPath(path),
      callback: onChangeCallback,
      active: true,
    };

    const entry = ROOTS.get(object);
    if (!entry) ROOTS.set(object, subscription);
    else if (Array.isArray(entry)) entry.push(subscription);
    else ROOTS.set(object, [entry, subscription]);
    walk(subscription, object, 0, add);
  }

  const observed = subscription;
  return () => dispose(observed);
}

/**
 * Unobserves an observed object.
 * @param object Object to unobserve.
 * @param path Path to the observed value.
 * @param onChangeCallback Callback function given to `observe()`.
 */
export function unobserve(object: object, path: string, onChangeCallback: ChangeCallback): void {
  const subscription = findSubscription(object, path, onChangeCallback);
  if (subscription) dispose(subscription);
}

/**
 * Notifies the subscriptions attached to `object[key]`, with the values at the end of their path.
 *
 * Subscriptions for which `key` is an intermediate key are first moved from the chain under `oldValue` to the chain under `newValue`.
 * They are not notified when `oldValue` is replaced by another value holding the same value at the end of their path.
 * Callbacks are called in the order of the `observe()` calls.
 * Every callback is called, even if one throws; errors are thrown afterwards.
 */
export function _resolve(object: unknown, key: string, oldValue: unknown, newValue: unknown): void {
  if (!isObject(object)) return;
  const pairs = attachedTo(object, key);
  if (!pairs.length) return;

  const errors: unknown[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const subscription = pairs[i] as Subscription;
    const depth = pairs[i + 1] as number;
    // Disposed by a previous callback.
    if (!subscription.active) continue;
    const root = subscription.root.deref();
    // Left behind: root collected, or chain changed without notification.
    if (!root || !isAttachedAt(subscription, root, object, depth)) {
      remove(object, subscription, depth);
      continue;
    }

    let oldLeaf = oldValue;
    let newLeaf = newValue;
    if (depth < subscription.keys.length - 1) {
      walk(subscription, oldValue, depth + 1, remove);
      walk(subscription, newValue, depth + 1, add);
      oldLeaf = valueAt(subscription, oldValue, depth + 1);
      newLeaf = valueAt(subscription, newValue, depth + 1);
      // A replaced intermediate value with the same value at the end of the path is not a change for this path.
      if (oldValue !== newValue && Object.is(oldLeaf, newLeaf)) continue;
    }

    try {
      subscription.callback({
        path: subscription.path,
        root,
        oldValue: oldLeaf === undefined ? null : oldLeaf,
        newValue: newLeaf === undefined ? null : newLeaf,
        changed: { object, key },
      });
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, `${errors.length} observers failed on "${key}".`);
}

/** Number of subscriptions attached to `object`, or to `object[key]`. For tests and debugging. */
export function _countAttachments(object: object, key?: string): number {
  const entry = OBSERVED.get(object);
  if (!entry) return 0;
  if (key !== undefined) return attachedTo(object, key).length / 2;
  if (Array.isArray(entry)) return entry.length / 2;
  let count = 0;
  for (const list of entry.values()) count += list.length / 2;
  return count;
}

const ObjObs = {
  observe,
  unobserve,
  _resolve,
  _countAttachments,
};

export default ObjObs;
