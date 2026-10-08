import type { ChangeCallback } from './types.js';

/** One `observe()` call: a callback on a path from a root object. */
interface Subscription {
  /** Creation order: subscriptions are notified in this order. */
  id: number;
  root: WeakRef<object>;
  path: string;
  keys: string[];
  callback: ChangeCallback;
  /** Objects of the chain the subscription is currently attached to, by depth. */
  nodes: WeakRef<object>[];
}

/**
 * Subscriptions attached to each object of an observed chain, by key.
 *
 * observed
 *   object1:
 *       key1: { subscription1, subscription2 }
 *       key2: { subscription3 }
 *   object2:
 *       key2: { subscription4 }
 */
const OBSERVED = new WeakMap<object, Map<string, Set<Subscription>>>();

/** Subscriptions by root object, path and callback, to find them back in `unobserve()`. */
const ROOTS = new WeakMap<object, Map<string, Map<ChangeCallback, Subscription>>>();

let lastId = 0;

function isObject(value: unknown): value is object {
  return !!value && typeof value === 'object';
}

function attach(subscription: Subscription): void {
  let child: unknown = subscription.root.deref();
  subscription.nodes = [];
  for (const key of subscription.keys) {
    if (!isObject(child)) return;
    let objectEntry = OBSERVED.get(child);
    if (!objectEntry) {
      objectEntry = new Map();
      OBSERVED.set(child, objectEntry);
    }

    let keyEntry = objectEntry.get(key);
    if (!keyEntry) {
      keyEntry = new Set();
      objectEntry.set(key, keyEntry);
    }

    keyEntry.add(subscription);
    subscription.nodes.push(new WeakRef(child));
    child = (child as Record<string, unknown>)[key];
  }
}

function detach(subscription: Subscription): void {
  subscription.nodes.forEach((ref, depth) => {
    const node = ref.deref();
    if (!node) return;
    const objectEntry = OBSERVED.get(node);
    const key = subscription.keys[depth];
    const keyEntry = objectEntry?.get(key);
    if (!objectEntry || !keyEntry) return;
    keyEntry.delete(subscription);
    if (keyEntry.size) return;
    objectEntry.delete(key);
    if (!objectEntry.size) OBSERVED.delete(node);
  });
  subscription.nodes = [];
}

function dispose(subscription: Subscription): void {
  detach(subscription);
  const root = subscription.root.deref();
  if (!root) return;
  const paths = ROOTS.get(root);
  const callbacks = paths?.get(subscription.path);
  if (!paths || callbacks?.get(subscription.callback) !== subscription) return;
  callbacks.delete(subscription.callback);
  if (callbacks.size) return;
  paths.delete(subscription.path);
  if (!paths.size) ROOTS.delete(root);
}

/**
 * Observes an object value changing by following a path.
 *
 * Changes are notified by using set() method to change the value on the object or by using notify() method after classical change.
 * Observing twice the same path of the same object with the same callback has no effect.
 * @param object Object to observe.
 * @param path Path to the value to observe. ex: "a.b.c", "props.name" or "name".
 * @param onChangeCallback Callback function executed when value changed.
 * @returns A function that stops the observation, like `unobserve()`.
 */
export function observe(object: object, path: string, onChangeCallback: ChangeCallback): () => void {
  let paths = ROOTS.get(object);
  if (!paths) {
    paths = new Map();
    ROOTS.set(object, paths);
  }

  let callbacks = paths.get(path);
  if (!callbacks) {
    callbacks = new Map();
    paths.set(path, callbacks);
  }

  let subscription = callbacks.get(onChangeCallback);
  if (!subscription) {
    subscription = {
      id: ++lastId,
      root: new WeakRef(object),
      path,
      keys: path.split('.'),
      callback: onChangeCallback,
      nodes: [],
    };
    callbacks.set(onChangeCallback, subscription);
    attach(subscription);
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
  const subscription = ROOTS.get(object)?.get(path)?.get(onChangeCallback);
  if (subscription) dispose(subscription);
}

/**
 * Notifies the subscriptions attached to `object[key]`.
 *
 * Subscriptions for which `key` is an intermediate key are first attached again from their root, to follow the new value.
 * Callbacks are called in the order of the `observe()` calls.
 * Every callback is called, even if one throws; errors are thrown afterwards.
 */
export function _resolve(object: unknown, key: string, oldValue: unknown, newValue: unknown): void {
  if (!isObject(object)) return;
  const keyEntry = OBSERVED.get(object)?.get(key);
  if (!keyEntry) return;

  const errors: unknown[] = [];
  // Attaching again moves a subscription to the end of the sets: sort to keep the creation order.
  const subscriptions = [...keyEntry].sort((a, b) => a.id - b.id);
  for (const subscription of subscriptions) {
    // Disposed by a previous callback.
    if (!keyEntry.has(subscription)) continue;
    const root = subscription.root.deref();
    if (!root) {
      dispose(subscription);
      continue;
    }

    const depth = subscription.nodes.findIndex((ref, i) => ref.deref() === object && subscription.keys[i] === key);
    if (depth < subscription.keys.length - 1) {
      detach(subscription);
      attach(subscription);
    }

    try {
      subscription.callback({
        object,
        key,
        oldValue,
        newValue,
        origin: {
          object: subscription.root,
          path: subscription.path,
          oPath: subscription.keys.slice(0, Math.max(depth, 0)).join('.'),
        },
      });
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, `${errors.length} observers failed on "${key}".`);
}

const ObjObs = {
  observe,
  unobserve,
  _resolve,
  _OBSERVED: OBSERVED,
};

export default ObjObs;
