/* eslint-disable */
import type { OutPoint } from '../tapcommon';

/**
 * Represents the Merkle proof hashes needed to link a transaction to the Merkle
 * root within a Bitcoin block header.
 */
export interface MerkleProof {
    /**
     * List of sibling hashes in the Merkle path, ordered from the transaction's
     * sibling up towards the root. Each hash is typically 32 bytes.
     */
    siblingHashes: Uint8Array | string[];
    /**
     * The bitmask indicating the direction (left/right) of each sibling hash
     * in the Merkle tree. Each bit corresponds to a sibling hash in the
     * sibling_hashes list. 0 indicates left, 1 indicates right.
     */
    bits: boolean[];
}

/**
 * Encapsulates the full proof required for sender authentication, demonstrating
 * that a specific P2TR transaction output was included in a Bitcoin block. To
 * prove knowledge of the claimed output, the proof must include the output's
 * internal key and, optionally, the Taproot Merkle root.
 */
export interface BitcoinMerkleInclusionProof {
    /**
     * The raw Bitcoin transaction bytes, in standard Bitcoin serialization
     * format, containing the outpoint being claimed. The server will hash this
     * to get the TXID.
     */
    rawTxData: Uint8Array | string;
    /**
     * The raw block header bytes (typically 80 bytes) of the block in which the
     * transaction was mined. Contains the Merkle root against which the proof
     * is verified.
     */
    rawBlockHeaderData: Uint8Array | string;
    /**
     * The height at which the block was mined. This is used to determine the
     * block's validity and to ensure the transaction is not too old.
     */
    blockHeight: number;
    /**
     * The Merkle path proving the transaction's inclusion in the block header's
     * Merkle root.
     */
    merkleProof: MerkleProof | undefined;
    /**
     * The specific output within the provided transaction being claimed as the
     * proof "token". The output at the given index must be a P2TR output.
     * The server must verify that the txid_hex matches the hash of the provided
     * transaction data, and that this specific outpoint index exists in the
     * transaction.
     */
    claimedOutpoint: OutPoint | undefined;
    /**
     * The Taproot internal key used to construct the P2TR output that is
     * claimed by the outpoint above. Must be provided alongside the Taproot
     * Merkle root to prove knowledge of the output's construction.
     */
    internalKey: Uint8Array | string;
    /**
     * The Taproot Merkle root, if applicable. This, alongside the internal key,
     * is used to prove knowledge of the output's construction. If this is not
     * provided (empty or nil), a BIP-0086 construction is assumed.
     */
    merkleRoot: Uint8Array | string;
}

/** Represents a single message as stored and retrieved from the mailbox. */
export interface MailboxMessage {
    /** The unique ID assigned to the message by the server upon storage. */
    messageId: string;
    /** The ECIES encrypted message payload, intended for the receiver. */
    encryptedPayload: Uint8Array | string;
    /** Timestamp (Unix epoch seconds) when the message arrived at the server. */
    arrivalTimestamp: string;
}

/** Represents a list of messages. */
export interface MailboxMessages {
    /** The list of mailbox messages. */
    messages: MailboxMessage[];
}

/** Request message for the SendMessage RPC. */
export interface SendMessageRequest {
    /**
     * The public key identifier of the intended receiver (ReceiverID), encoded
     * as the raw bytes of the compressed public key.
     */
    receiverId: Uint8Array | string;
    /** The ECIES encrypted message payload. */
    encryptedPayload: Uint8Array | string;
    /**
     * The Bitcoin Merkle Inclusion Proof used as the sender's
     * authentication. The server MUST perform full validation of this
     * proof:
     * 1. Verify claimed_outpoint.txid_hex matches hash(raw_tx_data).
     * 2. Verify claimed_outpoint.index is valid for the transaction.
     * 3. Verify merkle_proof connects the transaction hash to the
     *    raw_block_header_data's Merkle root.
     * 4. Verify block_header validity (e.g., PoW, potentially chain
     *    context).
     * 5. Ensure the claimed_outpoint has not been used previously (check
     *    used_proofs table).
     */
    txProof: BitcoinMerkleInclusionProof | undefined;
}

/** Response message for the SendMessage RPC. */
export interface SendMessageResponse {
    /** The unique ID assigned to the stored message by the server. */
    messageId: string;
}

/**
 * Wrapper message for requests sent FROM the client TO the server during the
 * ReceiveMessages stream.
 */
export interface ReceiveMessagesRequest {
    /**
     * The initial parameters sent by the client to start receiving
     * messages.
     */
    init: InitReceive | undefined;
    /** The client's signature in response to the server's challenge. */
    authSig: AuthSignature | undefined;
}

/** Carries the initial parameters from the client to start receiving messages. */
export interface InitReceive {
    /**
     * The public key identifier of the receiver of the messages that should be
     * received through a message receive stream, encoded as the raw bytes of
     * the compressed public key.
     */
    receiverId: Uint8Array | string;
    /**
     * The exclusive start message ID, meaning messages with this ID or higher
     * will be included in the response. This allows the client to resume
     * receiving messages from a specific point without missing any. One of
     * start_message_id_exclusive, start_block_height_inclusive or
     * start_timestamp_exclusive must be at their non-default values for any
     * existing messages to be returned!
     */
    startMessageIdExclusive: string;
    /**
     * The inclusive start block height, meaning messages from this block height
     * or higher will be included in the response. This allows the client to
     * filter messages based on the block height at which they were produced.
     * One of start_message_id_exclusive, start_block_height_inclusive or
     * start_timestamp_exclusive must be at their non-default values for any
     * existing messages to be returned!
     */
    startBlockHeightInclusive: number;
    /**
     * The exclusive start timestamp in Unix epoch seconds, meaning messages
     * with a timestamp strictly greater than this value will be included in the
     * response. This allows the client to filter messages based on their
     * arrival time at the server. One of start_message_id_exclusive,
     * start_block_height_inclusive or start_timestamp_exclusive must be at
     * their non-default values for any existing messages to be returned!
     */
    startTimestampExclusive: string;
}

/** Carries the client's signature in response to the server's challenge. */
export interface AuthSignature {
    /**
     * The client's Schnorr signature over the challenge hash provided by
     * the server.
     */
    signature: Uint8Array | string;
}

/**
 * Wrapper message for responses sent FROM the server TO the client
 * during the ReceiveMessages stream.
 */
export interface ReceiveMessagesResponse {
    /**
     * The challenge sent by the server to the client, which the client
     * must sign to prove ownership of the receiver's public key.
     */
    challenge: Challenge | undefined;
    /**
     * A successful authentication response, indicating the client has
     * successfully signed the challenge and is now authenticated to receive
     * messages.
     */
    authSuccess: boolean | undefined;
    /**
     * A list of mailbox messages sent to the client. This will be
     * sent after the client has successfully authenticated by signing the
     * challenge. The client should expect a stream of these messages
     * until the server sends an EndOfStream message.
     */
    messages: MailboxMessages | undefined;
    /** An EndOfStream message indicating that the server is shutting down. */
    eos: EndOfStream | undefined;
}

/** Carries the challenge hash sent by the server to the client. */
export interface Challenge {
    /**
     * The challenge hash that the client must sign to prove ownership of the
     * receiver's public key.
     */
    challengeHash: Uint8Array | string;
}

/**
 * An empty message used to explicitly signal the normal end of the message
 * stream.
 */
export interface EndOfStream {}

/** Request message for the MailboxInfo RPC. */
export interface MailboxInfoRequest {}

/** Response message for the MailboxInfo RPC. */
export interface MailboxInfoResponse {
    /** The current server time in Unix epoch seconds. */
    serverTime: string;
    /** The number of messages currently stored on the server. */
    messageCount: string;
}

/**
 * Service definition for the authenticated mailbox. This service allows sending
 * messages (authenticated by UTXO proof) and receiving messages (authenticated
 * via a challenge-response handshake).
 */
export interface Mailbox {
    /**
     * Sends a single message to a receiver's mailbox. Requires a valid, unused
     * Bitcoin P2TR transaction outpoint as proof of uniqueness, included in a
     * block as proof of work.
     */
    sendMessage(
        request?: DeepPartial<SendMessageRequest>
    ): Promise<SendMessageResponse>;
    /**
     * Initiates a bidirectional stream to receive messages for a specific
     * receiver. This stream implements the challenge-response handshake required
     * for receiver authentication before messages are delivered.
     *
     * Expected flow:
     * 1. Client -> Server: ReceiveMessagesRequest(init = InitReceive{...})
     * 2. Server -> Client: ReceiveMessagesResponse(challenge = Challenge{...})
     * 3. Client -> Server: ReceiveMessagesRequest(auth_sig = AuthSignature{...})
     * 4. Server -> Client: [Stream of ReceiveMessagesResponse(
     * message = MailboxMessage{...}
     * )]
     * 5. Server -> Client: ReceiveMessagesResponse(eos = EndOfStream{})
     */
    receiveMessages(
        request?: DeepPartial<ReceiveMessagesRequest>,
        onMessage?: (msg: ReceiveMessagesResponse) => void,
        onError?: (err: Error) => void
    ): void;
    /** Returns basic server information. */
    mailboxInfo(
        request?: DeepPartial<MailboxInfoRequest>
    ): Promise<MailboxInfoResponse>;
}

type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
