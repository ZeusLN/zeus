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

    it('advances the generation in stop() before the null-node early return', () => {
        expect(
            stop.indexOf('self.advanceBuildGeneration()')
        ).toBeGreaterThanOrEqual(0);
        expect(stop.indexOf('self.advanceBuildGeneration()')).toBeLessThan(
            stop.indexOf('guard let node = self.takeNode()')
        );
    });

    it('publishes the built node only through publishNode', () => {
        expect(buildNode).toContain(
            'let generation = self.advanceBuildGeneration()'
        );
        expect(buildNode).not.toContain('self.setNode(');
        expect(buildNode).toContain(
            'self.publishNode(newNode, generation: generation)'
        );
        expect(buildNode).toContain('if builtNode == nil');
        const publishNode = between(
            source,
            'private func publishNode(',
            'private func rejectSupersededBuild('
        );
        expect(publishNode).toContain(
            'guard generation == buildGeneration else { return false }'
        );
    });

    it('reads restore settings before waiting on VSS', () => {
        const afterWait = buildNode.slice(buildNode.indexOf('semaphore.wait('));
        expect(afterWait).not.toContain('storedVssFailOnError');
        expect(afterWait).not.toContain('storedStorageDirPath');
    });
});

// Compiles the iOS build/stop code out of LdkNodeModule.swift against fake
// LDK Node types and runs the stop-during-VSS race. Needs swiftc and the
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

// argv[1]: "stop" to call stop() while the dual-store build is blocked
let stopDuringBuild = CommandLine.arguments.count > 1 && CommandLine.arguments[1] == "stop"
let vssEntered = DispatchSemaphore(value: 0)
let vssRelease = DispatchSemaphore(value: 0)
let builtNodes = NSMutableArray()

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
        let node = Node()
        builtNodes.add(node)
        return node
    }
}

${module}

    func errorMessage(_ error: Error) -> String { "\\(error)" }
}

extension LdkNodeModule {
    func configureForTest() {
        builder = Builder()
        storedStorageDirPath = NSTemporaryDirectory()
        storedVssUrl = "https://vss.invalid"
        storedVssStoreId = "store"
        storedVssBuildTimeout = 30
    }
    var hasNode: Bool { getNode() != nil }
}

let module = LdkNodeModule()
module.configureForTest()
let settled = DispatchSemaphore(value: 0)
var outcome = "pending"
module.buildNode("mnemonic", passphrase: nil, resolver: { _ in
    outcome = "resolved"
    settled.signal()
}, rejecter: { code, _, _ in
    outcome = "rejected:\\(code ?? "")"
    settled.signal()
})
guard vssEntered.wait(timeout: .now() + 5) == .success else {
    print("{\\"error\\":\\"build never reached VSS\\"}")
    exit(1)
}
if stopDuringBuild {
    let stopped = DispatchSemaphore(value: 0)
    module.stop({ _ in stopped.signal() }, rejecter: { _, _, _ in stopped.signal() })
    _ = stopped.wait(timeout: .now() + 5)
}
vssRelease.signal()
_ = settled.wait(timeout: .now() + 5)
let stale = builtNodes.firstObject as? Node
let report: [String: Any] = [
    "outcome": outcome,
    "published": module.hasNode,
    "builtNodeStopped": (stale?.stopCalls ?? 0) > 0
]
let json = try! JSONSerialization.data(withJSONObject: report, options: [.sortedKeys])
print(String(data: json, encoding: .utf8)!)
`;

(hasSwiftc ? describe : describe.skip)(
    'iOS LdkNodeModule stop during a VSS build (compiled, macOS only)',
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
    }
);
