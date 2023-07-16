import { assertEquals } from "https://deno.land/std@0.179.0/testing/asserts.ts";
import { range } from "../mod.ts";
import { testBoth } from "./helpers.ts";


Deno.test(async function repeats(t) {
    await testBoth(t, () => range({to: 4}), async (iter) => {
        let result = await iter.repeat(3).toArray()
        assertEquals(result, [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3])
    })
})

Deno.test(async function loops(t) {
    await testBoth(t, () => range({to: 4}), async (iter) => {
        let result = await iter.loop().skip(2).limit(11).toArray()
        assertEquals(result, [2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0])
    })
})