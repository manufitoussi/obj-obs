
export default class ObjObs {
  _observed = new WeakMap();

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
   * Observes an object value changing by adressing by its path.
   * @param {object} object Object to observe.
   * @param {string} path Path of the value to observe. ex: "a.b.c", "props.name" or "name". 
   * @param {function} onChangeCallback Callback function executed when value changed. Args : { object,
        key, oldValue, newValue, origin } 
   */
  observe(object, path, onChangeCallback) {
    let child = object;
    const keys = path.split(".");
    let oPath = "";
    // let parent;
    for (const key of keys) {
      if (!child || typeof child !== "object") return null;
      let objectEntry = this._observed.get(child);
      if (!objectEntry) {
        objectEntry = new Map();
        this._observed.set(child, objectEntry);
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
        // parent = origin;
        keyEntry.set(onChangeCallback, origin);
      }

      oPath = oPath + (oPath ? "." : "") + key;
      child = child[key];
    }
  }

  unobserve(object, path, onChangeCallback) {
    let child = object;
    const keys = path.split(".");
    for (const key of keys) {
      if (!child || typeof child !== "object") return null;
      let objectEntry = this._observed.get(child);
      if (objectEntry) {
        let keyEntry = objectEntry.get(key);
        if (keyEntry) {
          keyEntry.delete(onChangeCallback);
        }
      }

      child = child[key];
    }
  }

  resolve(object, key, oldValue, newValue) {
    if (!object || typeof object !== "object") return;
    let objectEntry = this._observed.get(object);
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
      const oldObjectEntry = this._observed.get(oldValue);
      for (const [key, keyEntry] of [...oldObjectEntry.entries()]) {
        for (const [onChangeCallback, origin] of [...keyEntry.entries()]) {
          this.unobserve(origin.object.deref(), origin.path, onChangeCallback);
          this.observe(origin.object.deref(), origin.path, onChangeCallback);
          if (this.get(origin.object.deref(), origin.oPath) !== oldValue) {
            let rPath = origin.path.replace(origin.oPath, "");
            if (rPath) {
              rPath = rPath.substring(1);
            }

            this.unobserve(oldValue, rPath, onChangeCallback);
            keyEntry.delete(onChangeCallback);
          }
        }
      }
    }
  }

  set(object, path, value) {
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
    this.resolve(current, lastKey, oldValue, value);
  }

  get(object, path) {
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

  notify(object, path, oldValue, newValue) {
    const [lastKey, ...keys] = path.split(".").reverse();
    keys.reverse();
    this.resolve(this.get(object, keys.join(".")), lastKey, oldValue, newValue);
  }
}


