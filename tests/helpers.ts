// deno-lint-ignore-file explicit-module-boundary-types

import { lazy, Lazy, LazyAsync } from "../mod.ts";

export class ParallelTracker {
    count = 0
    highest = 0

    start() {
        this.count++
        if (this.count > this.highest) this.highest = this.count
    }

    end() {
        this.count--
    }
}

export class Timer {
    started?: number
    ended?: number

    constructor() {
        this.start()
    }

    stop() {
        this.ended = Date.now()
    }

    start() {
        this.started = Date.now()
        this.ended = undefined
    }

    get elapsedMs() {
        let start = this.started
        if (!start) { throw new Error(`Timer was not started`)}
        let end = this.ended ?? Date.now()
        return end - start
    }
}


export async function testBoth<T>(t: Deno.TestContext, data: Iterable<T>, innerTest: (iter: Lazy<T>|LazyAsync<T>) => Promise<unknown>) {
    let input = [...data]
    await t.step("sync", async () => {
        await innerTest(lazy(input))
    })
    await t.step("async", async () => {
        await innerTest(lazy(input).toAsync())
    })
}


/** Oddly, Deno's assertThrows doesn't work for async. */
export async function assertThrowsAsync(fn: () => void): Promise<unknown> {
    let threw = false
    let thrown: unknown = undefined
    try {
        await fn()
    } catch (e) {
        threw = true
        thrown = e
    } 

    if (!threw) {
        throw new Error(`assertThrowsAsync didn't throw`)
    }
    return thrown
}