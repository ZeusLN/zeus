import Foundation
import CryptoKit
import CommonCrypto

@objc class CryptoHelper: NSObject {

    private static let cryptoVersion: UInt8 = 0x01
    private static let saltLen = 16
    private static let ivLen = 12
    private static let gcmTagLen = 16
    private static let pbkdf2Iterations: UInt32 = 100_000
    private static let keyLen = 32 // AES-256

    @objc static func encryptData(_ plaintext: Data, passphrase: String) throws -> Data {
        var salt = Data(count: saltLen)
        var iv = Data(count: ivLen)
        try salt.withUnsafeMutableBytes { buf in
            guard SecRandomCopyBytes(kSecRandomDefault, saltLen, buf.baseAddress!) == errSecSuccess else {
                throw NSError(domain: "CryptoHelper", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate random salt"])
            }
        }
        try iv.withUnsafeMutableBytes { buf in
            guard SecRandomCopyBytes(kSecRandomDefault, ivLen, buf.baseAddress!) == errSecSuccess else {
                throw NSError(domain: "CryptoHelper", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to generate random IV"])
            }
        }

        let derivedKey = try deriveKey(passphrase: passphrase, salt: salt)
        let symmetricKey = SymmetricKey(data: derivedKey)
        let nonce = try AES.GCM.Nonce(data: iv)
        let sealedBox = try AES.GCM.seal(plaintext, using: symmetricKey, nonce: nonce)

        // Wire format: [version][salt][iv][ciphertext][tag]
        var output = Data()
        output.append(cryptoVersion)
        output.append(salt)
        output.append(iv)
        output.append(sealedBox.ciphertext)
        output.append(sealedBox.tag)
        return output
    }

    @objc static func decryptData(_ fileData: Data, passphrase: String) throws -> Data {
        let minLen = 1 + saltLen + ivLen + gcmTagLen
        guard fileData.count >= minLen else {
            throw NSError(domain: "CryptoHelper", code: -2, userInfo: [NSLocalizedDescriptionKey: "File too small to be a valid encrypted backup"])
        }

        let version = fileData[fileData.startIndex]
        guard version == cryptoVersion else {
            throw NSError(domain: "CryptoHelper", code: -3, userInfo: [NSLocalizedDescriptionKey: "Unsupported encryption version: \(version)"])
        }

        let saltStart = fileData.startIndex + 1
        let ivStart = saltStart + saltLen
        let ciphertextStart = ivStart + ivLen
        let tagStart = fileData.endIndex - gcmTagLen

        let salt = fileData[saltStart..<ivStart]
        let iv = fileData[ivStart..<ciphertextStart]
        let ciphertext = fileData[ciphertextStart..<tagStart]
        let tag = fileData[tagStart..<fileData.endIndex]

        let derivedKey = try deriveKey(passphrase: passphrase, salt: Data(salt))
        let symmetricKey = SymmetricKey(data: derivedKey)
        let nonce = try AES.GCM.Nonce(data: iv)
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
        return try AES.GCM.open(sealedBox, using: symmetricKey)
    }

    private static func deriveKey(passphrase: String, salt: Data) throws -> Data {
        guard let passphraseData = passphrase.data(using: .utf8) else {
            throw NSError(domain: "CryptoHelper", code: -4, userInfo: [NSLocalizedDescriptionKey: "Failed to encode passphrase"])
        }
        var derivedKey = Data(count: keyLen)
        let status = derivedKey.withUnsafeMutableBytes { keyBuf in
            salt.withUnsafeBytes { saltBuf in
                passphraseData.withUnsafeBytes { passBuf in
                    CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passBuf.baseAddress?.assumingMemoryBound(to: Int8.self),
                        passphraseData.count,
                        saltBuf.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        saltLen,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        pbkdf2Iterations,
                        keyBuf.baseAddress?.assumingMemoryBound(to: UInt8.self),
                        keyLen
                    )
                }
            }
        }
        guard status == kCCSuccess else {
            throw NSError(domain: "CryptoHelper", code: -5, userInfo: [NSLocalizedDescriptionKey: "Key derivation failed"])
        }
        return derivedKey
    }
}
