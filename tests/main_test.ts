import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { delay } from "https://deno.land/std@0.179.0/async/delay.ts";


import { lazy, range } from "../mod.ts";
import { ParallelTracker, Timer } from "./helpers.ts";

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
        .also(url => console.log(`fetching: ${url}`))
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
            await delay(50)
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