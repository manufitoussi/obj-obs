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
