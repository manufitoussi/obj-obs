import { get } from './object.js';
import type { ChangeCallback, Origin } from './types.js';

type KeyEntry = Map<ChangeCallback, Origin>;
type ObjectEntry = Map<string, KeyEntry>;

const OBSERVED = new WeakMap<object, ObjectEntry>();

/*
observed
  object1:
      key1:
          - onChangeCallback1 : origin1
          - onChangeCallback2 : origin2
      key2:
          - onChangeCallback3
  object2:
      key2:
          - onChangeCallback4
*/

function isObject(value: unknown): value is object {
  return !!value && typeof value === 'object';
}

/**
 * Observes an object value changing by following a path.
 *
 * Changes are notified by using set() method to change the value on the object or by using notify() method after classical change.
 * @param object Object to observe.
 * @param path Path to the value to observe. ex: "a.b.c", "props.name" or "name".
 * @param onChangeCallback Callback function executed when value changed.
 */
export function observe(object: object, path: string, onChangeCallback: ChangeCallback): null | void {
  let child: unknown = object;
  const keys = path.split('.');
  let oPath = '';
  for (const key of keys) {
    if (!isObject(child)) return null;
    let objectEntry = OBSERVED.get(child);
    if (!objectEntry) {
      objectEntry = new Map();
      OBSERVED.set(child, objectEntry);
    }

    let keyEntry = objectEntry.get(key);
    if (!keyEntry) {
      keyEntry = new Map();
      objectEntry.set(key, keyEntry);
    }

    if (!keyEntry.has(onChangeCallback)) {
      const origin: Origin = {
        object: new WeakRef(object),
        path,
        oPath,
      };
      keyEntry.set(onChangeCallback, origin);
    }

    oPath = oPath + (oPath ? '.' : '') + key;
    child = (child as Record<string, unknown>)[key];
  }
}

/**
 * Unobserves an observed object.
 * @param object Object to unobserve.
 * @param path Path to the observed value.
 * @param onChangeCallback Callback function executed when value changed.
 */
export function unobserve(object: object, path: string, onChangeCallback: ChangeCallback): null | void {
  let child: unknown = object;
  const keys = path.split('.');
  for (const key of keys) {
    if (!isObject(child)) return null;
    const objectEntry = OBSERVED.get(child);
    if (objectEntry) {
      const keyEntry = objectEntry.get(key);
      if (keyEntry) {
        keyEntry.delete(onChangeCallback);
      }
    }

    child = (child as Record<string, unknown>)[key];
  }
}

export function _resolve(object: unknown, key: string, oldValue: unknown, newValue: unknown): void {
  if (!isObject(object)) return;
  const objectEntry = OBSERVED.get(object);
  if (!objectEntry) return;

  const keyEntry = objectEntry.get(key);
  if (!keyEntry) return;
  for (const [onChangeCallback, origin] of keyEntry.entries()) {
    onChangeCallback({
      object,
      key,
      oldValue,
      newValue,
      origin: origin,
    });
  }

  if (isObject(oldValue)) {
    const oldObjectEntry = OBSERVED.get(oldValue);
    if (!oldObjectEntry) return;
    for (const [, keyEntry] of [...oldObjectEntry.entries()]) {
      for (const [onChangeCallback, origin] of [...keyEntry.entries()]) {
        const root = origin.object.deref() as object;
        unobserve(root, origin.path, onChangeCallback);
        observe(root, origin.path, onChangeCallback);
        if (get(root, origin.oPath) !== oldValue) {
          let rPath = origin.path.replace(origin.oPath, '');
          if (rPath) {
            rPath = rPath.substring(1);
          }

          unobserve(oldValue, rPath, onChangeCallback);
          keyEntry.delete(onChangeCallback);
        }
      }
    }
  }
}

const ObjObs = {
  observe,
  unobserve,
  _resolve,
  _OBSERVED: OBSERVED,
};

export default ObjObs;
