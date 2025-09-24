// Type declarations to fix @nostr/tools TextDecoder/TextEncoder usage
declare global {
    interface TextDecoder {
        decode(
            input?: ArrayBuffer | ArrayBufferView | null,
            options?: { stream?: boolean }
        ): string;
    }

    interface TextEncoder {
        encode(input?: string): Uint8Array;
    }

    var TextDecoder: {
        prototype: TextDecoder;
        new (label?: string, options?: { stream?: boolean }): TextDecoder;
    };

    var TextEncoder: {
        prototype: TextEncoder;
        new (): TextEncoder;
    };
}

export {};
