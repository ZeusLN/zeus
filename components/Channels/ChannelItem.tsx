import * as React from 'react';
import { View } from 'react-native';

import { Body } from '../../components/text/Body';
import { BalanceBar } from '../../components/Channels/BalanceBar';
import { Row } from '../../components/layout/Row';
import { Status, ExpirationStatus } from '../../views/Channels/ChannelsPane';
import Amount from '../Amount';
import { Tag } from './Tag';

import PrivacyUtils from './../../utils/PrivacyUtils';
import { themeColor } from './../../utils/ThemeUtils';

import Stores from '../../stores/Stores';

import ClockIcon from '../../assets/images/SVG/Clock.svg';
import HourglassIcon from '../../assets/images/SVG/Hourglass.svg';
import { localeString } from './../../utils/LocaleUtils';

export function ChannelItem({
    title,
    secondTitle,
    localBalance,
    remoteBalance,
    sendingCapacity,
    receivingCapacity,
    inboundReserve = 0,
    outboundReserve = 0,
    largestTotal,
    status,
    expirationStatus,
    pendingHTLCs,
    pendingTimelock,
    noBorder,
    hideLabels,
    selected,
    highlightLabels,
    isBelowReserve
}: {
    title?: string;
    secondTitle?: string;
    localBalance: string | number;
    remoteBalance: string | number;
    sendingCapacity?: string | number;
    receivingCapacity?: string | number;
    inboundReserve?: string | number;
    outboundReserve?: string | number;
    largestTotal?: number;
    status?: Status;
    expirationStatus?: ExpirationStatus;
    pendingHTLCs?: boolean;
    pendingTimelock?: string;
    noBorder?: boolean;
    hideLabels?: boolean;
    selected?: boolean;
    highlightLabels?: boolean;
    isBelowReserve?: boolean;
}) {
    const { settings } = Stores.settingsStore;
    const { privacy } = settings;
    const lurkerMode = (privacy && privacy.lurkerMode) || false;

    const isOffline =
        status === Status.Offline ||
        status === Status.Closing ||
        status === Status.Opening;

    const percentOfLargest = largestTotal
        ? (Number(localBalance) + Number(remoteBalance)) / largestTotal
        : 1.0;
    return (
        <View
            style={{
                padding: 16,
                justifyContent: 'space-around',
                borderBottomColor: themeColor('secondary'),
                borderBottomWidth: noBorder ? 0 : 1,
                backgroundColor: selected ? themeColor('background') : undefined
            }}
        >
            <Row justify="space-between">
                {title && (
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Body
                            color={
                                selected
                                    ? 'highlight'
                                    : highlightLabels
                                    ? 'outbound'
                                    : 'text'
                            }
                            bold={selected}
                        >
                            {`${
                                typeof title === 'string' &&
                                PrivacyUtils.sensitiveValue(title)
                            }`}
                        </Body>
                    </View>
                )}
                {secondTitle && (
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Body
                            color={
                                selected
                                    ? 'highlight'
                                    : highlightLabels
                                    ? 'inbound'
                                    : 'text'
                            }
                            bold={selected}
                        >
                            {secondTitle}
                        </Body>
                    </View>
                )}
                {pendingHTLCs ? (
                    <View style={{ flexDirection: 'row', marginRight: 5 }}>
                        <HourglassIcon
                            fill={themeColor('highlight')}
                            width={17}
                            height={17}
                            style={{ marginRight: 5 }}
                        />
                    </View>
                ) : null}
                {pendingTimelock ? (
                    <View style={{ flexDirection: 'row', marginRight: 5 }}>
                        <ClockIcon
                            color={themeColor('bitcoin')}
                            width={17}
                            height={17}
                            style={{ marginRight: 5 }}
                        />
                        <Body small={true}>{pendingTimelock}</Body>
                    </View>
                ) : null}
                {expirationStatus && <Tag status={expirationStatus} />}
                {status && <Tag status={status} />}
            </Row>
            {localBalance &&
                remoteBalance &&
                !(localBalance == 0 && remoteBalance == 0) && (
                    <Row style={{ marginTop: 15, marginBottom: 15 }}>
                        <BalanceBar
                            outbound={lurkerMode ? 50 : Number(localBalance)}
                            inbound={lurkerMode ? 50 : Number(remoteBalance)}
                            outboundReserve={
                                lurkerMode ? 0 : Number(outboundReserve)
                            }
                            inboundReserve={
                                lurkerMode ? 0 : Number(inboundReserve)
                            }
                            offline={isOffline}
                            percentOfLargest={percentOfLargest}
                            showProportionally={lurkerMode ? false : true}
                        />
                    </Row>
                )}
            {!hideLabels && (
                <Row justify="space-between">
                    <Amount
                        sats={
                            isBelowReserve
                                ? localBalance
                                : sendingCapacity || localBalance
                        }
                        sensitive
                        accessible
                        accessibilityLabel={localeString(
                            'views.Channel.outboundCapacity'
                        )}
                        colorOverride={
                            highlightLabels ? themeColor('outbound') : undefined
                        }
                        color={isBelowReserve ? 'warningReserve' : undefined}
                    />
                    <Amount
                        sats={receivingCapacity || remoteBalance}
                        sensitive
                        accessible
                        accessibilityLabel={localeString(
                            'views.Channel.inboundCapacity'
                        )}
                        colorOverride={
                            highlightLabels ? themeColor('inbound') : undefined
                        }
                    />
                </Row>
            )}
        </View>
    );
}
