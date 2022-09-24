type IsBlockedFn = (identifier: string) => { blocked: boolean; reset: number };

export type EphemeralCache = {
    isBlocked: IsBlockedFn;
    blockUntil: (identifier: string, reset: number) => void;
}



export class Cache implements EphemeralCache {
    /**
   * Stores identifier -> reset (in milliseconds)
   */
    private readonly cache: Map<string, number>;

    constructor(cache: Map<string, number>) {
        this.cache = cache;
    }

    public isBlocked(identifier: string): ReturnType<IsBlockedFn> {
        if (!this.cache.has(identifier)) {
            return { blocked: false, reset: 0 };
        }

        const reset = this.cache.get(identifier)!;
        if (reset < Date.now()) {
            this.cache.delete(identifier);
            return { blocked: false, reset: 0 };
        }

        return { blocked: true, reset };
    }

    public blockUntil(identifier: string, reset: number): void {
        this.cache.set(identifier, reset);
    }
};