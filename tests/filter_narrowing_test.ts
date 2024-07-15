import { lazy } from "../mod.ts";
import { assertEquals } from "./helpers.ts";

interface Foo {
    foo: string
}
interface Bar {
    bar: string
}

const FOOS_AND_BARS: (Foo|Bar)[] = [
    {foo: "Hello, "},
    {bar: "Greetings, "},
    {foo: "world!"},
    {bar: "earthlings."},
]

/** Test that filter(isFoo) narrows the return type. */
// Again, this doesn't work well w/ union types, so separating for sync/async.
Deno.test(function filterNarrowingSync() {
    let iter = lazy(FOOS_AND_BARS)
    // In TypeScript 5.5 (Deno 1.45), we no longer need separate type-narrowing functions:
    let result = iter.filter(it => "foo" in it)
        // This bit is possible due to type narrowing:
        .map(it => it.foo)
        .toArray()
    assertEquals("Hello, world!", result.join(""))
})

/** Test that filter(isFoo) narrows the return type. */
Deno.test(async function filterNarrowingAsync() {
    let iter = lazy(FOOS_AND_BARS).toAsync()
    // In TypeScript 5.5 (Deno 1.45), we no longer need separate type-narrowing functions:
    let result = await iter.filter(it => "foo" in it)
        // This bit is possible due to type narrowing:
        .map(it => it.foo)
        .toArray()
    assertEquals("Hello, world!", result.join(""))
})
