// deno-lint-ignore-file explicit-module-boundary-types

export { assert, assertEquals, assertIsError, assertThrows } from "https://deno.land/std@0.179.0/testing/asserts.ts";
export { delay } from "https://deno.land/std@0.179.0/async/delay.ts";


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


export async function testBoth<T>(t: Deno.TestContext, data: Iterable<T> | (() => Iterable<T>), innerTest: (iter: Lazy<T>|LazyAsync<T>) => Promise<unknown>) {
    let input: () => Iterable<T>
    if (Symbol.iterator in data) {
        const inputValues = [...data]
        input = () => inputValues
    } else {
        input = data
    }
    await t.step("sync", async () => {
        await innerTest(lazy(input()))
    })
    await t.step("async", async () => {
        await innerTest(lazy(input()).toAsync())
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


export interface City {
    name: string
    pop2023: number
    state: string
}

// Some data we can use for groupBy/associateBy
// 10 largest cities in the U.S.A.
export const BIGGEST_US_CITIES: City[] = [
    {
        "name": "New York City",
        "pop2023": 8992908,
        "state": "NY"
    },
    {
        "name": "Los Angeles",
        "pop2023": 3930586,
        "state": "CA"
    },
    {
        "name": "Chicago",
        "pop2023": 2761625,
        "state": "IL"
    },
    {
        "name": "Houston",
        "pop2023": 2366119,
        "state": "TX"
    },
    {
        "name": "Phoenix",
        "pop2023": 1656892,
        "state": "AZ"
    },
    {
        "name": "Philadelphia",
        "pop2023": 1627134,
        "state": "PA"
    },
    {
        "name": "San Antonio",
        "pop2023": 1466791,
        "state": "TX"
    },
    {
        "name": "San Diego",
        "pop2023": 1410791,
        "state": "CA"
    },
    {
        "name": "Dallas",
        "pop2023": 1336347,
        "state": "TX"
    },
    {
        "name": "San Jose",
        "pop2023": 1033430,
        "state": "CA"
    },
]