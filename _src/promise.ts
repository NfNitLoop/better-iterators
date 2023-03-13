/**
 * Wraps a Promise and lets you observe its state.
 */
export class StatefulPromise<T> implements Promise<T>{

    #state: PromiseState = "pending"
    #inner: Promise<T>

    constructor(p: Promise<T>) {
        this.#inner = p

        this.#watch(p)
    }

    get state() { return this.#state }

    async #watch(p: Promise<T>) {
        try {
            await p
            this.#state = "resolved"
        } catch (_err) {
            this.#state = "rejected"
        }
    }
    
    // Wrappers. (Thanks, VSCode, for generating these types. :p)
    then<TResult1=T,TResult2=never>(
        onfulfilled?: ((value: T) => TResult1|PromiseLike<TResult1>)|null|undefined,
        onrejected?: ((reason: unknown) => TResult2|PromiseLike<TResult2>)|null|undefined
    ): Promise<TResult1|TResult2> {
        return this.#inner.then(onfulfilled, onrejected)
    }
    catch<TResult=never>(
        onrejected?: ((reason: unknown) => TResult|PromiseLike<TResult>)|null|undefined
    ): Promise<T|TResult> {
        return this.#inner.catch(onrejected)
    }
    finally(onfinally?: (() => void)|null|undefined): Promise<T> {
        return this.#inner.finally(onfinally)
    }

    [Symbol.toStringTag] = "StatefulPromise"

    
}

export type PromiseState = "pending" | "resolved" | "rejected"

/** Shorter helper method */
export function stateful<T>(p: Promise<T>): StatefulPromise<T> {
    return new StatefulPromise(p)
}