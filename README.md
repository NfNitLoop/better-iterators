[![JSR Version]][JSR Link]

Better Iterators
================

Better iterators for TypeScript.

While JavaScript defines Iterable and AsyncIterable interfaces, they leave a bit
to be desired if you're coming from other languages (Rust, Kotlin, Java) that
make more tools available on iterables.

Better Iterators aims to bring those tools to TypeScript.

For example code and API docs, see:  
<https://jsr.io/@nfnitloop/better-iterators>


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

The [JSR page][JSR Link] has 
instructions for installing for Deno, npm, yarn, pnpm, and bun.


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


[JSR Version]: https://jsr.io/badges/@nfnitloop/better-iterators
[JSR Link]: https://jsr.io/@nfnitloop/better-iterators
