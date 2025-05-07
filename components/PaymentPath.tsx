import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { observer } from 'mobx-react';

import PrivacyUtils from '../utils/PrivacyUtils';
import { themeColor } from '../utils/ThemeUtils';
import { localeString } from '../utils/LocaleUtils';
import UrlUtils from '../utils/UrlUtils';

import Amount from './Amount';
import KeyValue from './KeyValue';
import { Row } from './layout/Row';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretRight from '../assets/images/SVG/Caret Right.svg';

import { channelsStore, nodeInfoStore } from '../stores/Stores';
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
                            {path.length + 1}
                        </Text>
                    </View>
                </Row>
            </View>
        </TouchableOpacity>
    );
};

const ExpandedHop = (props: any) => {
    const { pathIndex, hop, path, aliasMap, loading } = props;
    const isOrigin = hop.sent != null;
    const isDestination = pathIndex === path.length;
    return (
        <View
            key={pathIndex}
            style={{
                left: 20,
                marginRight: 20,
                borderStyle: 'dotted',
                borderLeftWidth: 3,
                borderColor: isDestination
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
                            nodeInfoStore.testnet
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
                                isOrigin
                                    ? localeString('views.Channel.yourNode')
                                    : aliasMap.get(hop.pubKey)
                                    ? PrivacyUtils.sensitiveValue(
                                          aliasMap.get(hop.pubKey)
                                      )
                                    : typeof hop.node === 'string' &&
                                      hop.node.length >= 66
                                    ? `${
                                          typeof PrivacyUtils.sensitiveValue(
                                              hop.node
                                          ) === 'string'
                                              ? (
                                                    PrivacyUtils.sensitiveValue(
                                                        hop.node
                                                    ) as string
                                                ).slice(0, 14)
                                              : ''
                                      }...${
                                          typeof PrivacyUtils.sensitiveValue(
                                              hop.node
                                          ) === 'string'
                                              ? (
                                                    PrivacyUtils.sensitiveValue(
                                                        hop.node
                                                    ) as string
                                                ).slice(-14)
                                              : ''
                                      }`
                                    : typeof PrivacyUtils.sensitiveValue(
                                          hop.node
                                      ) === 'string'
                                    ? PrivacyUtils.sensitiveValue(hop.node)
                                    : ''
                            }`}
                        </Text>
                    )}
                </TouchableOpacity>
            </Row>

            <View style={{ marginLeft: 50, marginBottom: 15 }}>
                {hop.sent ? (
                    <KeyValue
                        keyValue={localeString('general.sent')}
                        value={<Amount sats={hop.sent} toggleable />}
                        sensitive
                    />
                ) : (
                    <KeyValue
                        keyValue={
                            isDestination
                                ? localeString('general.received')
                                : localeString('models.Payment.forwarded')
                        }
                        value={<Amount sats={hop.forwarded} toggleable />}
                        sensitive
                    />
                )}
                {!isOrigin && !isDestination && (
                    <KeyValue
                        keyValue={localeString('models.Payment.fee')}
                        value={<Amount sats={hop.fee} toggleable />}
                        sensitive
                    />
                )}
            </View>
        </View>
    );
};

interface PaymentPathProps {
    enhancedPath: any[];
}

interface PaymentPathState {
    expanded: any;
}

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

    componentDidMount() {
        this.prefetchAliases(this.props.enhancedPath);
    }

    componentDidUpdate(prevProps: PaymentPathProps) {
        if (prevProps.enhancedPath !== this.props.enhancedPath) {
            this.prefetchAliases(this.props.enhancedPath);
        }
    }

    prefetchAliases(paths: any[]) {
        paths.forEach((path) => {
            path.forEach((hop: any) => {
                const aliasMap = channelsStore.aliasMap;
                if (hop?.pubKey && !hop.alias && !aliasMap.get(hop.pubKey)) {
                    channelsStore.getNodeInfo(hop.pubKey);
                }
            });
        });
    }

    render() {
        const { enhancedPath } = this.props;
        const { expanded } = this.state;

        const aliasMap = channelsStore.aliasMap;
        const ourPubKey = nodeInfoStore.nodeInfo.nodeId;

        const paths: any[] = [];
        const updateMap = (k: number, v: boolean) => {
            this.setState({
                expanded: new Map(expanded.set(k, v))
            });
        };
        enhancedPath.forEach((path: any[], index: number) => {
            const hops: any = [];
            let title = localeString('views.Channel.yourNode');
            path.forEach((hop) => {
                const displayName = aliasMap.get(hop.pubKey) || hop.node;
                title += ', ';
                const sensitiveDisplayName =
                    PrivacyUtils.sensitiveValue(displayName);
                title +=
                    typeof sensitiveDisplayName === 'string' &&
                    sensitiveDisplayName.length >= 66
                        ? `${(sensitiveDisplayName as string).slice(0, 6)}...`
                        : sensitiveDisplayName ?? '';
            });
            if (enhancedPath.length > 1) {
                hops.push(
                    <Hop
                        key={`hop-${index}`}
                        index={index}
                        title={title}
                        path={path}
                        updateMap={updateMap}
                        expanded={expanded}
                    />
                );
            }
            const origin = {
                sent: Number(path[0].forwarded) + Number(path[0].fee),
                pubKey: ourPubKey
            };
            if (expanded.get(index) || enhancedPath.length === 1) {
                hops.push(
                    <ExpandedHop
                        key={`origin-${index}`}
                        pathIndex={0}
                        path={path}
                        hop={origin}
                        aliasMap={aliasMap}
                    />
                );
            }
            path.forEach((hop: any, pathIndex: number) => {
                const loading = !hop.alias && !aliasMap.get(hop.pubKey);
                (expanded.get(index) || enhancedPath.length === 1) &&
                    hops.push(
                        <ExpandedHop
                            key={`hop-${index}-${pathIndex}`}
                            pathIndex={pathIndex + 1}
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
