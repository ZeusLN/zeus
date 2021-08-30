import { URDecoder } from '@ngraveio/bc-ur';
import b58 from 'bs58check';
import {
  CryptoHDKey,
  CryptoKeypath,
  CryptoOutput,
  PathComponent,
  ScriptExpressions,
  CryptoPSBT,
  CryptoAccount,
  Bytes,
} from '@keystonehq/bc-ur-registry';
import { decodeUR as origDecodeUr, encodeUR as origEncodeUR, extractSingleWorkload as origExtractSingleWorkload } from '../bc-ur/dist';
import { Psbt } from 'bitcoinjs-lib';

function extractSingleWorkload(arg) {
  return origExtractSingleWorkload(arg);
}

function decodeUR(arg) {
  try {
    return origDecodeUr(arg);
  } catch (_) {}

  const decoder = new URDecoder();

  for (const part of arg) {
    decoder.receivePart(part);
  }

  if (!decoder.isSuccess()) {
    throw new Error(decoder.resultError());
  }

  const decoded = decoder.resultUR();

  if (decoded.type === 'crypto-psbt') {
    const cryptoPsbt = CryptoPSBT.fromCBOR(decoded.cbor);
    return cryptoPsbt.getPSBT().toString('hex');
  }

  if (decoded.type === 'bytes') {
    const b = Bytes.fromCBOR(decoded.cbor);
    return b.getData();
  }

  const cryptoAccount = CryptoAccount.fromCBOR(decoded.cbor);

  // now, crafting zpub out of data we have
  const hdKey = cryptoAccount.outputDescriptors[0].getCryptoKey();
  const derivationPath = 'm/' + hdKey.getOrigin().getPath();
  const script = cryptoAccount.outputDescriptors[0].getScriptExpressions()[0].getExpression();
  const isMultisig =
    script === ScriptExpressions.WITNESS_SCRIPT_HASH.getExpression();
  const version = Buffer.from(isMultisig ? '02aa7ed3' : '04b24746', 'hex');
  const parentFingerprint = hdKey.getParentFingerprint();
  const depth = hdKey.getOrigin().getDepth();
  const depthBuf = Buffer.alloc(1);
  depthBuf.writeUInt8(depth);
  const components = hdKey.getOrigin().getComponents();
  const lastComponents = components[components.length - 1];
  const index = lastComponents.isHardened() ? lastComponents.getIndex() + 0x80000000 : lastComponents.getIndex();
  const indexBuf = Buffer.alloc(4);
  indexBuf.writeUInt32BE(index);
  const chainCode = hdKey.getChainCode();
  const key = hdKey.getKey();
  const data = Buffer.concat([version, depthBuf, parentFingerprint, indexBuf, chainCode, key]);

  const zpub = b58.encode(data);

  const result = {};
  result.ExtPubKey = zpub;
  result.MasterFingerprint = cryptoAccount.getMasterFingerprint().toString('hex').toUpperCase();
  result.AccountKeyPath = derivationPath;

  const str = JSON.stringify(result);
  return Buffer.from(str, 'ascii').toString('hex'); // we are expected to return hex-encoded string
}

class BlueURDecoder extends URDecoder {
  toString() {
    const decoded = this.resultUR();

    if (decoded.type === 'crypto-psbt') {
      const cryptoPsbt = CryptoPSBT.fromCBOR(decoded.cbor);
      return cryptoPsbt.getPSBT().toString('base64');
    } else if (decoded.type === 'bytes') {
      const bytes = Bytes.fromCBOR(decoded.cbor);
      return Buffer.from(bytes.getData(), 'hex').toString('ascii');
    }
  }
}

export { decodeUR, extractSingleWorkload, BlueURDecoder };
