import React from 'react';
import { inject, observer } from 'mobx-react';
import { StyleSheet, View } from 'react-native';

import Header from '../components/Header';
import Screen from '../components/Screen';
import TextInput from '../components/TextInput';
import Button from '../components/Button';
import CopyButton from '../components/CopyButton';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import handleAnything from '../utils/handleAnything';

import InvoicesStore from '../stores/InvoicesStore';

interface DonateToZEUSProps {
    navigation: any;
    InvoicesStore: InvoicesStore;
}

@inject('InvoicesStore')
@observer
export default class DonateToZEUS extends React.Component<
    DonateToZEUSProps,
    null
> {
    render() {
        const { navigation } = this.props;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.PaymentRequest.donateToZEUS'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ padding: 20 }}>
                    <TextInput value="tips@pay.zeusln.app" locked />
                    <View style={styles.button}>
                        <Button
                            title={localeString('views.PaymentRequest.donate')}
                            onPress={() => {
                                handleAnything('tips@pay.zeusln.app')
                                    .then((response) => {
                                        try {
                                            if (response) {
                                                const [route, props] = response;
                                                navigation.navigate(
                                                    route,
                                                    props
                                                );
                                            }
                                        } catch (e) {}
                                    })
                                    .catch((err) => {
                                        console.log(
                                            localeString('general.error'),
                                            err
                                        );
                                    });
                            }}
                            icon={{
                                name: 'zap',
                                type: 'feather',
                                color: themeColor('background')
                            }}
                        />
                        <CopyButton
                            title={localeString('views.Receive.copyAddress')}
                            copyValue={'tips@pay.zeusln.app'}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    button: {
        paddingTop: 12,
        paddingBottom: 12,
        width: '100%',
        alignSelf: 'center'
    }
});
