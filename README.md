Better Iterators
================

Better iterators for TypeScript.

While JavaScript defines Iterable and AsyncIterable interfaces, they leave a bit
to be desired if you're coming from other languages (Rust, Kotlin, Java) that
make more tools available on iterables.

Better Iterators aims to bring those tools to TypeScript.

For example code and API docs, see:  
<https://deno.land/x/better_iterators/mod.ts>


Features / Goals
----------------

 * Type-safe
 * Easy to use 
 * Support both `Iterable` and `AsyncIterable`
 * Support for (opt-in, bounded) async parallelism.
 * Standard ECMAScript modules (works in Deno, Node, and browsers).
 * No [Monkey Patching]


[Monkey Patching]: https://en.wikipedia.org/wiki/Monkey_patch


Installation
------------

### Deno ###

```ts
import { lazy } from "https://deno.land/x/better_iterators/mod.ts"
```

### Node ### 

TODO: Let me know (open an issue) if you'd like to use this from node, and I'll
publish it to npm. 


Other Iterator Libraries
------------------------

What makes "Better Iterators" better?

I did some searching for other Iterator libraries in TypeScript. I don't want to
name names, but here are some of the problems I had with what I found:

 * abandoned codebases (ex: GitHub repo archived)
 * function-based APIs that make chaining operations cumbersome
 * poor handling of async iteration. ex:
   * No special async handling
   * implementations or examples that cause unbounded parallelism.


