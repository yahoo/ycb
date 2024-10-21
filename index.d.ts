type Bundle<T> = Array<Main<T> | Delta<T> | { dimensions: [{ [dimension: string]: Dimension }] }>;

type Context = { [dimension: string]: string };

type Delta<T> = {
    settings: Settings<[`${string}:${string}`, ...Array<`${string}:${string}`>]>;
} & DeepPartial<T>;

type DeepPartial<T> = T extends object
    ? {
          [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;

type Dimension = { [dimension: string]: Dimension | null };

type Main<T> = { settings: Settings<['main' | 'master']> } & T;

type Schedule = { start?: string; end?: string };

type Settings<T> = T | { dimensions: T; schedule?: Schedule };

declare module 'ycb' {
    class Ycb<T extends Object> {
        constructor(bundle: Bundle<T>, options?: { logContext?: string });
        read(
            context: Context,
            options?: {
                applySubstitutions?: boolean;
            },
        ): T;
        readNoMerge(
            context: Context,
            options?: {
                applySubstitutions?: boolean;
            },
        ): T[];
        readTimeAware(
            context: Context,
            time: number,
            options?: {
                applySubstitutions?: boolean;
                cacheInfo?: boolean;
            },
        ): T;
        readNoMergeTimeAware(
            context: Context,
            time: number,
            options?: {
                applySubstitutions?: boolean;
                cacheInfo?: boolean;
            },
        ): T[];
    }

    function read<T>(bundle: Bundle<T>, context: Context, validate?: boolean, debug?: boolean): T;
    function readNoMerge<T>(bundle: Bundle<T>, context: Context, validate?: boolean, debug?: boolean): T;
}
