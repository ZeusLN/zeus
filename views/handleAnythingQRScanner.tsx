import * as React from 'react';
import { Alert, View } from 'react-native';
import { Header } from 'react-native-elements';
import { observer } from 'mobx-react';

import QRCodeScanner from '../components/QRCodeScanner';

import handleAnything from '../utils/handleAnything';
import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import LoadingIndicator from '../components/LoadingIndicator';

interface handleAnythingQRProps {
    navigation: any;
}

interface handleAnythingQRState {
    loading: boolean;
}

@observer
export default class handleAnythingQRScanner extends React.Component<
    handleAnythingQRProps,
    handleAnythingQRState
> {
    constructor(props: any) {
        super(props);

        this.state = {
            loading: false
        };
    }

    handleAnythingScanned = async (data: string) => {
        const { navigation } = this.props;
        this.setState({
            loading: true
        });
        handleAnything(data)
            .then((response) => {
                this.setState({
                    loading: false
                });
                if (response) {
                    const [route, props] = response;
                    navigation.goBack();
                    navigation.navigate(route, props);
                } else {
                    navigation.goBack();
                }
            })
            .catch((err) => {
                Alert.alert(
                    localeString('general.error'),
                    err.message,
                    [
                        {
                            text: localeString('general.ok'),
                            onPress: () => void 0
                        }
                    ],
                    { cancelable: false }
                );

                this.setState({
                    loading: false
                });

                navigation.goBack();
            });
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
                handleQRScanned={this.handleAnythingScanned}
                goBack={() => navigation.goBack()}
                navigation={navigation}
            />
        );
    }
}
