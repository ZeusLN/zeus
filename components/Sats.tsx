import * as React from 'react';
import { View } from 'react-native';
import { Body } from '../components/text/Body';
import { Row } from '../components/layout/Row';
import { Spacer } from '../components/layout/Spacer';
import stores from '../stores/Stores';

// TODO: will replace this with a more generic "Value" component
export function Sats({ sats }: { sats: number }) {
    const fiatStore = stores.fiatStore;

    return (
        <Row align="flex-end">
            <Body>{fiatStore.numberWithCommas(sats, 3)}</Body>
            <Spacer width={2} />
            <View style={{ paddingBottom: 1.5 }}>
                <Body secondary small>
                    sats
                </Body>
            </View>
        </Row>
    );
}
