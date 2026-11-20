import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// stop() resolves at once when no node is published yet, which is the case
// while buildNode is waiting on VSS. The native modules must not let that
// build publish the stopped wallet's node once VSS answers: stop() and every
// buildNode() advance a build generation, and a build publishes only if its
// generation is still current.

const read = (file: string) =>
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const between = (source: string, start: string, end: string) => {
    const from = source.indexOf(start);
    expect(from).toBeGreaterThanOrEqual(0);
    const to = source.indexOf(end, from + start.length);
    expect(to).toBeGreaterThan(from);
    return source.slice(from, to);
};

// Kotlin has no compiler or JVM test harness in this repo, so this part is a
// source scan of the publication path in LdkNodeModule.kt.
describe('Android LdkNodeModule build generation (source scan)', () => {
    const source = read(
        'android/app/src/main/java/app/zeusln/zeus/LdkNodeModule.kt'
    );
    const buildNode = between(
        source,
        'fun buildNode(',
        'private fun applyBuilderSettings('
    );
    const stop = between(
        source,
        'fun stop(promise: Promise)',
        'fun syncWallets('
    );

    it('advances the generation in stop() before the null-node early return', () => {
        const advance = stop.indexOf('this@LdkNodeModule.buildGeneration++');
        expect(advance).toBeGreaterThan(stop.indexOf('synchronized(nodeLock)'));
        expect(advance).toBeLessThan(stop.indexOf('if (node == null)'));
    });

    it('captures a new generation when buildNode() starts', () => {
        const start = buildNode.indexOf(
            'val generation = synchronized(nodeLock)'
        );
        expect(start).toBeGreaterThanOrEqual(0);
        expect(
            buildNode.indexOf('++this@LdkNodeModule.buildGeneration')
        ).toBeGreaterThan(start);
        expect(
            buildNode.indexOf('++this@LdkNodeModule.buildGeneration')
        ).toBeLessThan(buildNode.indexOf('moduleScope.launch'));
    });

    it('publishes the built node only under a current-generation check', () => {
        const assignments = buildNode.match(
            /this@LdkNodeModule\.node = [^\n]+/g
        );
        expect(assignments).toEqual([
            'this@LdkNodeModule.node = null',
            'this@LdkNodeModule.node = builtNode'
        ]);
        const publish = between(
            buildNode,
            'val published = synchronized(nodeLock)',
            'if (!published)'
        );
        expect(
            publish.indexOf('generation == this@LdkNodeModule.buildGeneration')
        ).toBeLessThan(publish.indexOf('this@LdkNodeModule.node = builtNode'));
        expect(buildNode).toContain(
            'rejectSupersededBuild(builtNode, promise)'
        );
    });

    // stop() and the next buildNode() take nodeLock, so a local build that
    // holds it cannot overlap them on the same storage dir
    it('runs the local fallback build under nodeLock after the generation check', () => {
        const publish = between(
            buildNode,
            'val published = synchronized(nodeLock)',
            'if (!published)'
        );
        const check = publish.indexOf(
            'generation == this@LdkNodeModule.buildGeneration'
        );
        const build = publish.indexOf(
            'builtNode = localBuilder.build(nodeEntropy)'
        );
        expect(check).toBeGreaterThanOrEqual(0);
        expect(build).toBeGreaterThan(check);
        expect(build).toBeLessThan(
            publish.indexOf('this@LdkNodeModule.node = builtNode')
        );
        expect(buildNode.match(/localBuilder\.build\(/g)).toHaveLength(1);
    });

    it('decides the local fallback on its own build, not the shared node', () => {
        expect(buildNode).toContain('if (builtNode == null)');
        expect(buildNode).not.toContain('if (this@LdkNodeModule.node == null)');
    });

    it('reads restore settings before waiting on VSS', () => {
        const afterWait = buildNode.slice(buildNode.indexOf('latch.await('));
        expect(afterWait).not.toContain('storedVssFailOnError');
        expect(afterWait).not.toContain('storedStorageDirPath');
    });
});

describe('iOS LdkNodeModule build generation (source scan)', () => {
    const source = read('ios/LdkNodeMobile/LdkNodeModule.swift');
    const buildNode = between(
        source,
        'func buildNode(',
        'private func applyBuilderSettings('
    );
    const stop = between(source, 'func stop(_ resolve', 'func syncWallets(');

    it('takes the node and advances the generation in one critical section', () => {
        const helper = between(
            source,
            'private func takeNodeAndAdvanceGeneration()',
            'private func isCurrentBuild('
        );
        expect(helper).toContain('node = nil');
        expect(helper).toContain('buildGeneration &+= 1');
        expect(helper.match(/nodeLock\.lock\(\)/g)).toHaveLength(1);
        expect(stop).toContain(
            'guard let node = self.takeNodeAndAdvanceGeneration().node'
        );
        expect(buildNode).toContain(
            'let (existing, generation) = self.takeNodeAndAdvanceGeneration()'
        );
        expect(stop).not.toContain('self.takeNode()');
        expect(buildNode).not.toContain('self.takeNode()');
    });

    it('publishes and runs the local fallback build only through publishNode', () => {
        expect(buildNode).not.toContain('self.setNode(');
        const publish = buildNode.indexOf(
            'try self.publishNode(builtNode, generation: generation)'
        );
        const build = buildNode.indexOf('localBuilder.build(');
        expect(publish).toBeGreaterThanOrEqual(0);
        expect(build).toBeGreaterThan(publish);
        expect(build).toBeLessThan(buildNode.indexOf('guard published != nil'));
        const publishNode = between(
            source,
            'private func publishNode(',
            'private func rejectSupersededBuild('
        );
        const check = publishNode.indexOf(
            'guard generation == buildGeneration else { return nil }'
        );
        expect(check).toBeGreaterThanOrEqual(0);
        expect(publishNode.indexOf('guard node == nil else')).toBeGreaterThan(
            check
        );
        expect(publishNode.indexOf('buildLocal()')).toBeGreaterThan(check);
    });

    it('reads restore settings before waiting on VSS', () => {
        const afterWait = buildNode.slice(buildNode.indexOf('semaphore.wait('));
        expect(afterWait).not.toContain('storedVssFailOnError');
        expect(afterWait).not.toContain('storedStorageDirPath');
    });
});

// Compiles the iOS build/stop code out of LdkNodeModule.swift against fake
// LDK Node types and runs the build/stop races. Needs swiftc and the
// macOS SDK, so it is skipped on the Linux CI runners.
const hasSwiftc = (() => {
    if (process.platform !== 'darwin') return false;
    try {
        execFileSync('xcrun', ['--find', 'swiftc'], { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
})();

const extractSwift = () => {
    const source = read('ios/LdkNodeMobile/LdkNodeModule.swift');
    return [
        between(
            source,
            'class LdkNodeModule: RCTEventEmitter {',
            '    @objc\n    override static func moduleName()'
        ),
        between(
            source,
            '    /// Thread-safe read of the current Node reference.',
            '    private func resetStoredConfig()'
        ),
        between(
            source,
            '    @objc(buildNode:passphrase:resolver:rejecter:)',
            '    @objc(syncWallets:rejecter:)'
        )
    ].join('\n');
};

const SWIFT_HARNESS = (module: string) => `import Foundation

typealias RCTPromiseResolveBlock = @convention(block) (Any?) -> Void
typealias RCTPromiseRejectBlock = @convention(block) (String?, String?, Error?) -> Void
class RCTEventEmitter: NSObject {}
class LogFileObserver { func stopObserving() {} }
typealias PublicKey = String
typealias SocketAddress = String
enum Network { case bitcoin }
enum LogLevel { case info }
struct AnchorChannelsConfig {
    var trustedPeersNoReserve: [PublicKey]
    var perChannelReserveSats: UInt64
}
struct Config {
    var storageDirPath: String
    var network: Network
    var listeningAddresses: [SocketAddress]?
    var announcementAddresses: [SocketAddress]?
    var nodeAlias: String?
    var trustedPeers0conf: [PublicKey]
    var probingLiquidityLimitMultiplier: UInt64
    var anchorChannelsConfig: AnchorChannelsConfig?
    var routeParameters: String?
}
struct BackgroundSyncConfig {
    var onchainWalletSyncIntervalSecs: UInt64
    var lightningWalletSyncIntervalSecs: UInt64
    var feeRateCacheUpdateIntervalSecs: UInt64
}
struct EsploraSyncConfig { var backgroundSyncConfig: BackgroundSyncConfig? }
struct NodeEntropy {
    static func fromBip39Mnemonic(mnemonic: String, passphrase: String?) -> NodeEntropy { NodeEntropy() }
}
struct NotRunning: Error {}

let vssEntered = DispatchSemaphore(value: 0)
let vssRelease = DispatchSemaphore(value: 0)
var blockLocalBuild = false
let localEntered = DispatchSemaphore(value: 0)
let localRelease = DispatchSemaphore(value: 0)
let builtNodes = NSMutableArray()

// Shadows Foundation's NSLock for the module code, so a scenario can run
// code right after its own thread releases nodeLock
let hookLock = Foundation.NSLock()
var afterUnlock: (() -> Void)?
var hookThread: Thread?
final class NSLock {
    private let inner = Foundation.NSLock()
    func lock() { inner.lock() }
    func unlock() {
        inner.unlock()
        hookLock.lock()
        var hook: (() -> Void)? = nil
        if Thread.current == hookThread {
            hook = afterUnlock
            afterUnlock = nil
        }
        hookLock.unlock()
        hook?()
    }
}

final class Node: NSObject {
    var started = false
    var stopCalls = 0
    func start() throws { started = true }
    func stop() throws {
        stopCalls += 1
        if !started { throw NotRunning() }
        started = false
    }
}

final class Builder {
    static func fromConfig(config: Config) -> Builder { Builder() }
    func setChainSourceEsplora(serverUrl: String, config: EsploraSyncConfig?) {}
    func setGossipSourceRgs(rgsServerUrl: String) {}
    func setPathfindingScoresSource(url: String) {}
    func setLiquiditySourceLsps1(nodeId: PublicKey, address: SocketAddress, token: String?) {}
    func setLiquiditySourceLsps2(nodeId: PublicKey, address: SocketAddress, token: String?) {}
    func setLiquiditySourceLsps7(nodeId: PublicKey, address: SocketAddress, token: String?) {}
    func setFilesystemLogger(logFilePath: String, maxLogLevel: LogLevel) {}
    func buildWithDualStoreAndFixedHeaders(nodeEntropy: NodeEntropy, vssUrl: String, storeId: String, fixedHeaders: [String: String]) throws -> Node {
        vssEntered.signal()
        vssRelease.wait()
        let node = Node()
        builtNodes.add(node)
        return node
    }
    func build(nodeEntropy: NodeEntropy) throws -> Node {
        if blockLocalBuild {
            localEntered.signal()
            localRelease.wait()
        }
        let node = Node()
        builtNodes.add(node)
        return node
    }
}

${module}

    func errorMessage(_ error: Error) -> String { "\\(error)" }
}

extension LdkNodeModule {
    func configureForTest(vss: Bool) {
        builder = Builder()
        storedStorageDirPath = NSTemporaryDirectory()
        storedVssUrl = vss ? "https://vss.invalid" : nil
        storedVssStoreId = vss ? "store" : nil
        storedVssBuildTimeout = 30
    }
    var currentNode: Node? { getNode() }
}

final class BuildCall {
    let settled = DispatchSemaphore(value: 0)
    var outcome = "pending"
    init(_ module: LdkNodeModule) {
        module.buildNode("mnemonic", passphrase: nil, resolver: { _ in
            self.outcome = "resolved"
            self.settled.signal()
        }, rejecter: { code, _, _ in
            self.outcome = "rejected:\\(code ?? "")"
            self.settled.signal()
        })
    }
}

func waitOrFail(_ semaphore: DispatchSemaphore, _ what: String) {
    if semaphore.wait(timeout: .now() + 5) == .timedOut {
        print("{\\"error\\":\\"timed out waiting for \\(what)\\"}")
        exit(1)
    }
}

func node(_ index: Int) -> Node? {
    index < builtNodes.count ? builtNodes[index] as? Node : nil
}

// argv[1]:
//   (none)      dual-store build, nothing interferes
//   stop        stop() while the dual-store build waits on VSS
//   overlap     an older build finishes while a newer buildNode() is
//               taking the old node, right after it releases nodeLock
//   local-stop  stop() while a local-only build is running
func scenario(_ mode: String) -> [String: Any] {
    let module = LdkNodeModule()
    if mode == "local-stop" {
        module.configureForTest(vss: false)
        blockLocalBuild = true
        let a = BuildCall(module)
        waitOrFail(localEntered, "local build")
        let stopped = DispatchSemaphore(value: 0)
        DispatchQueue.global().async {
            module.stop({ _ in stopped.signal() }, rejecter: { _, _, _ in stopped.signal() })
        }
        let stopReturnedEarly = stopped.wait(timeout: .now() + 0.3) == .success
        localRelease.signal()
        waitOrFail(a.settled, "build")
        if !stopReturnedEarly { waitOrFail(stopped, "stop") }
        return [
            "stopReturnedDuringBuild": stopReturnedEarly,
            "outcome": a.outcome,
            "published": module.currentNode != nil,
            "builtNodeStopped": (node(0)?.stopCalls ?? 0) > 0
        ]
    }

    module.configureForTest(vss: true)
    let a = BuildCall(module)
    waitOrFail(vssEntered, "first build to reach VSS")
    if mode == "overlap" {
        hookLock.lock()
        hookThread = Thread.current
        afterUnlock = {
            vssRelease.signal()
            waitOrFail(a.settled, "first build")
        }
        hookLock.unlock()
        let b = BuildCall(module)
        waitOrFail(vssEntered, "second build to reach VSS")
        vssRelease.signal()
        waitOrFail(b.settled, "second build")
        return [
            "first": a.outcome,
            "firstNodeStopped": (node(0)?.stopCalls ?? 0) > 0,
            "second": b.outcome,
            "publishedIsSecond": module.currentNode != nil && module.currentNode === node(1)
        ]
    }
    if mode == "stop" {
        let stopped = DispatchSemaphore(value: 0)
        module.stop({ _ in stopped.signal() }, rejecter: { _, _, _ in stopped.signal() })
        waitOrFail(stopped, "stop")
    }
    vssRelease.signal()
    waitOrFail(a.settled, "build")
    return [
        "outcome": a.outcome,
        "published": module.currentNode != nil,
        "builtNodeStopped": (node(0)?.stopCalls ?? 0) > 0
    ]
}

// stop() resolves on the main queue once it has stopped a published node,
// so the scenario runs off the main thread
let mode = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
DispatchQueue.global().async {
    let report = scenario(mode)
    let json = try! JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
    print(String(data: json, encoding: .utf8)!)
    exit(0)
}
dispatchMain()
`;

(hasSwiftc ? describe : describe.skip)(
    'iOS LdkNodeModule build and stop races (compiled, macOS only)',
    () => {
        let dir: string;
        let binary: string;

        beforeAll(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ldk-build-gen-'));
            const source = path.join(dir, 'harness.swift');
            binary = path.join(dir, 'harness');
            fs.writeFileSync(source, SWIFT_HARNESS(extractSwift()));
            execFileSync('xcrun', ['swiftc', source, '-o', binary], {
                stdio: 'pipe'
            });
        }, 120000);

        afterAll(() => {
            if (dir) fs.rmSync(dir, { recursive: true, force: true });
        });

        const run = (...args: string[]) =>
            JSON.parse(
                execFileSync(binary, args, {
                    encoding: 'utf8',
                    // NSLog output from the module goes to stderr
                    stdio: ['ignore', 'pipe', 'pipe']
                })
            );

        it('publishes the node when nothing stops the build', () => {
            expect(run()).toEqual({
                outcome: 'resolved',
                published: true,
                builtNodeStopped: false
            });
        });

        it('discards the node of a build that stop() overtook', () => {
            expect(run('stop')).toEqual({
                outcome: 'rejected:build_cancelled',
                published: false,
                builtNodeStopped: true
            });
        });

        it('does not let an older build publish while a newer one takes the node', () => {
            expect(run('overlap')).toEqual({
                first: 'rejected:build_cancelled',
                firstNodeStopped: true,
                second: 'resolved',
                publishedIsSecond: true
            });
        });

        it('makes stop() wait for a local build instead of overlapping it', () => {
            expect(run('local-stop')).toEqual({
                stopReturnedDuringBuild: false,
                outcome: 'resolved',
                published: false,
                builtNodeStopped: true
            });
        });
    }
);
