export enum FeeMethod {
    fixed = 'fixed',
    percent = 'percent'
}

export enum AddressType {
    p2wk = '0',
    np2wkh = '1',
    p2tr = '4'
}

export enum Status {
    Good = 'Good',
    Stable = 'Stable',
    Unstable = 'Unstable',
    Offline = 'Offline',
    Opening = 'Opening',
    Closing = 'Closing'
}

export enum Implementation {
    clightningREST = 'c-lightning-REST',
    spark = 'spark',
    lndhub = 'lndhub',
    lnd = 'lnd',
    LightningNodeConnect = 'lightning-node-connect',
    eclair = 'eclair'
}

export enum TransactionType {
    Lightning = 'Lightning',
    OnChain = 'On-Chain',
    Keysend = 'Keysend'
}

export enum Units {
    sats = 'sats',
    BTC = 'BTC',
    fiat = 'fiat'
}

export enum ChannelsType {
    Open = 0,
    Pending = 1,
    Closed = 2
}

export enum CustomType {
    Percentage = 'percentage',
    Amount = 'amount'
}

export enum FeeType {
    FastestFee = 'fastestFee',
    HalfHourFee = 'halfHourFee',
    HourFee = 'hourFee',
    MinimumFee = 'minimumFee',
    Custom = 'custom'
}
