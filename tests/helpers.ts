// deno-lint-ignore-file explicit-module-boundary-types

import { lazy, LazyShared } from "../mod.ts";

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


export async function testBoth<T>(t: Deno.TestContext, data: Iterable<T>, innerTest: (iter: LazyShared<T>) => Promise<unknown>) {
    let input = [...data]
    await t.step("sync", async () => {
        await innerTest(lazy(input))
    })
    await t.step("async", async () => {
        await innerTest(lazy(input).toAsync())
    })
}
