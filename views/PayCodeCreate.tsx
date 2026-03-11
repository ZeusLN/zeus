import * as React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/Button';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Switch from '../components/Switch';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { ErrorMessage } from '../components/SuccessErrorMessage';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import OffersStore from '../stores/OffersStore';

interface PayCodeCreateProps {
    navigation: NativeStackNavigationProp<any, any>;
    OffersStore: OffersStore;
}

interface PayCodeCreateState {
    description: string;
    label: string;
    singleUse: boolean;
}

@inject('OffersStore')
@observer
export default class PayCodeCreateView extends React.Component<
    PayCodeCreateProps,
    PayCodeCreateState
> {
    constructor(props: PayCodeCreateProps) {
        super(props);
        this.state = {
            description: '',
            label: '',
            singleUse: false
        };
    }

    render() {
        const { navigation, OffersStore } = this.props;
        const { description, label, singleUse } = this.state;
        const { loading, error_msg } = OffersStore;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.PayCode.createOffer'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />

                <ScrollView
                    style={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    {error_msg && <ErrorMessage message={error_msg} />}

                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('secondaryText')
                        }}
                    >
                        {localeString('views.PaymentRequest.description')}
                    </Text>
                    <TextInput
                        placeholder={'Offer for...'}
                        value={description}
                        onChangeText={(text: string) =>
                            this.setState({ description: text })
                        }
                        locked={loading}
                    />

                    <Text
                        style={{
                            fontFamily: 'PPNeueMontreal-Book',
                            color: themeColor('secondaryText')
                        }}
                    >
                        {`${localeString(
                            'views.PayCode.internalLabel'
                        )} (${localeString('general.optional')})`}
                    </Text>
                    <TextInput
                        placeholder={'My pay code'}
                        value={label}
                        onChangeText={(text: string) =>
                            this.setState({ label: text })
                        }
                        locked={loading}
                    />

                    <>
                        <Text
                            style={{
                                top: 25,
                                color: themeColor('secondaryText')
                            }}
                        >
                            {localeString('views.PayCode.singleUse')}
                        </Text>
                        <Switch
                            value={singleUse}
                            onValueChange={() => {
                                this.setState({
                                    singleUse: !singleUse
                                });
                            }}
                        />
                    </>
                </ScrollView>
                <View style={{ bottom: 15 }}>
                    {loading && <LoadingIndicator />}
                    {!loading && (
                        <Button
                            title={localeString('views.PayCode.createOffer')}
                            onPress={() => {
                                OffersStore.createOffer({
                                    description,
                                    label,
                                    singleUse
                                }).then(() => {
                                    // OffersStore.listOffers();
                                    navigation.pop();
                                });
                            }}
                        />
                    )}
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20
    },
    center: {
        alignItems: 'center',
        paddingTop: 15,
        paddingBottom: 15
    }
});
