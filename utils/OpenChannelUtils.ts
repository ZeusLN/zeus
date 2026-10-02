import ValidationUtils from './ValidationUtils';

import { AdditionalChannel } from '../models/OpenChannelRequest';

// AmountInput reports satAmount '0' for an empty field
const isValidChannelAmount = (satAmount: string | number): boolean =>
    Number(satAmount) > 0;

// with fund max on, the backend funds the channel from the available balance,
// and connect-peer-only mode opens no channel
const isInvalidMainChannelAmount = ({
    satAmount,
    fundMax,
    connectPeerOnly
}: {
    satAmount: string | number;
    fundMax: boolean;
    connectPeerOnly: boolean;
}): boolean => !connectPeerOnly && !fundMax && !isValidChannelAmount(satAmount);

const isValidAdditionalChannelPubkey = (channel: AdditionalChannel): boolean =>
    ValidationUtils.validateNodePubkey(channel.node_pubkey_string);

// an empty host is allowed: the store's connect attempt for it fails
// and the error is ignored, so the open relies on an existing connection
const isValidAdditionalChannelHost = (channel: AdditionalChannel): boolean =>
    !channel.host || ValidationUtils.validateNodeHost(channel.host);

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

const OpenChannelUtils = {
    isValidChannelAmount,
    isInvalidMainChannelAmount,
    isValidAdditionalChannelPubkey,
    isValidAdditionalChannelHost,
    hasInvalidAdditionalChannels
};

export default OpenChannelUtils;
