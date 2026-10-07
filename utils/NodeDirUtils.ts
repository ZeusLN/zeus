// Node data directories (lndDir, ldkNodeDir) are single path segments that
// ZEUS generates itself: a uuidv4, or the legacy 'lnd' default. They are
// joined onto app-private base paths and handed to recursive deletes, so a
// stored value containing '/' or '..' could point those deletes at another
// wallet's data or at the rest of the app's storage. Accept only the
// characters ZEUS ever generates.
const NODE_DIR_PATTERN = /^[A-Za-z0-9_-]+$/;

export const isValidNodeDir = (nodeDir: unknown): nodeDir is string =>
    typeof nodeDir === 'string' && NODE_DIR_PATTERN.test(nodeDir);

export function assertValidNodeDir(
    nodeDir: unknown
): asserts nodeDir is string {
    if (!isValidNodeDir(nodeDir)) {
        throw new Error(`Invalid node directory: ${JSON.stringify(nodeDir)}`);
    }
}
