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

export function ChannelItem({
    title,
    inbound,
    outbound,
    largestTotal,
    status,
    pendingTimelock,
    noBorder,
    hideLabels,
    selected
}: {
    title?: string;
    inbound: number;
    outbound: number;
    largestTotal?: number;
    status?: Status;
    pendingTimelock?: String;
    noBorder?: boolean;
    hideLabels?: boolean;
    selected?: boolean;
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
                borderBottomWidth: noBorder ? 0 : 1
            }}
        >
            <Row justify="space-between">
                {title && (
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Body color={selected ? 'highlight' : 'text'}>
                            {PrivacyUtils.sensitiveValue(title)}
                        </Body>
                    </View>
                )}
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
                        right={lurkerMode ? 50 : Number(inbound)}
                        offline={isOffline}
                        percentOfLargest={percentOfLargest}
                        showProportionally={lurkerMode ? false : true}
                    />
                </Row>
            )}
            {!hideLabels && (
                <Row justify="space-between">
                    <Amount sats={outbound} sensitive />
                    <Amount sats={inbound} sensitive />
                </Row>
            )}
        </View>
    );
}
