import * as React from 'react';
import { Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

import QRCodeScanner from './../components/QRCodeScanner';

import NodeUriUtils from './../utils/NodeUriUtils';
import { localeString } from './../utils/LocaleUtils';

interface NodeQRProps {
    navigation: StackNavigationProp<any, any>;
}

function NodeQRScanner(props: NodeQRProps) {
    const { navigation } = props;

    const handleNodeScanned = (data: string) => {
        if (NodeUriUtils.isValidNodeUri(data)) {
            const { pubkey, host } = NodeUriUtils.processNodeUri(data);
            navigation.popTo('OpenChannel', {
                node_pubkey_string: pubkey,
                host
            });
        } else {
            Alert.alert(
                localeString('general.error'),
                localeString('views.NodeQRScanner.error'),
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );

            navigation.goBack();
        }
    };

    return (
        <QRCodeScanner
            handleQRScanned={handleNodeScanned}
            goBack={() => navigation.goBack()}
            navigation={navigation}
        />
    );
}

export default NodeQRScanner;
