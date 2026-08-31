/**
 * Hand-authored companion declaration for `TypesonPromise.js`, kept in sync
 *   with what `tsc` emits for that file (see `dist/utils/TypesonPromise.d.ts`
 *   after a build).
 *
 * The runtime deliberately keeps `class TypesonPromise` as a bare,
 *   constructor-only class and attaches `then`/`catch`/the static helpers
 *   through `prototype`/property assignments so that its
 *   `Function.prototype.toString` output stays tiny and minifies identically
 *   across bundles (which `hasConstructorOf` relies on). The native (Go)
 *   TypeScript port does not fold those later assignments back into the class
 *   type the way `tsc` 6 does, so `TypesonPromise.js` is excluded from
 *   `tsconfig.json` and this file describes the shape instead. The published
 *   declarations are still generated from the `.js` by `tsconfig-build.json`.
 * @template T
 */
export class TypesonPromise<T> {
    constructor(
        f: (
            resolve: (value: any) => any,
            reject: (reason?: any) => void
        ) => void
    );
    p: Promise<any>;
    then(
        onFulfilled?: ((value: T) => any) | null,
        onRejected?: (reason?: any) => any
    ): TypesonPromise<T>;
    catch(onRejected: (reason?: any) => void): TypesonPromise<T>;
}
export namespace TypesonPromise {
    let __typeson__type__: string;
    function resolve<T_1>(v: T_1): TypesonPromise<T_1>;
    function reject<T_1>(v: any): TypesonPromise<T_1>;
    function all<T_1>(
        promArr: (TypesonPromise<T_1> | Promise<T_1> | any)[]
    ): TypesonPromise<T_1>;
    function race<T_1>(
        promArr: (TypesonPromise<T_1> | Promise<T_1> | null)[]
    ): TypesonPromise<T_1>;
    function allSettled<T_1>(
        promArr: (TypesonPromise<T_1> | Promise<T_1> | null)[]
    ): TypesonPromise<T_1>;
}
