ObjObs
======

> A simple way to observe JS object value changing by following its path.

```ts
import { observe, unobserve, get, set } from 'obj-obs';

const actor = { properties: { color: 'red' } };

const onColorChange = ({ key, oldValue, newValue }) => console.log(key, oldValue, newValue);
observe(actor, 'properties.color', onColorChange);

set(actor, 'properties.color', 'blue'); // color red blue
get(actor, 'properties.color');         // 'blue'

unobserve(actor, 'properties.color', onColorChange);
```

Changes are only notified through `set()`, or through `notify()` after a direct assignment.
`set()` does not notify when the new value is the same as the old one (`Object.is`).

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

Samples load `dist/` as ES modules, so they must be served over HTTP, e.g. `npx vite` at the repository root, then open `/samples/sample1.html`.
