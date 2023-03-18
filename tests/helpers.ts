// deno-lint-ignore-file explicit-module-boundary-types

import { lazy, LazyShared, range } from "../mod.ts";

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


/** Give back both types of lazy iterators, so we can test against them both */
export function *bothTypes(): Iterable<[name: string, iter: LazyShared<number>]> {
    let input = range({to: 10}).toArray()
    yield ["sync", lazy(input)]
    yield ["async", lazy(input).toAsync() ]
}