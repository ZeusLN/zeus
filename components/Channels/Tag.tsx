import * as React from 'react';
import { View } from 'react-native';
import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';
import { themeColor } from '../../utils/ThemeUtils';
import { ExpirationStatus, Status } from '../../models/Status';

export function Tag({
    status,
    suffix
}: {
    status: Status | ExpirationStatus;
    suffix?: string;
}) {
    const colors = { background: '', dot: '', text: 'white' };

    // TODO: should all these colors be in the theme?
    switch (status) {
        case Status.Online:
        case Status.Active:
            colors.background = '#2C553D';
            colors.dot = '#46E80E';
            break;
        case Status.Stable:
            colors.background = '#FFB040';
            colors.dot = '#FFC778';
            break;
        case Status.Unstable:
            colors.background = '#E14C4C';
            colors.dot = '#FF0000';
            break;
        case Status.Opening:
        case Status.Closing:
        case Status.Offline:
            colors.background = '#A7A9AC';
            colors.dot = '#E5E5E5';
            break;
        case Status.ReadOnly:
            colors.background = themeColor('highlight');
            colors.text = themeColor('background');
            break;
        case ExpirationStatus.Expiring:
            colors.background = themeColor('warning');
            break;
        case ExpirationStatus.Expired:
        case Status.Error:
        case Status.LimitExceed:
            colors.background = themeColor('error');
            break;
        case ExpirationStatus.LSPDiscretion:
            colors.background = themeColor('warning');
            break;
    }

    return (
        <View
            style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                backgroundColor: colors.background,
                borderRadius: 4,
                marginLeft: 8
            }}
        >
            <Row>
                {colors.dot && (
                    <View
                        style={{
                            width: 6,
                            height: 6,
                            borderRadius: 6,
                            backgroundColor: colors.dot
                        }}
                    />
                )}
                {colors.dot && <Spacer width={6} />}
                <Body colorOverride={colors.text} small>
                    {suffix ? `${status} ${suffix}` : status}
                </Body>
            </Row>
        </View>
    );
}
