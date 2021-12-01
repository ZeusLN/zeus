import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';
import { Sats } from '../../components/Sats';
import { Amount } from '../../components/Amount';

function TotalRow({
    kind,
    amount,
    color
}: {
    kind: string;
    amount: number;
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
            <Sats sats={amount} />
        </Row>
    );
}

export function RoutingHeader(props) {
    const { dayEarned, weekEarned, monthEarned, timeframeEarned, fullSize } =
        props;

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
            height: fullSize ? 200 : 120,
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
                {!fullSize && (
                    <View style={{ alignItems: 'center' }}>
                        <Amount sats={timeframeEarned} jumboText toggleable />
                        <Text style={{ color: themeColor('text') }}>
                            {localeString(
                                'views.Routing.RoutingHeader.timeframeEarned'
                            )}
                        </Text>
                    </View>
                )}
                {fullSize && (
                    <>
                        <TotalRow
                            kind={localeString(
                                'views.Routing.RoutingHeader.dayEarned'
                            )}
                            amount={dayEarned}
                        />
                        <TotalRow
                            kind={localeString(
                                'views.Routing.RoutingHeader.weekEarned'
                            )}
                            amount={weekEarned}
                        />
                        <TotalRow
                            kind={localeString(
                                'views.Routing.RoutingHeader.monthEarned'
                            )}
                            amount={monthEarned}
                        />
                    </>
                )}
            </View>
        </View>
    );
}
