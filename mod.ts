/**
 *  
 * Better Iterators
 * ================
 * 
 * This module provides {@link Lazy} and {@link LazyAsync} classes which make it easy
 * to chain together data transformations.
 * 
 * The {@link lazy} function is the simplest way to get started.
 * 
 * ```ts
 * import { lazy, range } from "./mod.ts"
 * 
 * // You can use any Iterable here (such as an Array, or Generator), but
 * // Lazy objects are themselves Iterable:
 * let iterable = range({to: 1000})
 * 
 * let results = lazy(iterable)
 *     .filter(it => it % 2 == 0)
 *     .map(it => it*it)
 *     .limit(10)
 * 
 * // No iteration has happened yet.
 * // This will trigger it:
 * for (let item of results) { console.log(item) }
 * ```
 * 
 * Lazy Iteration Consumes All Input
 * ---------------------------------
 * 
 * Note that iterating a Lazy(Async) will consume its items -- the operation is
 * not repeatable. If you need to iterate multiple times, save your result to
 * an array with {@link Lazy#toArray}
 * 
 * ```ts
 * import { lazy, range } from "./mod.ts"
 *
 * let results = lazy([1, 2, 3, 4, 5]).map(it => `number: ${it}`)
 * 
 * for (let result of results) { console.log("first pass:", result)}
 * 
 * // Has no more values to yield, will throw an exception:
 * for (let result of results) { console.log("second pass:", result)}
 * ```
 * 
 * Asynchronous Iteration With Promises (Not Recommended)
 * ------------------------------------------------------
 * 
 * You *could* use a Lazy directly for async work, but it has some problems:
 * 
 * ```ts
 * import { lazy, range } from "./mod.ts"
 * let urls = [
 *     "https://www.example.com/foo",
 *     "https://www.example.com/bar"
 * ]
 * let lazySizes = lazy(urls)
 *     .map(async (url) => {
 *         let response = await fetch(url)
 *         return await response.text()
 *     })
 *     // The type is now Lazy<Promise<string>> so we're stuck having to deal
 *     // with  promises for the rest of the lazy chain:
 *     .map(async (bodyPromise) => (await bodyPromise).length)
 *     // and so on...
 * 
 * // `lazySizes` also ends up as a `Lazy<Promise<number>>`, so we've got to 
 * // await all of the items ourselves:
 * let sizes = await Promise.all(lazySizes.toArray())
 * ```
 * 
 * This approach might seem to work, but it has unbounded parallelism. If you
 * have N URLs, `.toArray()` will create N promises, and the JavaScript runtime
 * will start making progress on all of them simultaneously.
 * 
 * 
 * Lazy Asynchronous Iteration
 * ---------------------------
 *  
 * For a simpler, safer API when working with async code, you can convert a
 * `Lazy` to a `LazyAsync`:
 * 
 * ```ts
 * import { lazy, range } from "./mod.ts"
 * let urls = [
 *     "https://www.example.com/foo",
 *     "https://www.example.com/bar"
 * ]
 * let lazySizes = lazy(urls)
 *     .toAsync()
 *     .map(async (url) => {
 *         let response = await fetch(url)
 *         return await response.text()
 *     })
 *     // here the type is LazyAsync<string> (not Lazy<Promise<string>>)
 *     // so further lazy functions are easier to work with:
 *     .map(it => it.length)
 * ```
 * 
 * Here, {@link LazyAsync#map} does the least surprising thing and does not 
 * introduce parallelism implicitly. You've still got serial lazy iteration.
 * 
 * If you DO want parallelism, the {@link LazyAsync#mapPar} and
 * {@link LazyAsync#mapParUnordered} methods let you explicitly opt in at your
 * chosen level of parallelism.
 * 
 * @module
 */

import { stateful, StatefulPromise } from "./_src/promise.ts";
import { Queue } from "./_src/queue.ts";

/**
 * Create a Lazy(Async) from your (Async)Iterator. 
 */
export function lazy<T>(iter: Iterable<T>): Lazy<T>
export function lazy<T>(iter: AsyncIterable<T>): LazyAsync<T>
export function lazy<T>(iter: Iterable<T>|AsyncIterable<T>): Lazy<T>|LazyAsync<T> {
    if (Symbol.asyncIterator in iter) {
        return LazyAsync.from(iter)
    }

    return Lazy.from(iter)
}

// Note: There seems to be a bug in `deno doc` so I'm going to copy/paste the
// method docs onto the implementors. 😢
// https://github.com/denoland/deno_doc/issues/136
/**
 * Shared interface for {@link Lazy} and {@link LazyAsync}. 
 * (Note: `LazyAsync` implements some methods that are not shared.)
 * 
 * You shouldn't need to interact with these classes or this interface
 * directly, though. You can convert to the appropriate one with {@link lazy}.
 * 
 * Operations on lazy iterators consume the underlying iterator. You should not
 * use them again.
 */
interface LazyShared<T> {

    /**
     * Apply `transform` to each element.
     * 
     * Works like {@link Array#map}.
     */
    map<Out>(transform: Transform<T, Out>): LazyShared<Out>

    /** Keeps only items for which `f` is `true`. */
    filter(f: Filter<T>): LazyShared<T>


    /** Limit the iterator to returning at most `count` items. */
    limit(count: number): LazyShared<T>

    /** Collect all items into an array. */
    toArray(): Awaitable<Array<T>>

    /** Injects a function to run on each T as it is being iterated. */
    also(fn: (t: T) => void): LazyShared<T>

    /** Partition items into `matches` and `others` according to Filter `f`. */
    partition(f: Filter<T>): Awaitable<Partitioned<T>>

    /** Get the first item. @throws if there are no items. */
    first(): Awaitable<T>

    /** Get the first item. Returns `defaultValue` if there is no first item. */
    firstOr<D>(defaultValue: D): Awaitable<T|D>

    /** Skip (up to) the first `count` elements */
    skip(count: number): LazyShared<T>

    /**
     * Given `keyFn`, use it to extract a key from each item, and create a Map
     * grouping items by that key.
     */
    groupBy<Key>(keyFn: Transform<T, Key>): Awaitable<Map<Key, T[]>>

    /**
     * Given `uniqueKeyFn`, use it to extract a key from each item, and create a
     * 1:1 map from that to each item.
     * 
     * @throws if duplicates are found for a given key.
     */
    associateBy<Key>(
        uniqueKeyFn: Transform<T, Key>,
    ): Awaitable<Map<Key, T>>

    /**
     * Takes an additional `valueFn` to extract a value from `T`. The returned
     * map maps from Key to Value. (instead of Key to T)
     */
    associateBy<Key, Value>(
        uniqueKeyFn: Transform<T, Key>,
        valueFn: Transform<T, Value>
    ): Awaitable<Map<Key, Value>>
    

    /** Flattens a Lazy<Iterable<T>> to a Lazy<T> */
    flatten(): LazyShared<Flattened<T>>

    /** Fold values. See example in {@link LazyShared#sum */
    fold<I>(initialValue: I, foldFn: (i: I, t: T) => I): Awaitable<I>

    /**
     * Sums a Lazy iterator of `number`s.
     * 
     * This is equivalent to:
     * ```ts
     * import { lazy, range } from "./mod.ts"
     * 
     * range({to: 10}).fold(0, (a, b) => a + b)
     * ```
     * 
     */
    sum(): Awaitable<T extends number ? number : never>
    // Note: Technically, the sum() implementation will convert non-numbers to
    // a string and then do string concatenation. But it's probably not desired,
    // and would be more efficient with join(), so we return a `never` type here.

    /**
     * Averages numbers from the Lazy iterable.
     * 
     * Will return NaN if no numbers exist.
     * 
     * Note: This algorithm does a simple left-to-right accumulation of the sum,
     * so can suffer from loss of precision when summing things with vastly
     * different scales, or working with sums over Number.MAX_SAFE_INTEGER.
     */
    avg(): Awaitable<T extends number ? number : never>

}

export class Lazy<T> implements Iterable<T>, LazyShared<T> {

    /** Prefer to use the {@link lazy} function. */
    static from<T>(iter: Iterable<T>): Lazy<T> {
        return new Lazy(iter)
    }

    private constructor(iter: Iterable<T>) {
        this.#innerStore = iter
    }

    #innerStore?: Iterable<T>

    get #inner(): Iterable<T> {
        let inner = this.#innerStore
        this.#innerStore = undefined

        if (inner === undefined) {
            throw new Error(`Logic Error: Iteration for this Lazy has already been consumed`)
        }
        return inner
    }

    [Symbol.iterator](): Iterator<T> {
        return this.#inner[Symbol.iterator]()
    }

    /**
     * Apply `transform` to each element.
     * 
     * Works like {@link Array#map}.
     */
    map<Out>(transform: Transform<T, Out>): Lazy<Out> {
        let inner = this.#inner
        let transformIter = function*() {
            for (let item of inner) {
                yield transform(item)
            }
        }
        return Lazy.from(transformIter())
    }

    /** Keeps only items for which `f` is `true`. */
    filter(f: Filter<T>): Lazy<T> {
        let inner = this.#inner
        let matchIter = function*() {
            for (let item of inner) {
                if (!f(item)) { continue }
                yield item
            }
        }
        return Lazy.from(matchIter())
    }

    /** Limit the iterator to returning at most `count` items. */
    limit(count: number): Lazy<T> {
        let inner = this.#inner
        let countIter = function*() {
            if (count <= 0) { return } 
            for (let item of inner) {
                yield item
                if (--count <= 0) { break }
            }
        }
        return Lazy.from(countIter())
    }

    /** Injects a function to run on each T as it is being iterated. */
    also(fn: (t: T) => void): Lazy<T> {
        let inner = this.#inner
        let gen = function*() {
            for (let item of inner) {
                fn(item)
                yield item
            }
        }
        return Lazy.from(gen())
    }

    /** Partition items into `matches` and `others` according to Filter `f`. */
    partition(f: Filter<T>): Partitioned<T> {
        let matches: T[] = []
        let others: T[] = []

        for (const item of this) {
            if (f(item)) { matches.push(item) }
            else { others.push(item) }
        }

        return {matches, others}
    }

    /** Get the first item. @throws if there are no items. */
    first(): T {
        for (let item of this) {
            return item
        }
        throw new Error(`No items.`)
    }

    /** Get the first item. Returns `defaultValue` if there is no first item. */
    firstOr<D>(defaultValue: D): T | D {
        for (let item of this) {
            return item
        }
        return defaultValue
    }

    /** Skip (up to) the first `count` elements */
    skip(count: number): Lazy<T> {
        let inner = this.#inner
        let gen = function * () {
            let iter = inner[Symbol.iterator]()
            while (count-- > 0) {
                let next = iter.next()
                if (next.done) { return }
            }

            while (true) {
                let next = iter.next()
                if (next.done) { return }
                yield next.value
            }
        }

        return Lazy.from(gen())
    }

    /**
     * Given `keyFn`, use it to extract a key from each item, and create a Map
     * grouping items by that key.
     */
    groupBy<Key>(keyFn: Transform<T, Key>): Map<Key, T[]> {
        let map = new Map<Key, T[]>()
        for (const item of this) {
            const key = keyFn(item)
            let group = map.get(key)
            if (!group) {
                group = []
                map.set(key, group)
            }
            group.push(item)
        }
        return map
    }
    /**
     * Given `uniqueKeyFn`, use it to extract a key from each item, and create a
     * 1:1 map from that to each item.
     * 
     * @throws if duplicates are found for a given key.
     */
    associateBy<Key>(uniqueKeyFn: Transform<T, Key>, ): Map<Key, T>;
    /**
     * Takes an additional `valueFn` to extract a value from `T`. The returned
     * map maps from Key to Value. (instead of Key to T)
     */
    associateBy<Key, Value>( uniqueKeyFn: Transform<T, Key>, valueFn: Transform<T, Value> ): Map<Key, Value>;
    associateBy<Key, Value>(
        uniqueKeyFn: Transform<T, Key>,
        valueFn?: Transform<T, Value|T>
    ): Map<Key, T|Value> {
        let map = new Map<Key, T|Value>()
        valueFn ??= (t) => t
        for (const item of this) {
            const key = uniqueKeyFn(item)
            if (map.has(key)) {
                throw new Error(`unique key collision on ${key}`)
            }
            map.set(key, valueFn(item))
        }
        return map
    }

    /** Flattens a Lazy<Iterable<T>> to a Lazy<T> */
    flatten(): Lazy<Flattened<T>> {
        let inner = this.#inner
        return Lazy.from(function * () {
            for (const value of inner) {
                yield * requireIterable(value)
            }
        }())
    }

    /** Collect all items into an array. */
    toArray(): Array<T> {
        return [... this.#inner]
    }

    /**
     * Convert to a LazyAsync, which better handles chains of Promises.
     */
    toAsync(): LazyAsync<T> {
        let inner = this.#inner
        let gen = async function*() {
            for (let item of inner) {
                yield item
            }
        }
        return LazyAsync.from(gen())
    }

    fold<I>(initial: I, foldFn: (i: I, t: T) => I): I {
        let inner = this.#inner
        let accumulator = initial
        for (let item of inner) {
            accumulator = foldFn(accumulator, item)
        }
        return accumulator
    }

    sum(): T extends number ? number : never {
        let out = this.fold(0, (a, b) => a + (b as number))
        return out as (T extends number ? number : never)
    }

    avg(): T extends number ? number : never {
        let count = 0
        let sum = this.also( () => { count += 1 } ).sum()
        return sum / count as (T extends number ? number : never)
    }
}



export class LazyAsync<T> implements AsyncIterable<T>, LazyShared<T> {

    /**
     * This lets you directly create an AsyncIterable, but you might prefer
     * the shorter {@link lazy} function.
     */
    static from<T>(iter: AsyncIterable<T>): LazyAsync<T> {
        return new LazyAsync(iter)
    }

    private constructor(iter: AsyncIterable<T>) {
        this.#innerStore = iter
    }
        
    #innerStore?: AsyncIterable<T>

    get #inner(): AsyncIterable<T> {
        let inner = this.#innerStore
        this.#innerStore = undefined

        if (inner === undefined) {
            throw new Error(`Logic Error: Iteration for this LazyAsync has already been consumed`)
        }
        return inner
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return this.#inner[Symbol.asyncIterator]()
    }

    /**
     * Apply `transform` to each element.
     * 
     * Works like {@link Array#map}.
     */
    map<Out>(transform: Transform<T, Awaitable<Out>>): LazyAsync<Out> {
        let inner = this.#inner
        let gen = async function*() {
            for await (let item of inner) {
                yield await transform(item)
            }
        }
        return LazyAsync.from(gen())
    }

    /**
     * 
     * Like {@link map}, but performs up to `max` operations in parallel.
     * 
     * Note: This function will ensure that the order of outputs is the same
     * as the order of the inputs they were mapped from. This can introduce 
     * head-of-line blocking, which can slow performance. If you don't need this,
     * use {@link mapParUnordered} instead.
     * 
     */
    mapPar<Out>(max: number, transform: Transform<T, Promise<Out>>): LazyAsync<Out> {
        let inner = this.#inner
        let gen = async function*() {

            let pending = new Queue<Promise<Out>>()
            for await (let item of inner) {
                pending.push(transform(item))

                while (pending.size >= max) {
                    yield await pending.pop()
                }
            }
            while (!pending.isEmpty) {
                yield await pending.pop()
            }
        }

        return LazyAsync.from(gen())
    }

    /**
     * A version of {@link mapPar} that does *not* enforce ordering, so doesn't
     * suffer from head-of-line blocking.
     */
    mapParUnordered<Out>(max: number, transform: Transform<T, Promise<Out>>): LazyAsync<Out> {
        let inner = this.#inner
        let gen = async function*() {

            let pending: StatefulPromise<Out>[] = []
            // Get a list of (at least one) "done" task.
            let getDone = async () => {
                await Promise.race(pending)
                let done = pending.filter(it => it.state != "pending")
                pending = pending.filter(it => it.state === "pending")
                return done
            }

            for await (let item of inner) {
                pending.push(stateful(transform(item)))

                while (pending.length >= max) {
                    let done = await getDone()
                    for (let d of done) {
                        yield await d
                    }
                }
            }
            while (pending.length > 0) {
                let done = await getDone()
                for (let d of done) {
                    yield await d
                }
            }
        }

        return LazyAsync.from(gen())
    }

    /** Keeps only items for which `f` is `true`. */
    filter(f: Filter<T>): LazyAsync<T> {
        let inner = this.#inner
        let gen = async function*() {
            for await (let item of inner) {
                if (f(item)) { yield item }
            }
        }
        return LazyAsync.from(gen())
    }

    /** Limit the iterator to returning at most `count` items. */
    limit(count: number): LazyAsync<T> {
        let inner = this.#inner
        let countIter = async function*() {
            if (count <= 0) { return } 
            for await (let item of inner) {
                yield item
                if (--count <= 0) { break }
            }
        }
        return LazyAsync.from(countIter())
    }

    /** Injects a function to run on each T as it is being iterated. */
    also(fn: (t: T) => void): LazyAsync<T> {
        let inner = this.#inner
        let gen = async function*() {
            for await (let item of inner) {
                fn(item)
                yield item
            }
        }
        return LazyAsync.from(gen())
    }

    /** Partition items into `matches` and `others` according to Filter `f`. */
    async partition(f: Filter<T>): Promise<Partitioned<T>> {
        let matches: T[] = []
        let others: T[] = []

        for await (const item of this) {
            if (f(item)) { matches.push(item) }
            else { others.push(item) }
        }

        return {matches, others}
    }

    /** Get the first item. @throws if there are no items. */
    async first(): Promise<T> {
        for await (let item of this) {
            return item
        }
        throw new Error(`No items.`)
    }

    /** Get the first item. Returns `defaultValue` if there is no first item. */
    async firstOr<D>(defaultValue: D): Promise<T | D> {
        for await (let item of this) {
            return item
        }
        return defaultValue
    }

    /** Skip (up to) the first `count` elements */
    skip(count: number): LazyAsync<T> {
        let inner = this.#inner
        let gen = async function * () {
            let iter = inner[Symbol.asyncIterator]()
            while (count-- > 0) {
                let next = await iter.next()
                if (next.done) { return }
            }

            while (true) {
                let next = await iter.next()
                if (next.done) { return }
                yield next.value
            }
        }

        return LazyAsync.from(gen())
    }

    /**
     * Given `keyFn`, use it to extract a key from each item, and create a Map
     * grouping items by that key.
     */
    async groupBy<Key>(keyFn: Transform<T, Key>): Promise<Map<Key, T[]>> {
        let map = new Map<Key, T[]>()
        for await (const item of this) {
            const key = keyFn(item)
            let group = map.get(key)
            if (!group) {
                group = []
                map.set(key, group)
            }
            group.push(item)
        }
        return map
    }

    /**
     * Given `uniqueKeyFn`, use it to extract a key from each item, and create a
     * 1:1 map from that to each item.
     * 
     * @throws if duplicates are found for a given key.
     */
    associateBy<Key>( uniqueKeyFn: Transform<T, Key>, ): Promise<Map<Key, T>>;
    /**
     * Takes an additional `valueFn` to extract a value from `T`. The returned
     * map maps from Key to Value. (instead of Key to T)
     */
    associateBy<Key, Value>( uniqueKeyFn: Transform<T, Key>, valueFn: Transform<T, Value> ): Promise<Map<Key, Value>>;
    async associateBy<Key, Value>(
        uniqueKeyFn: Transform<T, Key>,
        valueFn?: Transform<T, T|Value>
    ): Promise<Map<Key, T|Value>> {
        let map = new Map<Key, T|Value>()
        valueFn ??= (t) => t
        for await (const item of this) {
            const key = uniqueKeyFn(item)
            if (map.has(key)) {
                throw new Error(`unique key collision on ${key}`)
            }
            map.set(key, valueFn(item))
        }
        return map
    }

    /** Flattens a Lazy<Iterable<T>> to a Lazy<T> */
    flatten(): LazyAsync<Flattened<T>> {
        let inner = this.#inner
        return LazyAsync.from(async function * () {
            for await (const value of inner) {
                yield * requireIterable(value)
            }
        }())
    }

    /** Collect all items into an array. */
    async toArray(): Promise<T[]> {
        let out: T[] = []
        for await (let item of this) {
            out.push(item)
        }
        return out
    }

    async fold<I>(initial: I, foldFn: (i: I, t: T) => I): Promise<I> {
        let inner = this.#inner
        let accumulator = initial
        for await (let item of inner) {
            accumulator = foldFn(accumulator, item)
        }
        return accumulator
    }

    async sum(): Promise<T extends number ? number : never> {
        let out = await this.fold(0, (a, b) => a + (b as number))
        return out as (T extends number ? number : never)
    }

    async avg(): Promise<T extends number ? number : never> {
        let count = 0
        let sum = await this.also( () => { count += 1 } ).sum()
        return sum / count as (T extends number ? number : never)
    }
}

/**
 * See: <https://github.com/microsoft/TypeScript/issues/31394>
 */
export type Awaitable<T> = T | PromiseLike<T>

/** A function that transforms from In to Out */
export type Transform<In,Out> = (i: In) => Out

/** Filters for matches (where boolean is true) */
export type Filter<T> = (t: T) => boolean

/** The result of partitioning according to a `Filter<T>` */
export interface Partitioned<T> {
    matches: T[],
    others: T[],
}

export type Flattened<T> = T extends Iterable<infer Out> ? Out : never;


/**
 * Returns a Lazy which will yield consecutive numbers.
 */
export function range(args?: RangeArgs): Lazy<number> {
    let {from, to, step, inclusive} = {...rangeArgsDefaults, ...args}
    let gen = function*() {
        for (let x = from; x < to; x += step) {
            yield x
        }
        if (inclusive) { yield to }
    }
    if (step < 0) {
        gen = function*() {
            for (let x = from; x > to; x += step) {
                yield x
            }
            if (inclusive) { yield to }
        }
    }

    return Lazy.from(gen())
}

export interface RangeArgs {
    /** default: 0 */
    from?: number

    /** default: Number.MAX_SAFE_INTEGER */
    to?: number

    /** default: 1 */
    step?: number

    /**
     * default: false
     * 
     * Like ranges in many other languages, a range by default includes its
     * start, but not its end.  If `true`, this will cause the range to include
     * its end.
     * 
     * ```ts
     * import { range } from "./mod.ts"
     * 
     * // [1, 2]:
     * console.log(range({from: 1, to: 3}))
     * 
     * // [1, 2, 3]:
     * console.log(range({from: 1, to: 3, inclusive: true}))
     * ```
     */
    inclusive?: boolean
}

const rangeArgsDefaults: Required<RangeArgs> = {
    from: 0,
    to: Number.MAX_SAFE_INTEGER,
    step: 1,
    inclusive: false,
} as const

function requireIterable<T>(value: T): Iterable<Flattened<T>> {
    if (typeof value != "object" || !value || !(Symbol.iterator in value)) {
        throw new Error(`value is not iterable`)
    }
    return value as Iterable<Flattened<T>>
}

