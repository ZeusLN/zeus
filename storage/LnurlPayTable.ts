import type { DB } from '@op-engineering/op-sqlite';

/**
 * Rows behind LnurlPayStore: one per LNURL payment, plus the LNURL metadata
 * shared by payments with the same description hash. Before #4471 these
 * were two keychain entries per payment ('lnurlpay:<hash>'), which nothing
 * could enumerate or clear.
 */

export interface LnurlPayTxRow {
    paymentHash: string;
    domain: string;
    lnurl: string;
    metadata_hash: string;
    successAction: any;
    time: number;
}

export interface LnurlPayMetadataRow {
    metadata: string;
    last_stored: number;
}

const toTx = (row: any): LnurlPayTxRow => ({
    paymentHash: row.payment_hash,
    domain: row.domain,
    lnurl: row.lnurl,
    metadata_hash: row.metadata_hash,
    successAction:
        row.success_action == null
            ? row.success_action
            : JSON.parse(row.success_action),
    time: row.time
});

const TX_UPSERT = `INSERT OR REPLACE INTO lnurlpay_tx
    (payment_hash, domain, lnurl, metadata_hash, success_action, time)
    VALUES (?, ?, ?, ?, ?, ?)`;
const TX_INSERT_IF_ABSENT = TX_UPSERT.replace('OR REPLACE', 'OR IGNORE');
const METADATA_UPSERT = `INSERT OR REPLACE INTO lnurlpay_metadata
    (metadata_hash, metadata, last_stored) VALUES (?, ?, ?)`;
const METADATA_INSERT_IF_ABSENT = METADATA_UPSERT.replace(
    'OR REPLACE',
    'OR IGNORE'
);

const txParams = (tx: LnurlPayTxRow) => [
    tx.paymentHash,
    tx.domain ?? null,
    tx.lnurl ?? null,
    tx.metadata_hash ?? null,
    tx.successAction === undefined ? null : JSON.stringify(tx.successAction),
    tx.time ?? null
];

/** Write a payment and, when it has one, its metadata in one transaction. */
export const putLnurlPay = async (
    db: DB,
    tx: LnurlPayTxRow,
    metadataHash?: string,
    metadata?: LnurlPayMetadataRow
): Promise<void> => {
    await db.transaction(async (t) => {
        await t.execute(TX_UPSERT, txParams(tx));
        if (metadataHash && metadata) {
            await t.execute(METADATA_UPSERT, [
                metadataHash,
                metadata.metadata,
                metadata.last_stored
            ]);
        }
    });
};

/**
 * Copy rows read from the keychain. Never overwrites: a row already in the
 * database is newer than any keychain copy, which stops being written once
 * the database is in use.
 */
export const copyLnurlPayIfAbsent = async (
    db: DB,
    tx?: LnurlPayTxRow,
    metadataHash?: string,
    metadata?: LnurlPayMetadataRow
): Promise<void> => {
    await db.transaction(async (t) => {
        if (tx?.paymentHash) {
            await t.execute(TX_INSERT_IF_ABSENT, txParams(tx));
        }
        if (metadataHash && metadata) {
            await t.execute(METADATA_INSERT_IF_ABSENT, [
                metadataHash,
                metadata.metadata,
                metadata.last_stored
            ]);
        }
    });
};

export const getLnurlPayTx = async (
    db: DB,
    paymentHash: string
): Promise<LnurlPayTxRow | undefined> => {
    const result = await db.execute(
        'SELECT * FROM lnurlpay_tx WHERE payment_hash = ?',
        [paymentHash]
    );
    const row = result.rows?.[0];
    return row ? toTx(row) : undefined;
};

export const getLnurlPayMetadata = async (
    db: DB,
    metadataHash: string
): Promise<LnurlPayMetadataRow | undefined> => {
    const result = await db.execute(
        'SELECT metadata, last_stored FROM lnurlpay_metadata WHERE metadata_hash = ?',
        [metadataHash]
    );
    const row: any = result.rows?.[0];
    return row
        ? { metadata: row.metadata, last_stored: row.last_stored }
        : undefined;
};
