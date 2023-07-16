import { assert, assertEquals, assertNotEquals, assertThrows } from "https://deno.land/std@0.179.0/testing/asserts.ts";


import { lazy, range } from "../mod.ts";
import { delay, ParallelTracker, testBoth, Timer } from "./helpers.ts";

Deno.test("basic", () => {
    let iterable = range({to: 1000})
    
    let results = lazy(iterable)
        .filter(it => it % 2 == 0)
        .map(it => it*it)
        .limit(10)

    assertEquals(results.toArray(), [0, 4, 16, 36, 64, 100, 144, 196, 256, 324])
});

Deno.test(function filter() {
    let input = [1, 2, 3, 4, 5]
    let output = lazy(input).filter(it => it > 2).toArray()

    assertEquals(output, [3, 4, 5])
})

Deno.test(function map() {
    let input = [1, 2, 3, 4, 5]
    let output = lazy(input).map(it => it % 2).toArray()

    assertEquals(output, [1, 0, 1, 0, 1])
})

Deno.test(function limit() {
    let input = [1, 2, 3, 4, 5]
    let output = lazy(input).limit(3).toArray()

    assertEquals(output, [1, 2, 3])
})

Deno.test(async function asyncViaLazy() {
    let urls = [
        "https://www.google.com/",
        "https://www.bing.com/",
    ]
    let lazySizes = lazy(urls)
        .also(url => console.log(`simulating fetching: ${url}`))
        .map(async (url) => {
            // let response = await fetch(url)
            // if (!response.ok) {
            //     throw new Error(`HTTP ${response.status} from ${url}`)
            // }
            // return await response.text()

            // Don't actually hit those sites, just simulate some delay:
            await delay(50)
            return url
            
        })
        // NOTE: The type here is Lazy<Promise<string>>, so we have to deal with
        // Promises for the rest of our pipeline, even for simple things like this:
        .map(async (bodyPromise) => (await bodyPromise).length)

    // You also get a list of promises, which you then have to await yourself:
    let sizePromises: Promise<number>[] = lazySizes.toArray()

    // Also, this has parallelization of O(N) which is maybe not desirable.
    let sizes: number[] = await Promise.all(sizePromises)
    console.log({sizes})
})

/**
 * Uses a LazyAsync, but still processes serially, so is slow.
 */
Deno.test(async function asyncViaLazyAsync() {

    let slowpoke = range({to: 10})
        .toAsync()
        // simulate slowness:
        .map(async (input) => {
            await delay(50)
            return input * input
        })

    let timer = new Timer()
    let out = await slowpoke.toArray()
    timer.stop()
    console.log({elapsed: timer.elapsedMs})

    assert(timer.elapsedMs > 500)
    assertEquals(out[0], 0)
    assertEquals(out[9], 81)
})

/**
 * Uses LazyAsync, and processes in parallel.
 */
Deno.test(async function asyncLazyParallel() {
    let zoomie = range({to: 100})
        .toAsync()
        .mapPar(1000, async (input) => {
            await delay(50)
            return input*input
        })

    let timer = new Timer()
    let out = await zoomie.toArray()
    timer.stop()
    console.log({elapsed: timer.elapsedMs})

    assert(timer.elapsedMs < 100)
    assertEquals(out[0], 0)
    assertEquals(out[9], 81)
})

Deno.test(async function asyncLazyMaxParallelism() {
    const maxParallel = 10

    let tracker = new ParallelTracker()
    let zoomie = range({to: 100})
        .toAsync()
        .mapPar(maxParallel, async (input) => {
            tracker.start()
            // trying to control for parallelism for async tasks:
            await delay(5)
            tracker.end()
            return input*input
        })

    // No iteration yet:
    assertEquals(0, tracker.count)
    assertEquals(0, tracker.highest)

    let timer = new Timer()
    let out = await zoomie.toArray()
    timer.stop()
    console.log({elapsed: timer.elapsedMs})

    assertEquals(out[0], 0)
    assertEquals(out[9], 81)

    assertEquals(tracker.count, 0, "Tracker should arrive back at 0 pending semaphores")
    assertEquals(tracker.highest, maxParallel)
})


Deno.test(async function unorderedParallelism() {
    const maxParallel = 10

    let tracker = new ParallelTracker()
    let zoomie = range({to: 10})
        .toAsync()
        .mapParUnordered(maxParallel, async (input) => {
            tracker.start()
            // trying to control for parallelism for async tasks:
            await delay(Math.random() * 50)
            tracker.end()
            return input*input
        })

    // No iteration yet:
    assertEquals(0, tracker.count)
    assertEquals(0, tracker.highest)

    let timer = new Timer()
    let out = await zoomie.toArray()
    timer.stop()
    console.log({elapsed: timer.elapsedMs})

    // We can't be guaranteed of this order. But it's very unlikely to be
    // exactly in order:
    let orderedValues = [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
    assertNotEquals(out, orderedValues)

    assertEquals(out.toSorted((a, b) => a - b), orderedValues)
    

    assertEquals(tracker.count, 0, "Tracker should arrive back at 0 pending semaphores")
    assertEquals(tracker.highest, maxParallel)
})



Deno.test(function generatorState() {
    let out: string[] = []

    let genFn = function*() {
        out.push("starting")
        yield 42
        out.push("done")
    }

    let iter = genFn()

    // Hasn't started yet:
    assertEquals(out, [])

    // Still hasn't finished:
    iter.next()
    assertEquals(out, ["starting"])

    // Only finishes after returning "done":
    iter.next()
    assertEquals(out, ["starting", "done"])
})

/**
 * tests that a Lazy(Async) gets "consumed" when it's used, so it can not
 * be used more than once (which would result in undefined behavior).
 */
Deno.test(async function lazyConsumed(t: Deno.TestContext) {
    // deno-lint-ignore require-await
    await testBoth(t, range({to: 10}), async (iter) => {
        // should work OK:
        iter.map(it => it * it)

        assertThrows(() => {
            iter.map(it => it * it)
        })
    })
            
})

Deno.test(async function lazyPartition(t: Deno.TestContext) {
    await testBoth(t, range({to: 10}), async (iter) => {
        let parts = await iter.partition(it => it % 2 == 0)
        assertEquals(parts.matches, [0, 2, 4, 6, 8])
        assertEquals(parts.others,  [1, 3, 5, 7, 9])
    })
})

Deno.test(async function lazyFirst(t: Deno.TestContext) {
    await testBoth(t, range({from: 42, to: 50}), async (iter) => {
        let it = await iter.first()
        assertEquals(it, 42)
    })
})

Deno.test(async function lazyFirstThrows(t: Deno.TestContext) {
    await testBoth(t, range({from: 42, to: 42}), async (iter) => {
        let thrown: unknown = undefined
        try {
            await iter.first()
        } catch (e) {
            thrown = e
        }
        assert(thrown)
    })
})

Deno.test(async function lazyFirstOr(t: Deno.TestContext) {
    await testBoth(t, range({from: 42, to: 42}), async (iter) => {
        let it = await iter.firstOr(null)
        assert(it === null)
    })
})

Deno.test(function emptyRange() {
    let items = range({from: 10, to: 10}).toArray()
    assertEquals(items, [])
})

Deno.test(async function lazySkip(t: Deno.TestContext) {
    await testBoth(t, range({to: 10}), async (iter) => {
        assertEquals(await iter.skip(3).first(), 3)
    })
})

Deno.test(async function lazyFlatten(t) {
    let numNums = [[1, 2, 3], [3, 4, 5]]
    await testBoth(t, numNums, async(iter) => {
        let nums = await iter.flatten().toArray()
        assertEquals(nums, [1, 2, 3, 3, 4, 5])
    })
})

Deno.test(async function foldAndSum(t) {
    let data = range({to: 10}).toArray()
    await testBoth(t, data, async (iter) => {
        assertEquals(await iter.sum(), 45)
    })
})


Deno.test(async function avg(t) {
    let data = range({to: 10}).toArray()
    await testBoth(t, data, async (iter) => {
        assertEquals(await iter.avg(), 4.5)
    })
})

Deno.test(async function joinToString(t) {
    const input = () => range({from: 14, to: 21})
    await testBoth(t, input, async (iter) => {
        let result = await iter
            .map(num => `${num}: ${fizzBuzz(num)}`)
            .joinToString()
        assertEquals(result, "14: 14, 15: FizzBuzz, 16: 16, 17: 17, 18: Fizz, 19: 19, 20: Buzz")
    })
})

Deno.test(async function joinToStringWithSep(t) {
    const input = () => range({from: 14, to: 21})
    await testBoth(t, input, async (iter) => {
        let result = await iter
            .map(num => `${num}: ${fizzBuzz(num)}`)
            .joinToString({sep: "X"})
        assertEquals(result, "14: 14X15: FizzBuzzX16: 16X17: 17X18: FizzX19: 19X20: Buzz")
    })
})

Deno.test(async function joinToStringEmpty(t) {
    await testBoth(t, [], async (iter) => {
        let result = await iter
            .joinToString()

        assertEquals(result, "")
    })
})

function fizzBuzz(num: number) {
    if (num % 15 == 0) {
        return "FizzBuzz"
    }
    if (num % 5 == 0) {
        return "Buzz"
    }
    if (num % 3 == 0) {
        return "Fizz"
    }
    return `${num}`
}