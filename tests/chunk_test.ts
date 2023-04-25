import { range } from "../mod.ts";
import { assertEquals, testBoth } from "./helpers.ts";

Deno.test(async function chunked(t: Deno.TestContext) {
    await testBoth(t, range({to: 10}), async (iter) => {
        let chunks = await iter.chunked(3).toArray()

        assertEquals(chunks, [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [9],
        ])
    })
            
})