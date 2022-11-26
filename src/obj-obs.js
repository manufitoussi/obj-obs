const OBSERVED = new WeakMap();

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

/**
 * Observes an object value changing by following a path.
 * 
 * Changes are notified by using set() method to change the value on the object or by using notify() method after classical change.
 * @param {object} object Object to observe.
 * @param {string} path Path to the value to observe. ex: "a.b.c", "props.name" or "name". 
 * @param {function} onChangeCallback Callback function executed when value changed. Arguments : { object,
      key, oldValue, newValue, origin } 
 */
export function observe(object, path, onChangeCallback) {
  let child = object;
  const keys = path.split(".");
  let oPath = "";
  // let parent;
  for (const key of keys) {
    if (!child || typeof child !== "object") return null;
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
      const origin = {
        object: new WeakRef(object),
        path,
        oPath
      };
      keyEntry.set(onChangeCallback, origin);
    }

    oPath = oPath + (oPath ? "." : "") + key;
    child = child[key];
  }
}

/**
* Unobserves an observed object. 
* @param {object} object Object to unobserve.
* @param {string} path Path to the observed value. 
* @param {function} onChangeCallback Callback function executed when value changed. 
*/
export function unobserve(object, path, onChangeCallback) {
  let child = object;
  const keys = path.split(".");
  for (const key of keys) {
    if (!child || typeof child !== "object") return null;
    let objectEntry = OBSERVED.get(child);
    if (objectEntry) {
      let keyEntry = objectEntry.get(key);
      if (keyEntry) {
        keyEntry.delete(onChangeCallback);
      }
    }

    child = child[key];
  }
}

function resolve(object, key, oldValue, newValue) {
  if (!object || typeof object !== "object") return;
  let objectEntry = OBSERVED.get(object);
  if (!objectEntry) return;

  let keyEntry = objectEntry.get(key);
  if (!keyEntry) return;
  for (const [onChangeCallback, origin] of keyEntry.entries()) {
    onChangeCallback({
      object,
      key,
      oldValue,
      newValue,
      origin: origin
    });
  }

  if (oldValue && typeof oldValue === "object") {
    const oldObjectEntry = OBSERVED.get(oldValue);
    for (const [key, keyEntry] of [...oldObjectEntry.entries()]) {
      for (const [onChangeCallback, origin] of [...keyEntry.entries()]) {
        unobserve(origin.object.deref(), origin.path, onChangeCallback);
        observe(origin.object.deref(), origin.path, onChangeCallback);
        if (get(origin.object.deref(), origin.oPath) !== oldValue) {
          let rPath = origin.path.replace(origin.oPath, "");
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

/**
 * Change the value following a path of an object. 
 * @param {object} object Object to change.
 * @param {string} path Path to the value to change.
 * @param {any} value New value.
 */
export function set(object, path, value) {
  if (!path) return;
  if (!object) return;
  if (typeof object !== "object") return;
  const [lastKey, ...keys] = path.split(".").reverse();
  keys.reverse();
  let current = object;
  for (const key of keys) {
    current = current[key];
    if (!current || typeof current !== "object") return null;
  }

  const oldValue = current[lastKey];
  current[lastKey] = value;
  resolve(current, lastKey, oldValue, value);
}

/**
 * Obtains the value following a path of an object. 
 * @param {object} object Object.
 * @param {string} path Path to the value.
 * @returns {any} Value
 */
export function get(object, path) {
  if (!path) return object;
  const [lastKey, ...keys] = path.split(".").reverse();
  keys.reverse();
  let current = object;
  for (const key of keys) {
    current = current[key];
    if (!current || typeof current !== "object") return null;
  }
  const result = current[lastKey];
  if (result === undefined) return null;
  return result;
}

/**
 * Notify a value change.
 * @param {*} object Object that has changed
 * @param {*} path Path to the changed value.
 * @param {*} oldValue Old value.
 * @param {*} newValue New value.
 */
export function notify(object, path, oldValue, newValue) {
  const [lastKey, ...keys] = path.split(".").reverse();
  keys.reverse();
  resolve(get(object, keys.join(".")), lastKey, oldValue, newValue);
}

const ObjObs = {
  observe,
  unobserve,
  get,
  set,
  notify,
  _OBSERVED: OBSERVED,
};

export default ObjObs;