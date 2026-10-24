/**
 * Test helper: an object with the parts of op-sqlite's DB interface that
 * storage/ uses (execute, transaction, close), backed by Node's built-in
 * SQLite. Lets the table code and LnurlPayStore run real SQL in Jest.
 */
export const makeNodeSqliteDb = (): any => {
    const { DatabaseSync } = require('node:sqlite');
    const sqlite = new DatabaseSync(':memory:');
    let closed = false;

    const execute = async (sql: string, params: any[] = []) => {
        if (closed) throw new Error('database is closed');
        const rows = sqlite
            .prepare(sql)
            .all(...params)
            .map((row: any) => ({ ...row }));
        return { rows };
    };

    return {
        execute,
        transaction: async (fn: (tx: { execute: typeof execute }) => any) => {
            sqlite.exec('BEGIN');
            try {
                await fn({ execute });
                sqlite.exec('COMMIT');
            } catch (e) {
                sqlite.exec('ROLLBACK');
                throw e;
            }
        },
        close: () => {
            closed = true;
            sqlite.close();
        }
    };
};
