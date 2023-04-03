
/**
 * Testing how Deno/V8 handles early generator returns from for-of loops.
 * 
 * <https://github.com/NfNitLoop/better-iterators/issues/5>
 * 
 * @module
 */

import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { lazy, range } from "../mod.ts";


Deno.test(function syncGeneratorEarlyReturn() {
    let out: string[] = []

    let gen = function*() {
        try {
            for (const value of range({to: 10})) {
                out.push(`yielding: ${value}`)
                yield value
            }
        } finally {
            out.push("finally")
        }
    }

    for (const value of lazy(gen()).limit(2)) {
        out.push(`got: ${value}`)
    }

    // Yay: foreach does the right thing with generators.
    // At least in Deno (and probably V8). If your runtime doesn't, file a bug. :p
    assertEquals(out, [
        "yielding: 0",
        "got: 0",
        "yielding: 1",
        "got: 1",
        "finally",
    ])
})

// Difficult to generalize this, since the generator function needs to reference
// `out`, so this is a copy/paste of the sync version above.
Deno.test(async function asyncGeneratorEarlyReturn() {
    let out: string[] = []

    let gen = function*() {
        try {
            for (const value of range({to: 10})) {
                out.push(`yielding: ${value}`)
                yield value
            }
        } finally {
            out.push("finally")
        }
    }

    for await (const value of lazy(gen()).toAsync().limit(2)) {
        out.push(`got: ${value}`)
    }

    // Yay: foreach does the right thing with generators.
    // At least in Deno (and probably V8). If your runtime doesn't, file a bug. :p
    assertEquals(out, [
        "yielding: 0",
        "got: 0",
        "yielding: 1",
        "got: 1",
        "finally",
    ])
})

