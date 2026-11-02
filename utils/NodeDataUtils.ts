// Two configs can point at the same on-device wallet data: keychain recovery
// restore appends the configs it finds without checking for ones already
// present, and imports before on-device configs were blocked could carry any
// lndDir / ldkNodeDir (or none, which resolves to the legacy 'lnd'). Deleting
// one such config must not wipe the data the other still uses.

// Keychain namespace of a node's Cashu data (seed, mint list, proofs), which
// also names its CDK database through the seed. Mirrors
// CashuStore.getNodeDir, including its defaults for configs that predate
// explicit node dirs. Cashu only runs on embedded-lnd and ldk-node, and both
// share one namespace space, so an LND and an LDK Node wallet with the same
// dir name share Cashu data.
export const getCashuNamespace = (node: any): string | undefined => {
    if (node?.implementation === 'embedded-lnd') return node.lndDir || 'lnd';
    if (node?.implementation === 'ldk-node') return node.ldkNodeDir || 'ldk';
    return undefined;
};

// On-disk data directory of an on-device node, keyed with its implementation
// because LND and LDK Node directories live under different roots. Mirrors
// deleteNodeDataDirectory: an ldk-node config without ldkNodeDir has no
// directory to delete.
export const getNodeDataDir = (node: any): string | undefined => {
    if (node?.implementation === 'embedded-lnd') {
        return `embedded-lnd:${node.lndDir || 'lnd'}`;
    }
    if (node?.implementation === 'ldk-node' && node.ldkNodeDir) {
        return `ldk-node:${node.ldkNodeDir}`;
    }
    return undefined;
};

// Whether the node at index shares its Cashu data or its data directory with
// another config in nodes.
export const getSharedNodeData = (
    nodes: any[],
    index: number
): { cashu: boolean; dataDir: boolean } => {
    const node = nodes[index];
    const others = nodes.filter((_, i) => i !== index);
    const cashu = getCashuNamespace(node);
    const dataDir = getNodeDataDir(node);
    return {
        cashu: !!cashu && others.some((n) => getCashuNamespace(n) === cashu),
        dataDir: !!dataDir && others.some((n) => getNodeDataDir(n) === dataDir)
    };
};

// Drops on-device configs whose Cashu data or data directory is already used
// by a config in existing, or by an earlier config in incoming. Remote
// configs are kept as they are: they own no on-device data.
export const dropNodesWithTakenData = (
    incoming: any[],
    existing: any[]
): any[] => {
    const cashuTaken = new Set(existing.map(getCashuNamespace));
    const dataDirTaken = new Set(existing.map(getNodeDataDir));
    return incoming.filter((node) => {
        const cashu = getCashuNamespace(node);
        const dataDir = getNodeDataDir(node);
        if (
            (cashu && cashuTaken.has(cashu)) ||
            (dataDir && dataDirTaken.has(dataDir))
        ) {
            return false;
        }
        cashuTaken.add(cashu);
        dataDirTaken.add(dataDir);
        return true;
    });
};
