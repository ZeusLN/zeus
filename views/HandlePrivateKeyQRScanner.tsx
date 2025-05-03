import * as React from 'react';
import { Alert, View } from 'react-native';
import { Header } from 'react-native-elements';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import LoadingIndicator from '../components/LoadingIndicator';
import QRCodeScanner from '../components/QRCodeScanner';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import NodeInfoStore from '../stores/NodeInfoStore';
import SweepStore from '../stores/SweepStore';

interface HandlePrivateKeyQRProps {
    navigation: StackNavigationProp<any, any>;
    NodeInfoStore: NodeInfoStore;
    SweepStore: SweepStore;
}

interface HandlePrivateKeyQRState {
    loading: boolean;
}

@inject('NodeInfoStore', 'SweepStore')
@observer
export default class HandlePrivateKeyQRScanner extends React.Component<
    HandlePrivateKeyQRProps,
    HandlePrivateKeyQRState
> {
    state: HandlePrivateKeyQRState = {
        loading: false
    };

    handlePrivateKeyScanned = async (data: string) => {
        const { navigation, SweepStore } = this.props;

        this.setState({ loading: true });

        try {
            const isValid = SweepStore.isValidWif(data);

            if (isValid) {
                navigation.navigate('Wif', { p: data });
            } else {
                Alert.alert(
                    localeString('general.error'),
                    SweepStore.sweepErrorMsg ||
                        localeString('views.Wif.invalidWif'),
                    [
                        {
                            text: localeString('general.ok'),
                            onPress: () => void 0
                        }
                    ],
                    { cancelable: false }
                );
            }
        } catch (err: any) {
            Alert.alert(
                localeString('general.error'),
                err.message,
                [{ text: localeString('general.ok'), onPress: () => void 0 }],
                { cancelable: false }
            );
        } finally {
            this.setState({ loading: false });
            navigation.goBack();
        }
    };

    render() {
        const { navigation } = this.props;
        const { loading } = this.state;

        if (loading) {
            return (
                <View
                    style={{
                        flex: 1,
                        backgroundColor: themeColor('background')
                    }}
                >
                    <Header
                        centerComponent={{
                            text: localeString('general.loading'),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        backgroundColor={themeColor('background')}
                        containerStyle={{
                            borderBottomWidth: 0
                        }}
                    />
                    <View style={{ top: 40 }}>
                        <LoadingIndicator />
                    </View>
                </View>
            );
        }

        return (
            <QRCodeScanner
                handleQRScanned={this.handlePrivateKeyScanned}
                goBack={() => {
                    navigation.goBack();
                }}
                navigation={navigation}
            />
        );
    }
}
