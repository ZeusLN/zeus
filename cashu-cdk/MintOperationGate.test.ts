import MintOperationGate from './MintOperationGate';

const deferred = <T = void>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

const MINT = 'https://mint.example';

describe('MintOperationGate', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    it('runs operations on a mint concurrently', async () => {
        const gate = new MintOperationGate();
        const first = deferred<string>();
        const second = deferred<string>();
        const started: string[] = [];

        const a = gate.runOperation(MINT, () => {
            started.push('a');
            return first.promise;
        });
        const b = gate.runOperation(MINT, () => {
            started.push('b');
            return second.promise;
        });
        await flush();
        expect(started).toEqual(['a', 'b']);

        second.resolve('b');
        first.resolve('a');
        await expect(Promise.all([a, b])).resolves.toEqual(['a', 'b']);
    });

    it('does not start recovery while an operation is in flight', async () => {
        const gate = new MintOperationGate();
        const melt = deferred();
        const recover = jest.fn(async () => 'report');

        const operation = gate.runOperation(MINT, () => melt.promise);
        await flush();

        await expect(gate.tryRunRecovery(MINT, recover)).resolves.toEqual({
            ran: false
        });
        expect(recover).not.toHaveBeenCalled();

        melt.resolve();
        await operation;
        await expect(gate.tryRunRecovery(MINT, recover)).resolves.toEqual({
            ran: true,
            result: 'report'
        });
    });

    it('frees the mint for recovery when an operation throws', async () => {
        const gate = new MintOperationGate();

        await expect(
            gate.runOperation(MINT, async () => {
                throw new Error('melt failed');
            })
        ).rejects.toThrow('melt failed');

        await expect(
            gate.tryRunRecovery(MINT, async () => 'report')
        ).resolves.toEqual({ ran: true, result: 'report' });
    });

    it('does not run two recoveries on a mint at once', async () => {
        const gate = new MintOperationGate();
        const running = deferred<string>();
        const second = jest.fn(async () => 'second');

        const first = gate.tryRunRecovery(MINT, () => running.promise);
        await expect(gate.tryRunRecovery(MINT, second)).resolves.toEqual({
            ran: false
        });
        expect(second).not.toHaveBeenCalled();

        running.resolve('first');
        await expect(first).resolves.toEqual({ ran: true, result: 'first' });
    });

    it('makes an operation wait for recovery on its mint', async () => {
        const gate = new MintOperationGate();
        const recovery = deferred<string>();
        const melt = jest.fn(async () => 'melted');

        const recovering = gate.tryRunRecovery(MINT, () => recovery.promise);
        const operation = gate.runOperation(MINT, melt);
        await flush();
        expect(melt).not.toHaveBeenCalled();

        recovery.resolve('report');
        await recovering;
        await expect(operation).resolves.toBe('melted');
    });

    it('releases waiting operations when recovery throws', async () => {
        const gate = new MintOperationGate();
        const recovery = deferred<string>();
        const melt = jest.fn(async () => 'melted');

        const recovering = gate.tryRunRecovery(MINT, () => recovery.promise);
        const operation = gate.runOperation(MINT, melt);

        recovery.reject(new Error('database locked'));
        await expect(recovering).rejects.toThrow('database locked');
        await expect(operation).resolves.toBe('melted');

        // And the mint can be recovered again
        await expect(
            gate.tryRunRecovery(MINT, async () => 'retry')
        ).resolves.toEqual({ ran: true, result: 'retry' });
    });

    it('stops waiting for a slow recovery after the cap', async () => {
        jest.useFakeTimers();
        const gate = new MintOperationGate(10000);
        const recovery = deferred<string>();
        const melt = jest.fn(async () => 'melted');

        gate.tryRunRecovery(MINT, () => recovery.promise);
        const operation = gate.runOperation(MINT, melt);

        await jest.advanceTimersByTimeAsync(9999);
        expect(melt).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        await expect(operation).resolves.toBe('melted');
        recovery.resolve('report');
    });

    it('keeps mints apart', async () => {
        const gate = new MintOperationGate();
        const melt = deferred();
        const recoverOther = jest.fn(async () => 'other');

        const operation = gate.runOperation(MINT, () => melt.promise);
        await expect(
            gate.tryRunRecovery('https://other.mint', recoverOther)
        ).resolves.toEqual({ ran: true, result: 'other' });

        melt.resolve();
        await operation;
    });

    it('treats case and trailing slashes as the same mint', async () => {
        const gate = new MintOperationGate();
        const melt = deferred();

        const operation = gate.runOperation(
            'https://Mint.Example/',
            () => melt.promise
        );
        await expect(
            gate.tryRunRecovery(MINT, async () => 'report')
        ).resolves.toEqual({ ran: false });

        melt.resolve();
        await operation;
    });
});
