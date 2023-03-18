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
 * // Has no more values to yield: (may throw an exception in the future!)
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
 * have N URLs, .toArray() will create N promises, and the JavaScript runtime
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
/**
 * Shared interface for {@link Lazy} and {@link LazyAsync}. 
 * (Note: `LazyAsync` implements some methods that are not shared.)
 * 
 * You shouldn't need to interact with these classes or this interface
 * directly, though. You can convert to the appropriate one with {@link lazy()}.
 * 
 * Operations on lazy iterators consume the underlying iterator. You should not
 * use them again.
 */
export interface LazyShared<T> {

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

    // TODO:
    // partition()
    // skip()
    // first()
    // last()
    // associateBy()
    // groupBy()
}

export class Lazy<T> implements Iterable<T>, LazyShared<T> {

    static from<T>(iter: Iterable<T>): Lazy<T> {
        return new Lazy(iter)
    }

    private constructor(iter: Iterable<T>) {
        this.#inner = iter
    }

    // TODO: takeInner, so that a Lazy can't be re-used.
    #inner: Iterable<T>;

    * [Symbol.iterator](): Iterator<T> {
        yield * this.#inner
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
        this.#inner = iter
    }
        
    #inner: AsyncIterable<T>;

    async * [Symbol.asyncIterator](): AsyncIterator<T> {
        yield * this.#inner
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

    /** Collect all items into an array. */
    async toArray(): Promise<T[]> {
        let out: T[] = []
        for await (let item of this.#inner) {
            out.push(item)
        }
        return out
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

    /** default: false */
    inclusive?: boolean
}

const rangeArgsDefaults: Required<RangeArgs> = {
    from: 0,
    to: Number.MAX_SAFE_INTEGER,
    step: 1,
    inclusive: false,
} as const