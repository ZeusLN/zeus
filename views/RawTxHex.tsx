import * as React from 'react';
import { View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import {
    SuccessMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Button from '../components/Button';
import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import { nodeInfoStore } from '../stores/Stores';
import TransactionsStore from '../stores/TransactionsStore';

interface RawTxHexProps {
    navigation: StackNavigationProp<any, any>;
    TransactionsStore: TransactionsStore;
    route: Route<
        'RawTxHex',
        {
            value: string;
            hideText: boolean;
            logo: any;
        }
    >;
}

interface RawTxHexState {
    value: string;
    hideText: boolean;
    logo: any;
}

@inject('TransactionsStore')
@observer
export default class RawTxHex extends React.PureComponent<
    RawTxHexProps,
    RawTxHexState
> {
    constructor(props: RawTxHexProps) {
        super(props);

        const value = props.route.params?.value ?? '';
        const { hideText, logo } = props.route.params ?? {};

        this.state = {
            value,
            hideText,
            logo
        };
    }

    render() {
        const { navigation, TransactionsStore } = this.props;
        const { value, hideText, logo } = this.state;
        const {
            broadcastRawTxToMempoolSpace,
            broadcast_txid,
            broadcast_err,
            loading
        } = TransactionsStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Transaction.rawTxHex'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        top: 5,
                        padding: 15,
                        alignItems: 'center'
                    }}
                >
                    <CollapsedQR
                        value={value}
                        textBottom
                        hideText={hideText}
                        logo={logo}
                    />
                    <Button
                        title={localeString(
                            'views.RawTxHex.broadcastToMempoolSpace'
                        )}
                        onPress={() => broadcastRawTxToMempoolSpace(value)}
                    />
                    {loading && <LoadingIndicator />}
                    {broadcast_txid && (
                        <SuccessMessage
                            message={broadcast_txid}
                            onPress={() =>
                                UrlUtils.goToBlockExplorerTXID(
                                    broadcast_txid,
                                    nodeInfoStore.nodeInfo.isTestNet
                                )
                            }
                        />
                    )}
                    {broadcast_err && <ErrorMessage message={broadcast_err} />}
                </View>
            </Screen>
        );
    }
}
