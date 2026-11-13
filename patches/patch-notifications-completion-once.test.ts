import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

// The patch is plain ESM run by node at postinstall, so drive it through a
// node child process instead of Jest's transform. Each run works on copies of
// the 5.2.2 sources laid out where the patch expects node_modules.

const IOS_DIR = 'node_modules/react-native-notifications/lib/ios';
const MULTICAST = 'RNNotificationCenterMulticast.m';
const STORE = 'RNNotificationsStore.m';
const MARKER = '// ZEUS PATCH: notifications-completion-once';

const fixture = (name: string) =>
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

const ORIGINAL_MULTICAST = fixture('RNNotificationCenterMulticast-5.2.2.m');
const ORIGINAL_STORE = fixture('RNNotificationsStore-5.2.2.m');

const makeTree = (
    multicast: string | null = ORIGINAL_MULTICAST,
    store: string | null = ORIGINAL_STORE
) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notifications-patch-'));
    fs.mkdirSync(path.join(root, IOS_DIR), { recursive: true });
    if (multicast !== null) {
        fs.writeFileSync(path.join(root, IOS_DIR, MULTICAST), multicast);
    }
    if (store !== null) {
        fs.writeFileSync(path.join(root, IOS_DIR, STORE), store);
    }
    return root;
};

const read = (root: string, file: string) =>
    fs.readFileSync(path.join(root, IOS_DIR, file), 'utf8');

const run = (root: string) =>
    execFileSync(
        process.execPath,
        [
            '--input-type=module',
            '-e',
            `const m = await import(${JSON.stringify(
                pathToFileURL(
                    path.join(
                        __dirname,
                        'patch-notifications-completion-once.mjs'
                    )
                ).href
            )}); m.patchNotificationsCompletionOnce();`
        ],
        { cwd: root, encoding: 'utf8', stdio: 'pipe' }
    );

// Body of an Objective-C method, from its signature to the closing brace
const methodBody = (source: string, signature: string) => {
    const start = source.indexOf(signature);
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf('\n}\n', start));
};

const WILL_PRESENT =
    '- (void)userNotificationCenter:(UNUserNotificationCenter *)center willPresentNotification:';
const DID_RECEIVE =
    '- (void)userNotificationCenter:(UNUserNotificationCenter *)center didReceiveNotificationResponse:';

describe('patch-notifications-completion-once', () => {
    const roots: string[] = [];
    const tree = (multicast?: string | null, store?: string | null) => {
        const root = makeTree(multicast, store);
        roots.push(root);
        return root;
    };

    afterAll(() => {
        roots.forEach((root) =>
            fs.rmSync(root, { recursive: true, force: true })
        );
    });

    it('starts from the unpatched 5.2.2 sources', () => {
        // The fixtures must show the bug: the presentation handler is removed
        // only inside the queued block, and the multicast shares one
        // completion that always leaves the group
        const complete = methodBody(
            ORIGINAL_STORE,
            '- (void)completePresentation:'
        );
        expect(complete).toMatch(
            /dispatch_async\([^]*removeObjectForKey:completionKey/
        );
        expect(methodBody(ORIGINAL_MULTICAST, WILL_PRESENT)).toContain(
            'withCompletionHandler:myCompletion]'
        );
    });

    describe('RNNotificationCenterMulticast.m', () => {
        it('gives each delegate a completion that leaves the group once', () => {
            const root = tree();
            run(root);
            const source = read(root, MULTICAST);

            for (const signature of [WILL_PRESENT, DID_RECEIVE]) {
                const body = methodBody(source, signature);
                expect(body).toContain(MARKER);
                expect(body).not.toContain('myCompletion');
                expect(body).toContain(
                    'withCompletionHandler:makeCompletion()]'
                );

                // The guard returns before the leave, and the flag is set under
                // the same lock that checks it
                const guard = body.indexOf('if (called) {');
                const set = body.indexOf('called = YES;');
                const leave = body.indexOf(
                    'dispatch_group_leave(completionGroup);'
                );
                expect(guard).toBeGreaterThan(
                    body.indexOf('@synchronized (completionLock)')
                );
                expect(set).toBeGreaterThan(guard);
                expect(leave).toBeGreaterThan(set);
                expect(
                    body.split('dispatch_group_leave(completionGroup);')
                ).toHaveLength(2);

                // A fresh flag per delegate: declared inside the factory block
                expect(
                    body.indexOf('__block BOOL called = NO;')
                ).toBeGreaterThan(body.indexOf('makeCompletion)(void))'));
            }
        });

        it('reads the combined options under the lock after the wait', () => {
            const root = tree();
            run(root);
            const body = methodBody(read(root, MULTICAST), WILL_PRESENT);

            const wait = body.indexOf('dispatch_group_wait(');
            const snapshot = body.indexOf('presentationOptions = allOptions;');
            expect(snapshot).toBeGreaterThan(wait);
            expect(body).toContain('completionHandler(presentationOptions);');
            expect(body).not.toContain('completionHandler(allOptions);');
        });

        it('leaves openSettingsForNotification untouched', () => {
            const root = tree();
            run(root);
            const signature =
                '- (void)userNotificationCenter:(UNUserNotificationCenter *)center openSettingsForNotification:';
            expect(methodBody(read(root, MULTICAST), signature)).toBe(
                methodBody(ORIGINAL_MULTICAST, signature)
            );
        });
    });

    describe('RNNotificationsStore.m', () => {
        it.each([
            ['- (void)completeAction:', '_actionCompletionHandlers'],
            [
                '- (void)completePresentation:',
                '_presentationCompletionHandlers'
            ],
            [
                '- (void)completeBackgroundAction:',
                '_backgroundActionCompletionHandlers'
            ]
        ])(
            '%s removes the handler before queueing it',
            (signature, dictionary) => {
                const root = tree();
                run(root);
                const body = methodBody(read(root, STORE), signature);

                expect(body).toContain(
                    `[self takeHandlerFrom:${dictionary} forKey:completionKey]`
                );
                expect(body).not.toContain('removeObjectForKey');
                expect(body).not.toContain('valueForKey:');
            }
        );

        it('takes and removes the handler in one locked step', () => {
            const root = tree();
            run(root);
            const body = methodBody(
                read(root, STORE),
                '- (id)takeHandlerFrom:'
            );

            expect(body).toMatch(
                /if \(!completionKey\) \{\s*return nil;\s*\}\s*@synchronized \(self\) \{\s*id completionHandler = handlers\[completionKey\];\s*\[handlers removeObjectForKey:completionKey\];\s*return completionHandler;/
            );
        });

        it.each([
            '- (void)setActionCompletionHandler:',
            '- (void)setPresentationCompletionHandler:',
            '- (void)setBackgroundActionCompletionHandler:',
            '- (void (^)(void))getActionCompletionHandler:',
            '- (void (^)(UNNotificationPresentationOptions))getPresentationCompletionHandler:'
        ])('%s locks the dictionary', (signature) => {
            const root = tree();
            run(root);
            expect(methodBody(read(root, STORE), signature)).toContain(
                '@synchronized (self)'
            );
        });

        it('keeps the singleton and init as shipped', () => {
            const root = tree();
            run(root);
            const source = read(root, STORE);
            for (const signature of [
                '+ (instancetype)sharedInstance',
                '- (instancetype)init'
            ]) {
                expect(methodBody(source, signature)).toBe(
                    methodBody(ORIGINAL_STORE, signature)
                );
            }
        });
    });

    it('is a no-op on already patched sources', () => {
        const root = tree();
        run(root);
        const multicast = read(root, MULTICAST);
        const store = read(root, STORE);

        const output = run(root);
        expect(read(root, MULTICAST)).toBe(multicast);
        expect(read(root, STORE)).toBe(store);
        expect(output).not.toContain('Patched');
    });

    it('throws and writes nothing when the multicast source changed', () => {
        const changed = ORIGINAL_MULTICAST.replace(
            'withCompletionHandler:myCompletion];',
            'withCompletionHandler:otherCompletion];'
        );
        const root = tree(changed);

        expect(() => run(root)).toThrow(
            /expected one "willPresent delegate call"/
        );
        expect(read(root, MULTICAST)).toBe(changed);
    });

    it('throws when the store source changed', () => {
        const changed = ORIGINAL_STORE.replace(
            '[_presentationCompletionHandlers removeObjectForKey:completionKey];',
            '[_presentationCompletionHandlers removeAllObjects];'
        );
        const root = tree(undefined, changed);

        expect(() => run(root)).toThrow(/expected one "handler accessors"/);
        expect(read(root, STORE)).toBe(changed);
    });

    it('throws when a source file is missing', () => {
        const root = tree(undefined, null);
        expect(() => run(root)).toThrow(/RNNotificationsStore\.m not found/);
    });
});
