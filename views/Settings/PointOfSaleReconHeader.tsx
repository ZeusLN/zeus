import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { themeColor } from '../../utils/ThemeUtils';

import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';
import { localeString } from '../../utils/LocaleUtils';

function TotalRow({
    kind,
    amount,
    color
}: {
    kind: string;
    amount: string;
    color: string;
}) {
    return (
        <Row justify="space-between">
            <Row>
                <View
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 8,
                        backgroundColor: color
                    }}
                />
                <Spacer width={8} />
                <Body secondary>{kind}</Body>
            </Row>
            <Text
                style={{
                    color: themeColor('text'),
                    fontFamily: 'PPNeueMontreal-Book'
                }}
            >
                {amount}
            </Text>
        </Row>
    );
}

export function ReconHeader(props) {
    const { total, tax, tips, FiatStore } = props;
    const { getSymbol } = FiatStore;

    const styles = StyleSheet.create({
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16
        },
        wrapper: {
            display: 'flex',
            justifyContent: 'space-between',
            height: 100,
            padding: 16,
            backgroundColor: themeColor('background'),
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
            color: themeColor('text'),
            // TODO: this shadow stuff probably needs tweaking on iOS
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 0
            },
            shadowOpacity: 0.5,
            shadowRadius: 40,
            elevation: 15
        }
    });

    return (
        <View>
            <View style={styles.wrapper}>
                <>
                    <TotalRow
                        kind={localeString('pos.views.Order.total')}
                        amount={`${getSymbol().symbol}${total}`}
                    />
                    <TotalRow
                        kind={localeString('pos.views.Order.tax')}
                        amount={`${getSymbol().symbol}${tax}`}
                    />
                    <TotalRow
                        kind={localeString('pos.views.Order.tip')}
                        amount={`${getSymbol().symbol}${tips}`}
                    />
                </>
            </View>
        </View>
    );
}
