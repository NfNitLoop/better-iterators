// Like associateBy, due to complicated types, TypeScript can't unify
// method call signatures for (Lazy|LazyShared).groupBy(), so we test them 
// separately:

import { lazy } from "../mod.ts";
import { BIGGEST_US_CITIES, assertEquals } from "./helpers.ts";

Deno.test(function groupBySync() {
    let iter = lazy(BIGGEST_US_CITIES)

    let byState = iter.groupBy(it => it.state)
    assertEquals(byState.get("CA")?.length, 3)
    assertEquals(byState.get("TX")?.length, 3)
    assertEquals(byState.get("NY")?.length, 1)
})

Deno.test(async function groupByAsync() {
    let iter = lazy(BIGGEST_US_CITIES).toAsync()
    let byState = await iter.groupBy(it => it.state)
    assertEquals(byState.get("CA")?.length, 3)
    assertEquals(byState.get("TX")?.length, 3)
    assertEquals(byState.get("NY")?.length, 1)
})

Deno.test(function groupByWithValuesSync() {
    let iter = lazy(BIGGEST_US_CITIES)

    let byState = iter.groupBy(it => it.state, it => it.name)
    assertEquals(byState.get("CA"), ["Los Angeles", "San Diego", "San Jose"])
    assertEquals(byState.get("TX"), ["Houston", "San Antonio", "Dallas"])
    assertEquals(byState.get("NY"), ["New York City"])
})

Deno.test(async function groupByWithValuesAsync() {
    let iter = lazy(BIGGEST_US_CITIES).toAsync()

    let byState = await iter.groupBy(it => it.state, it => it.name)
    assertEquals(byState.get("CA"), ["Los Angeles", "San Diego", "San Jose"])
    assertEquals(byState.get("TX"), ["Houston", "San Antonio", "Dallas"])
    assertEquals(byState.get("NY"), ["New York City"])
})
