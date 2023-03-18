
/**
 * A classic queue. Unbounded size.
 */
export class Queue<T> {
    #arr = new Array<T|undefined>()
    #start = 0


    get size(): number { return this.#arr.length - this.#start}
    get isEmpty(): boolean { return this.size === 0 }

    push(item: T): void {
        this.#arr.push(item)
        this.#maybeShrink()
    }

    pop(): T {
        if (this.isEmpty) { throw new Error(`Popping from empty Queue`) }

        let index = this.#start++

        // type may be `undefined`, but only if we have a programming error. 
        let item = this.#arr[index]!
        // unset to allow for GC of objects:
        this.#arr[index] = undefined


        return item
    }

    // Don't resize down on pop()s, because we might just be draining the queue
    // and done with it. (in which case GC will handle it for us)
    #maybeShrink() {
        if (this.#start > 100 && this.#start > this.#arr.length / 2) {
            this.#arr = this.#arr.slice(this.#start)
            this.#start = 0
        }
    }
}