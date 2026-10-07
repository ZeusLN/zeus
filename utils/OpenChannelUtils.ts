import ValidationUtils from './ValidationUtils';

import { AdditionalChannel } from '../models/OpenChannelRequest';

// AmountInput reports satAmount '0' for an empty field
const isValidChannelAmount = (satAmount: string | number): boolean =>
    Number(satAmount) > 0;

// the amount fund max opens the channel with: the selected UTXOs, otherwise
// the on-chain balance, including unconfirmed funds when the open may spend
// them (min confs 0)
const getFundMaxAmount = ({
    utxoBalance,
    confirmedBlockchainBalance,
    unconfirmedBlockchainBalance,
    spendUnconfirmed
}: {
    utxoBalance: number;
    confirmedBlockchainBalance: number | string;
    unconfirmedBlockchainBalance: number | string;
    spendUnconfirmed: boolean;
}): number =>
    utxoBalance > 0
        ? utxoBalance
        : Number(confirmedBlockchainBalance) +
          (spendUnconfirmed ? Number(unconfirmedBlockchainBalance) : 0);

// with fund max on, the backend funds the channel from the available balance,
// so that balance is checked instead of the entered amount.
// Connect-peer-only mode opens no channel
const isInvalidMainChannelAmount = ({
    satAmount,
    fundMax,
    fundMaxAmount,
    connectPeerOnly
}: {
    satAmount: string | number;
    fundMax: boolean;
    fundMaxAmount: number;
    connectPeerOnly: boolean;
}): boolean =>
    !connectPeerOnly &&
    !isValidChannelAmount(fundMax ? fundMaxAmount : satAmount);

const isValidAdditionalChannelPubkey = (channel: AdditionalChannel): boolean =>
    ValidationUtils.validateNodePubkey(channel.node_pubkey_string);

const isValidAdditionalChannelHost = (channel: AdditionalChannel): boolean =>
    ValidationUtils.validateNodeHost(channel.host);

const hasInvalidAdditionalChannels = (
    additionalChannels: Array<AdditionalChannel>,
    connectPeerOnly: boolean
): boolean =>
    !connectPeerOnly &&
    additionalChannels.some(
        (channel) =>
            !isValidChannelAmount(channel.satAmount) ||
            !isValidAdditionalChannelPubkey(channel) ||
            !isValidAdditionalChannelHost(channel)
    );

// min confs typed into a text field. An empty or non-integer entry is unset
// (the default of 1 applies), so clearing the field never stores 0, which
// would let channel opens spend unconfirmed funds
const parseMinConfs = (text: string): number | undefined => {
    const trimmed = text.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
};

const OpenChannelUtils = {
    isValidChannelAmount,
    parseMinConfs,
    getFundMaxAmount,
    isInvalidMainChannelAmount,
    isValidAdditionalChannelPubkey,
    isValidAdditionalChannelHost,
    hasInvalidAdditionalChannels
};

export default OpenChannelUtils;
