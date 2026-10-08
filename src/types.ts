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

/** Where a callback was registered from. */
export interface Origin {
  /** Root object given to `observe()`. */
  object: WeakRef<object>;
  /** Full observed path from the root. */
  path: string;
  /** Path from the root to the object holding this entry. */
  oPath: string;
}

/** Argument given to an observation callback. */
export interface ChangeEvent {
  /** Object whose key has changed. */
  object: object;
  /** Changed key. */
  key: string;
  oldValue: unknown;
  newValue: unknown;
  origin: Origin;
}

export type ChangeCallback = (event: ChangeEvent) => void;
