v1.5.0
======

Release: 2023-08-02

 * New format for parallel `.map()` calls:
   ```
    myLazy.map({
        parallel: 5,
        ordered: false, // optional. avoids head-of-line blocking.
        async mapper(t) {
            return await fetch(t) // whatever async operations.
        },
    })
    .map(...)
   ```
 * This format will auto-convert a non-async Lazy to an Async one.
 * The `mapPar()` and `mapParUnordered()` methods are deprecated and will
   be removed in 2.0.