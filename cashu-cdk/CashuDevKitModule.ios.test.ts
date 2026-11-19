// Lockstep scan of the iOS CDK module (Swift is not exercised by Jest).
//
// The wallet database handed to WalletRepository must be the Rust-backed
// WalletDatabaseImpl from createWalletDb. A Swift-constructed
// WalletSqliteDatabase is passed to Rust as a foreign callback object, so
// Rust can drop the last reference from a tokio thread (CDK 0.18's rate
// limiter writer does on wallet switch). That runs the Swift deinit there,
// and freeing the database's owned tokio runtime inside an async context
// panics into the deinit's try!, crashing the app.

import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
    path.join(__dirname, '../ios/CashuDevKit/CashuDevKitModule.swift'),
    'utf8'
);

describe('iOS CashuDevKitModule wallet database handle', () => {
    it('opens the database through createWalletDb', () => {
        const body = source.slice(source.indexOf('func initializeWallet'));
        const create = body.indexOf(
            'createWalletDb(backend: .sqlite(path: dbPath))'
        );
        expect(create).toBeGreaterThan(-1);
        expect(create).toBeLessThan(body.indexOf('WalletRepository('));
        expect(body.indexOf('store: .custom(db: sqliteDb)')).toBeGreaterThan(
            create
        );
    });

    it('never constructs a WalletSqliteDatabase in Swift', () => {
        expect(source).not.toMatch(/WalletSqliteDatabase\s*\(/);
    });

    it('types every stored or borrowed handle as WalletDatabase', () => {
        expect(source).toContain('private var db: WalletDatabase?');
        expect(source).not.toMatch(/:\s*WalletSqliteDatabase\??\s*[=\n{]/);
        expect(source).not.toMatch(/,\s*WalletSqliteDatabase\)/);
    });
});
