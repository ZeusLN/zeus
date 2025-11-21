import { localeString } from '../utils/LocaleUtils';

export enum Status {
    Online = localeString('views.Wallet.Channels.online'),
    Active = localeString('general.active'),
    Stable = localeString('channel.status.stable'),
    Unstable = localeString('channel.status.unstable'),
    Offline = localeString('channel.status.offline'),
    Opening = localeString('channel.status.opening'),
    Closing = localeString('channel.status.closing'),
    ReadOnly = localeString('views.Settings.NostrWalletConnect.readOnly')
}

export enum ExpirationStatus {
    Expiring = localeString('channel.expirationStatus.expiring'),
    Expired = localeString('channel.expirationStatus.expired'),
    LSPDiscretion = localeString('general.warning')
}
