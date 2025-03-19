import * as React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { CashuMint } from '@cashu/cashu-ts';

import Button from '../../components/Button';
import Header from '../../components/Header';
import LoadingIndicator from '../../components/LoadingIndicator';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import TextInput from '../../components/TextInput';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';
import UrlUtils from '../../utils/UrlUtils';

import CashuStore from '../../stores/CashuStore';

interface AddMintProps {
    navigation: StackNavigationProp<any, any>;
    CashuStore: CashuStore;
    route: Route<'AddMint'>;
}

interface AddMintState {
    mintUrl: string;
    loading: boolean;
    error: boolean;
}

@inject('CashuStore')
@observer
export default class AddMint extends React.Component<
    AddMintProps,
    AddMintState
> {
    listener: any;
    constructor(props: any) {
        super(props);
        this.state = {
            mintUrl: 'https://mint.coinos.io',
            loading: false,
            error: false
        };
    }

    getMintInfo = async () => {
        const { mintUrl } = this.state;
        this.setState({
            loading: true
        });
        try {
            const mint = new CashuMint(mintUrl);
            const mintInfo = await mint.getInfo();
            this.props.navigation.navigate('Mint', {
                mint: { ...mintInfo, mintUrl },
                lookup: true
            });
        } catch (e) {
            this.setState({
                error: true
            });
        } finally {
            this.setState({
                loading: false
            });
        }
    };

    render() {
        const { navigation } = this.props;
        const { mintUrl, loading, error } = this.state;

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Cashu.AddMint.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        loading ? (
                            <Row>
                                <LoadingIndicator size={30} />
                            </Row>
                        ) : undefined
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={{
                        flex: 1
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.content}>
                        {error && (
                            <ErrorMessage
                                message={localeString('general.error')}
                            />
                        )}

                        <>
                            <Text
                                style={{
                                    ...styles.text,
                                    color: themeColor('secondaryText')
                                }}
                            >
                                {localeString('cashu.mintUrl')}
                            </Text>
                            <TextInput
                                placeholder={'https://'}
                                value={mintUrl}
                                onChangeText={(text: string) =>
                                    this.setState({
                                        mintUrl: text,
                                        error: false
                                    })
                                }
                                locked={false}
                            />
                        </>

                        <View style={{ ...styles.button, paddingTop: 20 }}>
                            <Button
                                title={localeString(
                                    'views.Cashu.AddMint.title'
                                )}
                                onPress={() => {
                                    this.getMintInfo();
                                }}
                                disabled={loading}
                            />
                        </View>

                        <View style={{ ...styles.button, paddingTop: 10 }}>
                            <Button
                                title={localeString('views.Cashu.AddMint.find')}
                                onPress={() => {
                                    UrlUtils.goToUrl(
                                        'https://bitcoinmints.com/'
                                    );
                                }}
                                disabled={loading}
                                tertiary
                            />
                        </View>
                    </View>
                </ScrollView>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    text: {
        fontFamily: 'PPNeueMontreal-Book'
    },
    content: {
        paddingTop: 20,
        paddingBottom: 20,
        paddingLeft: 10,
        paddingRight: 10
    },
    button: {
        paddingTop: 10,
        paddingBottom: 10
    }
});
