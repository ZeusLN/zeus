import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../../components/Button';
import Screen from '../../../components/Screen';
import Text from '../../../components/Text';
import Header from '../../../components/Header';
import LoadingIndicator from '../../../components/LoadingIndicator';
import TextInput from '../../../components/TextInput';
import { ErrorMessage } from '../../../components/SuccessErrorMessage';
import { Row } from '../../../components/layout/Row';

import CashuLightningAddressStore from '../../../stores/CashuLightningAddressStore';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

interface CashuChangeAddressProps {
    navigation: StackNavigationProp<any, any>;
    CashuLightningAddressStore: CashuLightningAddressStore;
}

interface CashuChangeAddressState {
    newLightningAddress: string;
    currentLightningAddress: string;
}

@inject('CashuLightningAddressStore')
@observer
export default class CashuChangeAddress extends React.Component<
    CashuChangeAddressProps,
    CashuChangeAddressState
> {
    state = {
        newLightningAddress: '',
        currentLightningAddress: ''
    };

    async UNSAFE_componentWillMount() {
        const { CashuLightningAddressStore } = this.props;
        const { cashuLightningAddressHandle } = CashuLightningAddressStore;

        this.setState({
            newLightningAddress: cashuLightningAddressHandle,
            currentLightningAddress: cashuLightningAddressHandle
        });
    }

    render() {
        const { navigation, CashuLightningAddressStore } = this.props;
        const { newLightningAddress, currentLightningAddress } = this.state;
        const { update, error_msg, loading } = CashuLightningAddressStore;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.LightningAddress.ChangeAddress'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <View style={{ flex: 1, margin: 5 }}>
                        {loading && <LoadingIndicator />}
                        {!loading && !!error_msg && (
                            <ErrorMessage message={error_msg} dismissable />
                        )}
                        {!loading && (
                            <>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.wrapper}>
                                        <Text
                                            style={{
                                                ...styles.text,
                                                color: themeColor('text')
                                            }}
                                        >
                                            {localeString(
                                                'views.Settings.LightningAddress.chooseHandle'
                                            )}
                                        </Text>
                                        <View
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'row'
                                            }}
                                        >
                                            <TextInput
                                                value={newLightningAddress}
                                                onChangeText={(
                                                    text: string
                                                ) => {
                                                    this.setState({
                                                        newLightningAddress:
                                                            text
                                                    });
                                                }}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                style={{
                                                    flex: 1,
                                                    flexDirection: 'row'
                                                }}
                                            />
                                            <Row>
                                                <Text
                                                    style={{
                                                        ...styles.text,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        fontSize: 20,
                                                        marginLeft: 5
                                                    }}
                                                >
                                                    @zeusnuts.com
                                                </Text>
                                            </Row>
                                        </View>
                                    </View>
                                </View>
                                <View>
                                    <View style={{ bottom: 15, margin: 10 }}>
                                        <Button
                                            title={localeString(
                                                'views.Settings.LightningAddress.change'
                                            )}
                                            onPress={() => {
                                                try {
                                                    update({
                                                        handle: newLightningAddress
                                                    }).then(() =>
                                                        navigation.popTo(
                                                            'CashuLightningAddress'
                                                        )
                                                    );
                                                } catch (e) {}
                                            }}
                                            disabled={
                                                !newLightningAddress ||
                                                newLightningAddress ===
                                                    currentLightningAddress
                                            }
                                        />
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    wrapper: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 15,
        paddingRight: 15
    }
});
