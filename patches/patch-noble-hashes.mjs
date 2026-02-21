// Fix @noble/hashes package exports for Metro/React Native.
// Dependencies import @noble/hashes/crypto.js but the package only exports ./crypto.
// Add ./crypto.js to exports so it resolves correctly per Node.js package exports spec.

import fs from 'fs';
import path from 'path';

const CRYPTO_EXPORT = {
    node: {
        import: './esm/cryptoNode.js',
        default: './cryptoNode.js'
    },
    import: './esm/crypto.js',
    default: './crypto.js'
};

export function patchNobleHashes() {
    console.log('Patching @noble/hashes (add ./crypto.js to exports)');

    const nodeModules = './node_modules';
    const nobleHashesPaths = [...new Set(findNobleHashesPaths(nodeModules))];

    for (const pkgPath of nobleHashesPaths) {
        const packageJsonPath = path.join(pkgPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) continue;

        try {
            const content = fs.readFileSync(packageJsonPath, 'utf8');
            const pkg = JSON.parse(content);

            if (!pkg.exports || typeof pkg.exports !== 'object') continue;
            if (pkg.exports['./crypto.js']) continue;

            pkg.exports['./crypto.js'] = CRYPTO_EXPORT;
            fs.writeFileSync(
                packageJsonPath,
                JSON.stringify(pkg, null, 2),
                'utf8'
            );
            console.log(`  - Patched ${path.relative(nodeModules, pkgPath)}`);
        } catch (err) {
            console.warn(`  - Skip ${pkgPath}: ${err.message}`);
        }
    }
}

function findNobleHashesPaths(dir, results = [], depth = 0) {
    if (!fs.existsSync(dir) || depth > 15) return results;

    const nobleHashes = path.join(dir, '@noble', 'hashes');
    if (fs.existsSync(nobleHashes)) {
        results.push(nobleHashes);
    }

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                findNobleHashesPaths(
                    path.join(dir, entry.name),
                    results,
                    depth + 1
                );
            }
        }
    } catch (err) {
        console.warn(` - Failed to read directory ${dir}: ${err.message}`);
    }

    return results;
}
