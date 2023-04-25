
/** An iterator that allows peeking at the next item without removing it. */
export class Peekable<T, TReturn=unknown, TNext = undefined> implements Iterator<T, TReturn, TNext> {

    static from<T>(inner: Iterable<T>): Peekable<T> {
        return new Peekable(inner[Symbol.iterator]())
    }
    
    #inner: Iterator<T,TReturn,TNext>;
    #peeked?: IteratorResult<T, TReturn>;


    constructor(inner: Iterator<T, TReturn, TNext>) {
        this.#inner = inner
        this.return = inner.return?.bind(inner)
        this.throw = inner.throw?.bind(inner)
    }

    /** Returns the value that the next call to {@link #next} would yield. */
    peek(): IteratorResult<T, TReturn> {
        if (this.#peeked === undefined) {
            this.#peeked = this.#inner.next()
        }
        return this.#peeked;
    }

    next(): IteratorResult<T, TReturn> {
        if (this.#peeked !== undefined) {
            let next = this.#peeked
            this.#peeked = undefined
            return next
        }

        return this.#inner.next()
    }

    // Delegate to inner:
    return?: ((value?: TReturn) => IteratorResult<T,TReturn>);
    throw?: ((e?: unknown) => IteratorResult<T,TReturn>);
}




/** An iterator that allows peeking at the next item without removing it. */
export class PeekableAsync<T, TReturn=unknown, TNext = undefined> implements AsyncIterator<T, TReturn, TNext> {

    static from<T>(inner: AsyncIterable<T>): PeekableAsync<T> {
        return new PeekableAsync(inner[Symbol.asyncIterator]())
    }
    
    #inner: AsyncIterator<T,TReturn,TNext>;
    #peeked?: Promise<IteratorResult<T, TReturn>>;


    constructor(inner: AsyncIterator<T, TReturn, TNext>) {
        this.#inner = inner
        this.return = inner.return?.bind(inner)
        this.throw = inner.throw?.bind(inner)
    }

    /** Returns the value that the next call to {@link #next} would yield. */
    peek(): Promise<IteratorResult<T, TReturn>> {
        if (this.#peeked === undefined) {
            this.#peeked = this.#inner.next()
        }
        return this.#peeked;
    }

    next(): Promise<IteratorResult<T, TReturn>> {
        if (this.#peeked !== undefined) {
            let next = this.#peeked
            this.#peeked = undefined
            return next
        }

        return this.#inner.next()
    }

    // Delegate to inner:
    return?: ((value?: TReturn) => Promise<IteratorResult<T,TReturn>>);
    throw?: ((e?: unknown) => Promise<IteratorResult<T,TReturn>>);
}