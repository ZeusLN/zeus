import Base64Utils from './Base64Utils';

const scbStringToBytes = (str: string): Uint8Array => {
    const trimmed = str.trim();
    if (Base64Utils.isHex(trimmed) && trimmed.length % 2 === 0) {
        return Base64Utils.hexToBytes(trimmed);
    }
    return Base64Utils.base64ToBytes(trimmed);
};

export { scbStringToBytes };
