import * as React from 'react';
import { Text, View } from 'react-native';

import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';

import Amount from './Amount';
import KeyValue from './KeyValue';
import { Row } from './layout/Row';

interface PaymentPathProps {
    value?: any;
}

export default class PaymentPath extends React.Component<PaymentPathProps, {}> {
    render() {
        const { value } = this.props;

        const paths: any = [];
        value.map((path: any, index: number) => {
            const hops: any = [];
            if (value.length > 1) {
                hops.push(
                    <Text
                        style={{
                            fontSize: 15,
                            color: themeColor('text'),
                            fontFamily: 'Lato-Bold',
                            marginBottom: 20
                        }}
                    >
                        {`Path ${index + 1}`}
                    </Text>
                );
            }
            path.map((hop: any, key: number) => {
                hops.push(
                    <View
                        key={key}
                        style={{
                            left: 20,
                            marginRight: 20,
                            borderStyle: 'dotted',
                            borderLeftWidth: 3,
                            borderColor:
                                path.length == key + 1
                                    ? themeColor('background')
                                    : themeColor('secondaryText')
                        }}
                    >
                        <Row>
                            <View
                                style={{
                                    height: 44, //any of height
                                    width: 44, //any of width
                                    justifyContent: 'center',
                                    borderRadius: 22,
                                    backgroundColor: themeColor('highlight'),
                                    alignSelf: 'center',
                                    alignItems: 'center',
                                    left: -25
                                }}
                            >
                                <Text
                                    style={{
                                        fontSize: 15,
                                        color: themeColor('background'),
                                        fontFamily: 'Lato-Bold'
                                    }}
                                >
                                    {`${key + 1}`}
                                </Text>
                            </View>
                            <Text
                                style={{
                                    fontSize: 15,
                                    color: themeColor('highlight'),
                                    fontFamily: 'Lato-Bold'
                                }}
                            >
                                {`${
                                    hop.node.length >= 66
                                        ? `${
                                              PrivacyUtils.sensitiveValue(
                                                  hop.node
                                              ).slice(0, 14) +
                                              '...' +
                                              PrivacyUtils.sensitiveValue(
                                                  hop.node
                                              ).slice(-14)
                                          }`
                                        : PrivacyUtils.sensitiveValue(hop.node)
                                }`}
                            </Text>
                        </Row>

                        <View style={{ marginLeft: 50, marginBottom: 15 }}>
                            <KeyValue
                                keyValue={'Forwarded'}
                                value={
                                    <Amount sats={hop.forwarded} toggleable />
                                }
                                sensitive
                            />

                            <KeyValue
                                keyValue={'Fee'}
                                value={<Amount sats={hop.fee} toggleable />}
                                sensitive
                            />
                        </View>
                    </View>
                );
            });
            paths.push(hops);
        });

        return <View style={{ marginTop: 20 }}>{paths}</View>;
    }
}
