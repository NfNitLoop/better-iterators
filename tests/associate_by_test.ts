

import { lazy, } from "../mod.ts";
import { assertThrowsAsync, assertEquals, BIGGEST_US_CITIES, assertThrows, assertIsError} from "./helpers.ts";

// We can't testBoth() for associateBy(), because TypeScript can't unify the
// overloaded method signatures. 
// For example, see: <https://github.com/microsoft/TypeScript/pull/29011>
// This is fine. No one should need to work w/ a union of those types in practice.
// This also forces us to check the (relatively complicated) types for the a/sync
// versions separately.
// Note: We should NOT rely on the LazyShared interface, because
// the interface actually exposed by Lazy & LazySync may slightly differ. 
Deno.test(function associateBySync() {
    let iter = lazy(BIGGEST_US_CITIES)
    let byCity = iter.associateBy(it => it.name)
    assertEquals(byCity.get("San Diego")?.state, "CA")
})

Deno.test(async function associateByAsync() {
    let iter = lazy(BIGGEST_US_CITIES).toAsync()
    let byCity = await iter.associateBy(it => it.name)
    assertEquals(byCity.get("San Diego")?.state, "CA")
})


Deno.test(function associateByThrowsSync() {
    let iter = lazy(BIGGEST_US_CITIES)
    let thrown = assertThrows(() => {
        iter.associateBy(it => it.state)
    })

    assertIsError(thrown, undefined, "unique key collision")
})

Deno.test(async function associateByThrowsAsync() {
    let iter = lazy(BIGGEST_US_CITIES).toAsync()
    let thrown = await assertThrowsAsync(async () => {
        await iter.associateBy(it => it.state)
    })

    assertIsError(thrown, undefined, "unique key collision")
})


Deno.test(function associateByWithValuesSync() {
    let iter = lazy(BIGGEST_US_CITIES)
    let statesByCity = iter.associateBy(it => it.name, it => it.state)
    assertEquals(statesByCity.get("San Diego"), "CA")
})

Deno.test(async function associateByWithValuesAsync() {
    let iter = lazy(BIGGEST_US_CITIES).toAsync()
    let statesByCity = await iter.associateBy(it => it.name, it => it.state)
    assertEquals(statesByCity.get("San Diego"), "CA")
})
