// Fields that an lndconnect (or similar) payload does not carry. After a
// QR scan, HandleAnythingQRScanner returns to the same WalletConfiguration
// instance via goBack + navigate, so undefined incoming values must not
// overwrite the user's current checkbox / nickname.
export const preserveUnspecifiedNodeFormFields = (
    incoming: { certVerification?: boolean; nickname?: string },
    current: { certVerification: boolean; nickname: string }
) => ({
    certVerification: incoming.certVerification ?? current.certVerification,
    nickname: incoming.nickname ?? current.nickname
});
