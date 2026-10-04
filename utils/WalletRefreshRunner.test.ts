import WalletRefreshRunner from './WalletRefreshRunner';

// A refresh the test resolves by hand, so it can act while one is in flight.
const deferredRefresh = () => {
    let resolve: () => void = () => {};
    let reject: (error: Error) => void = () => {};
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { fn: jest.fn(() => promise), resolve, reject };
};

describe('WalletRefreshRunner', () => {
    let settingsStore: { triggerSettingsRefresh: boolean };
    let focused: boolean;
    let followUp: jest.Mock;
    let runner: WalletRefreshRunner;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        settingsStore = { triggerSettingsRefresh: true };
        focused = true;
        followUp = jest.fn().mockResolvedValue(undefined);
        runner = new WalletRefreshRunner(
            settingsStore,
            () => focused,
            followUp
        );
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('clears the flag when the refresh starts', async () => {
        const refresh = jest.fn().mockResolvedValue(undefined);

        await runner.run(refresh);

        expect(refresh).toHaveBeenCalledTimes(1);
        expect(settingsStore.triggerSettingsRefresh).toEqual(false);
        expect(followUp).not.toHaveBeenCalled();
    });

    it('does not start a second refresh while one is in flight', async () => {
        const first = deferredRefresh();
        const second = jest.fn().mockResolvedValue(undefined);

        const running = runner.run(first.fn);
        expect(runner.running).toEqual(true);
        expect(runner.run(second)).toBeUndefined();
        first.resolve();
        await running;

        expect(second).not.toHaveBeenCalled();
        expect(runner.running).toEqual(false);
    });

    it('refreshes again when the settings change during the refresh', async () => {
        const refresh = deferredRefresh();

        const running = runner.run(refresh.fn);
        settingsStore.triggerSettingsRefresh = true;
        refresh.resolve();
        await running;

        // The follow-up refresh carries no one-off arguments of the first
        expect(followUp).toHaveBeenCalledTimes(1);
        expect(settingsStore.triggerSettingsRefresh).toEqual(false);
        expect(runner.running).toEqual(false);
    });

    it('leaves the flag for the next focus when the Wallet is not focused', async () => {
        const refresh = deferredRefresh();

        const running = runner.run(refresh.fn);
        settingsStore.triggerSettingsRefresh = true;
        focused = false;
        refresh.resolve();
        await running;

        expect(followUp).not.toHaveBeenCalled();
        expect(settingsStore.triggerSettingsRefresh).toEqual(true);
    });

    it('refreshes again at most once', async () => {
        // A write that changes on every refresh must not turn into a
        // refresh loop; the flag stays armed for the next focus instead.
        const refresh = deferredRefresh();
        followUp.mockImplementation(async () => {
            settingsStore.triggerSettingsRefresh = true;
        });

        const running = runner.run(refresh.fn);
        settingsStore.triggerSettingsRefresh = true;
        refresh.resolve();
        await running;

        expect(followUp).toHaveBeenCalledTimes(1);
        expect(settingsStore.triggerSettingsRefresh).toEqual(true);
        expect(runner.running).toEqual(false);
    });

    it('allows a new refresh after a rejected one', async () => {
        const failing = deferredRefresh();

        const running = runner.run(failing.fn);
        failing.reject(new Error('boom'));
        await expect(running).rejects.toThrow('boom');

        expect(runner.running).toEqual(false);
        const next = jest.fn().mockResolvedValue(undefined);
        await runner.run(next);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
