import * as React from 'react';
import { View } from 'react-native';

import { Body } from '../../components/text/Body';
import { BalanceBar } from '../../components/Channels/BalanceBar';
import { Row } from '../../components/layout/Row';
import { Status } from '../../views/Channels/ChannelsPane';
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
    inbound,
    outbound,
    reserve = 0,
    largestTotal,
    status,
    pendingHTLCs,
    pendingTimelock,
    noBorder,
    hideLabels,
    selected,
    highlightLabels
}: {
    title?: string;
    secondTitle?: string;
    inbound: string | number;
    outbound: string | number;
    reserve?: string | number;
    largestTotal?: number;
    status?: Status;
    pendingHTLCs?: boolean;
    pendingTimelock?: string;
    noBorder?: boolean;
    hideLabels?: boolean;
    selected?: boolean;
    highlightLabels?: boolean;
}) {
    const { settings } = Stores.settingsStore;
    const { privacy } = settings;
    const lurkerMode = (privacy && privacy.lurkerMode) || false;

    const isOffline =
        status === Status.Offline ||
        status === Status.Closing ||
        status === Status.Opening;

    const percentOfLargest = largestTotal
        ? (Number(inbound) + Number(outbound)) / largestTotal
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
                {status && <Tag status={status} />}
            </Row>
            {inbound && outbound && !(inbound == 0 && outbound == 0) && (
                <Row style={{ marginTop: 15, marginBottom: 15 }}>
                    <BalanceBar
                        left={lurkerMode ? 50 : Number(outbound)}
                        center={lurkerMode ? 0 : Number(reserve)}
                        right={lurkerMode ? 50 : Number(inbound)}
                        offline={isOffline}
                        percentOfLargest={percentOfLargest}
                        showProportionally={lurkerMode ? false : true}
                    />
                </Row>
            )}
            {!hideLabels && (
                <Row justify="space-between">
                    <Amount
                        sats={outbound}
                        sensitive
                        accessible
                        accessibilityLabel={localeString(
                            'views.Channel.outboundCapacity'
                        )}
                        colorOverride={
                            highlightLabels ? themeColor('outbound') : undefined
                        }
                    />
                    <Amount
                        sats={inbound}
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
