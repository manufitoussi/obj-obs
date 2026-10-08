type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

/**
 * Union of the dotted paths reachable in `T`, up to `D` levels deep.
 * ex: `{ a: { b: number } }` gives `"a" | "a.b"`.
 */
export type Path<T, D extends number = 6> = [D] extends [never]
  ? never
  : T extends object
    ? {
        [K in keyof T & (string | number)]: T[K] extends (...args: never[]) => unknown
          ? never
          : `${K}` | (NonNullable<T[K]> extends object ? `${K}.${Path<NonNullable<T[K]>, Prev[D]>}` : never);
      }[keyof T & (string | number)]
    : never;

/** Type of the value found at `P` in `T`. */
export type PathValue<T, P extends string> = P extends `${infer K}.${infer R}`
  ? PathValue<NonNullable<Child<T, K>>, R>
  : Child<T, P>;

type Child<T, K extends string> = K extends keyof T
  ? T[K]
  : T extends readonly (infer E)[]
    ? K extends `${number}`
      ? E
      : unknown
    : unknown;

/**
 * Accepts any known path of `T`; a non literal `string` (dynamic path) is accepted as is.
 */
export type PathOf<T, P extends string> = string extends P ? P : P extends Path<T> ? P : Path<T>;

/** Value type at `P` in `T`; `unknown` for a dynamic path. */
export type ValueOf<T, P extends string> = string extends P ? unknown : PathValue<T, P>;

/** Argument given to an observation callback. */
export interface ChangeEvent<V = unknown, R extends object = object> {
  /** Observed path, from the root. */
  path: string;
  /** Root object given to `observe()`. */
  root: R;
  /** Value at the end of the path before the change; `null` when not found. */
  oldValue: V | null;
  /** Value at the end of the path after the change; `null` when not found. */
  newValue: V | null;
  /** Where the change happened: the value at the end of the path, or an intermediate one. */
  changed: { object: object; key: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChangeCallback<V = any, R extends object = any> = (event: ChangeEvent<V, R>) => void;
