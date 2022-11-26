import { _resolve } from "./observe.js";
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
  _resolve(current, lastKey, oldValue, value);
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
  _resolve(get(object, keys.join(".")), lastKey, oldValue, newValue);
}

export default {
  get,
  set,
  notify,
};
