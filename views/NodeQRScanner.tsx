import * as React from 'react';
import { Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import QRCodeScanner from './../components/QRCodeScanner';

import NodeUriUtils from './../utils/NodeUriUtils';
import { localeString } from './../utils/LocaleUtils';

interface NodeQRProps {
    navigation: NativeStackNavigationProp<any, any>;
}

function NodeQRScanner(props: NodeQRProps) {
    const { navigation } = props;
    const isProcessing = React.useRef(false);

    const handleNodeScanned = (data: string) => {
        if (isProcessing.current) return;
        isProcessing.current = true;

        if (NodeUriUtils.isValidNodeUri(data)) {
            const { pubkey, host } = NodeUriUtils.processNodeUri(data);
            navigation.popTo('OpenChannel', {
                node_pubkey_string: pubkey,
                host
            });
        } else {
            isProcessing.current = false;
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
