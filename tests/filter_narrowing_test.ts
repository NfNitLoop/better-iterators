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

function isFoo(obj: Foo|Bar): obj is Foo {
    return "foo" in obj
}

/** Test that filter(isFoo) narrows the return type. */
// Again, this doesn't work well w/ union types, so separating for sync/async.
Deno.test(function filterNarrowingSync() {
    let iter = lazy(FOOS_AND_BARS)
    let result = iter.filter(isFoo)
        // This bit is possible due to type narrowing:
        .map(it => it.foo)
        .toArray()
    assertEquals("Hello, world!", result.join(""))
})

/** Test that filter(isFoo) narrows the return type. */
Deno.test(async function filterNarrowingAsync() {
    let iter = lazy(FOOS_AND_BARS).toAsync()
    let result = await iter.filter(isFoo)
        // This bit is possible due to type narrowing:
        .map(it => it.foo)
        .toArray()
    assertEquals("Hello, world!", result.join(""))
})
