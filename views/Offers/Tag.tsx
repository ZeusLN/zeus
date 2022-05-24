import * as React from 'react';
import { View } from 'react-native';
import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';

export function Tag({ active }: { active: boolean }) {
    // Garish colors to let you know you fucked up
    const colors = { background: 'pink', dot: 'blue' };

    switch (active) {
        case true:
            colors.background = '#2C553D';
            colors.dot = '#46E80E';
            break;

        case false:
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
                    {active ? 'Active' : 'Inactive'}
                </Body>
            </Row>
        </View>
    );
}
