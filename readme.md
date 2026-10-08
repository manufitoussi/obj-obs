ObjObs
======

> A simple way to observe JS object value changing by following its path.

```ts
import { observe, unobserve, get, set } from 'obj-obs';

const actor = { properties: { color: 'red' } };

const onColorChange = ({ path, oldValue, newValue }) => console.log(path, oldValue, newValue);
observe(actor, 'properties.color', onColorChange);

set(actor, 'properties.color', 'blue');       // properties.color red blue
set(actor, 'properties', { color: 'green' }); // properties.color blue green
get(actor, 'properties.color');               // 'green'

unobserve(actor, 'properties.color', onColorChange);
```

The callback receives:

| Field | |
|---|---|
| `path` | Observed path. |
| `root` | Object given to `observe()`. |
| `oldValue`, `newValue` | Values at the end of the path, `null` when not found. |
| `changed` | `{ object, key }` where the change happened: the end of the path or an intermediate value. |

Replacing an intermediate value notifies the observers whose value at the end of the path differs.

Changes are only notified through `set()`, or through `notify()` after a direct assignment.
`set()` does not notify when the new value is the same as the old one (`Object.is`).
Observers are notified in the order of the `observe()` calls.

Properties mapped to accessors that call `notify()` in their setter are notified once, whether they are changed with `set()` or by a direct assignment.

`observe()` returns a function that stops the observation, like `unobserve()`.

## Comparing values

`isEqual(a, b)` compares values structurally: dates, regular expressions, arrays, typed arrays, plain objects, maps and sets, cyclic structures included. Other objects, like class instances, are compared by identity.

```ts
isEqual({ a: [1, new Date(0)] }, { a: [1, new Date(0)] }); // true
```

## TypeScript

Paths are typed: `get()` and `set()` autocomplete known paths, check the value type and fall back to `unknown` for a dynamic `string` path.

## Development

```sh
yarn install
yarn typecheck
yarn test
yarn build
```

`yarn build` compiles `src/` to ES modules and type declarations in `dist/`.

## Demo

`yarn demo` serves an interactive test page at http://localhost:5173: edit the observed object, add observers and bindings, follow the notifications in a log, compare values with `isEqual` and measure performance. It imports `src/` directly and reloads on change.
