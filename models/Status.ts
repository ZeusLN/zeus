import { localeString } from '../utils/LocaleUtils';

export enum Status {
    Online = localeString('views.Wallet.Channels.online'),
    Active = localeString('general.active'),
    Stable = localeString('channel.status.stable'),
    Unstable = localeString('channel.status.unstable'),
    Error = localeString('general.error'),
    Offline = localeString('channel.status.offline'),
    Opening = localeString('channel.status.opening'),
    Closing = localeString('channel.status.closing'),
    Splicing = localeString('channel.status.splicing'),
    ReadOnly = localeString('views.Settings.NostrWalletConnect.readOnly'),
    LimitExceed = localeString('general.limitexceed')
}

export enum ExpirationStatus {
    Expiring = localeString('channel.expirationStatus.expiring'),
    Expired = localeString('channel.expirationStatus.expired'),
    LSPDiscretion = localeString('general.warning')
}
