import { range } from "../mod.ts";
import { assertEquals } from "./helpers.ts";

Deno.test(function peekableSync() {
    let iter = range({to: 100, step: 3})
        .filter(it => it % 2 == 0)
        .peekable();

    assertEquals(iter.peek().value, 0)
    assertEquals(iter.peek().value, 0)
    assertEquals(iter.next().value, 0)

    assertEquals(iter.next().value, 6)

    assertEquals(iter.peek().value, 12)
    assertEquals(iter.peek().value, 12)
    assertEquals(iter.next().value, 12)

    for (let next = iter.peek(); !next.done && next.value < 96 ; iter.next(), next = iter.peek()) {
        // console.log(iter.peek())
     }

    assertEquals(iter.peek().value, 96)
    assertEquals(iter.next().value, 96)

    assertEquals(iter.peek().done, true)
    assertEquals(iter.peek().done, true)
    assertEquals(iter.next().done, true)
    assertEquals(iter.next().done, true)
})


Deno.test(async function peekableAsync() {
    let iter = range({to: 100, step: 3})
        .filter(it => it % 2 == 0)
        .toAsync()
        .peekable();

    assertEquals((await iter.peek()).value, 0)
    assertEquals((await iter.peek()).value, 0)
    assertEquals((await iter.next()).value, 0)

    assertEquals((await iter.next()).value, 6)

    assertEquals((await iter.peek()).value, 12)
    assertEquals((await iter.peek()).value, 12)
    assertEquals((await iter.next()).value, 12)

    for (let next = await iter.peek(); !next.done && next.value < 96 ; iter.next(), next = await iter.peek()) {
        // console.log(iter.peek())
     }

    assertEquals((await iter.peek()).value, 96)
    assertEquals((await iter.next()).value, 96)

    assertEquals((await iter.peek()).done, true)
    assertEquals((await iter.peek()).done, true)
    assertEquals((await iter.next()).done, true)
    assertEquals((await iter.next()).done, true)
})