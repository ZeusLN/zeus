// Amount of the stub LSP's wrapped invoice: the inner invoice amount plus
// the quoted fee, both in msat, so an msat-precision inner invoice is
// wrapped exactly. Returns a decimal string for lncli --amt_msat.
const jitAmountMsat = (innerMsat, feeMsat) =>
    (BigInt(innerMsat) + BigInt(feeMsat || 0)).toString();

module.exports = { jitAmountMsat };
