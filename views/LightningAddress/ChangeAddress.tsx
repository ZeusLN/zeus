import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import Button from '../../components/Button';
import DropdownSetting from '../../components/DropdownSetting';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import TextInput from '../../components/TextInput';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';

import LightningAddressStore, {
    ZEUS_PAY_DOMAIN_KEYS
} from '../../stores/LightningAddressStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface ChangeAddressProps {
    navigation: StackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
}

interface ChangeAddressState {
    newLightningAddress: string;
    currentLightningAddress: string;
    newLightningDomain: string;
    currentLightningDomain: string;
}

@inject('LightningAddressStore')
@observer
export default class ChangeAddress extends React.Component<
    ChangeAddressProps,
    ChangeAddressState
> {
    state = {
        newLightningAddress: '',
        currentLightningAddress: '',
        newLightningDomain: '',
        currentLightningDomain: ''
    };

    async UNSAFE_componentWillMount() {
        const { LightningAddressStore } = this.props;
        const { lightningAddressHandle, lightningAddressDomain } =
            LightningAddressStore;

        this.setState({
            newLightningAddress: lightningAddressHandle,
            currentLightningAddress: lightningAddressHandle,
            newLightningDomain: lightningAddressDomain,
            currentLightningDomain: lightningAddressDomain
        });
    }

    render() {
        const { navigation, LightningAddressStore } = this.props;
        const {
            newLightningAddress,
            currentLightningAddress,
            newLightningDomain,
            currentLightningDomain
        } = this.state;
        const { update, error_msg, loading } = LightningAddressStore;

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
                                        <Row
                                            style={{
                                                width: '100%',
                                                gap: 5,
                                                alignItems: 'flex-start',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <View style={{ width: '46%' }}>
                                                <Text
                                                    style={{
                                                        ...styles.text,
                                                        color: themeColor(
                                                            'text'
                                                        )
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
                                                        value={
                                                            newLightningAddress
                                                        }
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
                                                </View>
                                            </View>
                                            <View style={{ width: '8%' }}>
                                                <Text
                                                    style={{
                                                        ...styles.text,
                                                        color: themeColor(
                                                            'text'
                                                        ),
                                                        top: 38,
                                                        fontSize: 30
                                                    }}
                                                >
                                                    @
                                                </Text>
                                            </View>
                                            <View style={{ width: '46%' }}>
                                                <DropdownSetting
                                                    title="Domain"
                                                    titleColor={themeColor(
                                                        'text'
                                                    )}
                                                    selectedValue={
                                                        newLightningDomain
                                                    }
                                                    values={
                                                        ZEUS_PAY_DOMAIN_KEYS
                                                    }
                                                    onValueChange={(value) => {
                                                        this.setState({
                                                            newLightningDomain:
                                                                value
                                                        });
                                                    }}
                                                />
                                            </View>
                                        </Row>
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
                                                        handle: newLightningAddress,
                                                        domain: newLightningDomain
                                                    }).then(() =>
                                                        navigation.popTo(
                                                            'LightningAddress'
                                                        )
                                                    );
                                                } catch (e) {}
                                            }}
                                            disabled={
                                                !newLightningAddress ||
                                                (newLightningAddress ===
                                                    currentLightningAddress &&
                                                    newLightningDomain ===
                                                        currentLightningDomain)
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
