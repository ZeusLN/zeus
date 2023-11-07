import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';

import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import UrlUtils from '../utils/UrlUtils';

import Amount from './Amount';
import KeyValue from './KeyValue';
import { Row } from './layout/Row';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';

import stores from '../stores/Stores';
import LoadingIndicator from './LoadingIndicator';

interface PaymentPathProps {
    value?: any;
    aliasMap?: any;
}

const Hop = (props: any) => {
    const { index, title, path, updateMap, expanded } = props;
    return (
        <TouchableOpacity
            onPress={() => updateMap(index, !expanded.get(index))}
        >
            <View
                style={{
                    backgroundColor: themeColor('secondary'),
                    borderRadius: 6,
                    margin: 10,
                    marginBottom: 20,
                    width: '100%',
                    left: -10,
                    paddingLeft: 5,
                    paddingTop: 10,
                    paddingBottom: 10
                }}
            >
                <Row align="flex-end">
                    <View style={{ top: -8, left: 4 }}>
                        {expanded.get(index) ? (
                            <CaretDown
                                fill={themeColor('text')}
                                width="20"
                                height="20"
                            />
                        ) : (
                            <CaretRight
                                fill={themeColor('text')}
                                width="20"
                                height="20"
                            />
                        )}
                    </View>
                    <Text
                        style={{
                            fontSize: 17,
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Medium',
                            margin: 10
                        }}
                    >
                        {title}
                    </Text>
                    <View
                        style={{
                            height: 40, //any of height
                            width: 40, //any of width
                            justifyContent: 'center',
                            borderRadius: 20,
                            backgroundColor: themeColor('highlight'),
                            alignItems: 'center',
                            right: 10,
                            position: 'absolute'
                        }}
                    >
                        <Text
                            style={{
                                fontSize: 15,
                                color: themeColor('background'),
                                fontFamily: 'PPNeueMontreal-Medium'
                            }}
                        >
                            {path.length}
                        </Text>
                    </View>
                </Row>
            </View>
        </TouchableOpacity>
    );
};

const ExpandedHop = (props: any) => {
    const { pathIndex, hop, path, aliasMap, loading } = props;
    return (
        <View
            key={pathIndex}
            style={{
                left: 20,
                marginRight: 20,
                borderStyle: 'dotted',
                borderLeftWidth: 3,
                borderColor:
                    path.length == pathIndex + 1
                        ? 'transparent'
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
                            fontFamily: 'PPNeueMontreal-Medium'
                        }}
                    >
                        {`${pathIndex + 1}`}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        if (!hop.pubKey) return;
                        UrlUtils.goToBlockExplorerPubkey(
                            hop.pubKey,
                            stores.nodeInfoStore.testnet
                        );
                    }}
                >
                    {loading ? (
                        <LoadingIndicator />
                    ) : (
                        <Text
                            style={{
                                fontSize: 15,
                                color: themeColor('highlight'),
                                fontFamily: 'PPNeueMontreal-Medium'
                            }}
                        >
                            {`${
                                aliasMap.get(hop.pubKey)
                                    ? PrivacyUtils.sensitiveValue(
                                          aliasMap.get(hop.pubKey)
                                      )
                                    : hop.node.length >= 66
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
                    )}
                </TouchableOpacity>
            </Row>

            <View style={{ marginLeft: 50, marginBottom: 15 }}>
                <KeyValue
                    keyValue={localeString('models.Payment.forwarded')}
                    value={<Amount sats={hop.forwarded} toggleable />}
                    sensitive
                />

                <KeyValue
                    keyValue={localeString('models.Payment.fee')}
                    value={<Amount sats={hop.fee} toggleable />}
                    sensitive
                />
            </View>
        </View>
    );
};

interface PaymentPathProps {
    enhancedPath: any;
}

interface PaymentPathState {
    expanded: any;
}

@inject('ChannelsStore')
@observer
export default class PaymentPath extends React.Component<
    PaymentPathProps,
    PaymentPathState
> {
    constructor(props: any) {
        super(props);
        this.state = {
            expanded: new Map()
        };
    }

    render() {
        const { enhancedPath } = this.props;
        const { expanded } = this.state;

        const aliasMap = stores.channelsStore.aliasMap;

        const paths: any = [];
        const updateMap = (k: number, v: boolean) => {
            this.setState({
                expanded: new Map(expanded.set(k, v))
            });
        };
        enhancedPath.map((path: any, index: number) => {
            const hops: any = [];
            let title = '';
            path.map((hop: any, key: number) => {
                const displayName = aliasMap.get(hop.pubKey) || hop.node;
                title +=
                    hop.node.length >= 66
                        ? `${PrivacyUtils.sensitiveValue(displayName).slice(
                              0,
                              6
                          )}...`
                        : PrivacyUtils.sensitiveValue(displayName);
                if (key + 1 !== path.length) {
                    title += ', ';
                }
            });
            if (enhancedPath.length > 1) {
                hops.push(
                    <Hop
                        index={index}
                        title={title}
                        path={path}
                        updateMap={updateMap}
                        expanded={expanded}
                    />
                );
            }
            path.map((hop: any, pathIndex: number) => {
                let loading = false;
                if (!hop.alias && !aliasMap.get(hop.pubKey)) {
                    loading = true;
                    stores.channelsStore.getNodeInfo(hop.pubKey).finally(() => {
                        loading = false;
                    });
                }
                (expanded.get(index) || enhancedPath.length === 1) &&
                    hops.push(
                        <ExpandedHop
                            pathIndex={pathIndex}
                            path={path}
                            hop={hop}
                            aliasMap={aliasMap}
                            loading={loading}
                        />
                    );
            });
            paths.push(hops);
        });

        return <View style={{ marginTop: 20 }}>{paths}</View>;
    }
}
