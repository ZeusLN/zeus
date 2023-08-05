import * as React from 'react';
import { View } from 'react-native';
import { Body } from '../components/text/Body';
import { Row } from '../components/layout/Row';
import { Spacer } from '../components/layout/Spacer';

// TODO: will replace this with a more generic "Value" component
export function Sats({ sats }: { sats: number }) {
    const numberWithCommas = (x: string | number = 0) =>
        x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    return (
        <Row align="flex-end">
            <Body>{numberWithCommas(sats)}</Body>
            <Spacer width={2} />
            <View style={{ paddingBottom: 1.5 }}>
                <Body secondary small>
                    sats
                </Body>
            </View>
        </Row>
    );
}
