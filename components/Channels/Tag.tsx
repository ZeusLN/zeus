import * as React from 'react';
import { View } from 'react-native';
import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';
import { Status } from '../../views/Channels/ChannelsPane';

export function Tag({ status }: { status: Status }) {
    // Garish colors to let you know you fucked up
    const colors = { background: 'pink', dot: 'blue' };

    // TODO: should all these colors be in the theme?
    switch (status) {
        case Status.Good:
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
    }

    return (
        <View
            style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 3,
                paddingBottom: 3,
                backgroundColor: colors.background,
                borderRadius: 4
            }}
        >
            <Row>
                <View
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: 6,
                        backgroundColor: colors.dot
                    }}
                />
                <Spacer width={6} />
                {/* TODO: localize */}
                <Body colorOverride="white" small>
                    {status}
                </Body>
            </Row>
        </View>
    );
}
