import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import BackendUtils from '../../utils/BackendUtils';
import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

import { Body } from '../../components/text/Body';
import { Row } from '../../components/layout/Row';
import { Spacer } from '../../components/layout/Spacer';
import Amount from '../../components/Amount';

function TotalRow({
    kind,
    amount,
    color
}: {
    kind: string;
    amount: number;
    color?: string;
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
            <Amount sats={amount} toggleable />
        </Row>
    );
}

export function RoutingHeader(props: any) {
    const {
        dayEarned,
        weekEarned,
        monthEarned,
        totalEarned,
        timeframeEarned,
        fullSize
    } = props;

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
            height: BackendUtils.singleFeesEarnedTotal()
                ? 55
                : fullSize
                ? 200
                : 120,
            padding: 16,
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 20
        }
    });

    return (
        <View>
            <View style={styles.wrapper}>
                {!fullSize && (
                    <View style={{ alignItems: 'center' }}>
                        <Amount
                            sats={timeframeEarned}
                            jumboText
                            toggleable
                            sensitive
                        />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            {localeString(
                                'views.Routing.RoutingHeader.timeframeEarned'
                            )}
                        </Text>
                    </View>
                )}
                {!BackendUtils.singleFeesEarnedTotal() && fullSize && (
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
                {BackendUtils.singleFeesEarnedTotal() && fullSize && (
                    <>
                        <TotalRow
                            kind={localeString(
                                'views.Routing.RoutingHeader.totalEarned'
                            )}
                            amount={totalEarned}
                        />
                    </>
                )}
            </View>
        </View>
    );
}
