import * as React from 'react';
import {
    BackHandler,
    Dimensions,
    NativeEventSubscription,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { inject, observer } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import LightningLoadingPattern from '../components/LightningLoadingPattern';
import SuccessAnimation from '../components/SuccessAnimation';
import Screen from '../components/Screen';
import CopyBox from '../components/CopyBox';
import PaidIndicator from '../components/PaidIndicator';
import Button from '../components/Button';
import { Row } from '../components/layout/Row';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import Wordmark from '../assets/images/SVG/wordmark-black.svg';
import ErrorIcon from '../assets/images/SVG/ErrorIcon.svg';

import InvoicesStore from '../stores/InvoicesStore';
import NotesStore from '../stores/NotesStore';

interface RedeemWithdrawalRequestProps {
    route: {
        params: {
            invreq: string;
            label: string;
        };
    };
    navigation: StackNavigationProp<any, any>;
    InvoicesStore: InvoicesStore;
    NotesStore: NotesStore;
    invreq: string;
    label: string;
}

interface RedeemWithdrawalRequestState {
    loading: boolean;
    error: string | null;
    redemptionResult: any;
    storedNote: string;
    noteKey: string;
}

@inject('InvoicesStore', 'NotesStore')
@observer
export default class RedeemWithdrawalRequest extends React.Component<
    RedeemWithdrawalRequestProps,
    RedeemWithdrawalRequestState
> {
    private backPressSubscription: NativeEventSubscription;

    constructor(props: RedeemWithdrawalRequestProps) {
        super(props);
        this.state = {
            loading: true,
            error: null,
            redemptionResult: null,
            storedNote: '',
            noteKey: ''
        };
    }

    componentDidMount() {
        const { invreq, label } = this.props.route.params;
        const { NotesStore } = this.props;

        const getNoteKey = `note-${invreq}` || '';
        const noteKey = NotesStore.notes[getNoteKey] || '';

        this.setState({ noteKey });

        this.handleRedemption({ invreq, label });

        this.backPressSubscription = BackHandler.addEventListener(
            'hardwareBackPress',
            this.handleBackPress.bind(this)
        );
    }

    componentWillUnmount(): void {
        this.backPressSubscription?.remove();
    }

    private handleBackPress(): boolean {
        const { navigation } = this.props;
        const { error } = this.state;

        if (!error) {
            navigation.navigate('Wallet');
            return true;
        }

        return false;
    }

    private async handleRedemption({
        invreq,
        label
    }: {
        invreq: string;
        label: string;
    }) {
        try {
            const result =
                await this.props.InvoicesStore.redeemWithdrawalRequest({
                    invreq,
                    label
                });

            this.setState({
                loading: false,
                redemptionResult: result
            });
        } catch (error: any) {
            this.setState({
                loading: false,
                error: error.message || 'Failed to redeem withdrawal request'
            });
        }
    }

    render() {
        const { error, loading, redemptionResult, storedNote, noteKey } =
            this.state;
        const windowSize = Dimensions.get('window');
        const { navigation } = this.props;

        return (
            <Screen>
                {loading && (
                    <View
                        style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%'
                        }}
                    >
                        <LightningLoadingPattern />
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                paddingBottom: windowSize.height / 10,
                                fontSize:
                                    windowSize.width * windowSize.scale * 0.014
                            }}
                        >
                            {localeString(
                                'views.WithdrawalRedemption.redeeming'
                            )}
                        </Text>
                    </View>
                )}

                {!loading && !error && redemptionResult && (
                    <View style={styles.content}>
                        <Wordmark
                            height={windowSize.width * 0.25}
                            width={windowSize.width}
                            fill={themeColor('highlight')}
                            style={{ marginBottom: windowSize.height * 0.02 }}
                        />
                        <PaidIndicator />
                        <View
                            style={{
                                alignItems: 'center',
                                paddingTop: windowSize.height * 0.05
                            }}
                        >
                            <SuccessAnimation />
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    paddingTop: windowSize.height * 0.03,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize:
                                        windowSize.width *
                                        windowSize.scale *
                                        0.017
                                }}
                            >
                                {localeString(
                                    'views.WithdrawalRedemption.success'
                                )}
                            </Text>
                            <View
                                style={{
                                    width: '90%',
                                    paddingTop: windowSize.height * 0.06
                                }}
                            >
                                <CopyBox
                                    heading={localeString(
                                        'views.Invoice.paymentHash'
                                    )}
                                    headingCopied={`${localeString(
                                        'views.Invoice.paymentHash'
                                    )} ${localeString(
                                        'components.ExternalLinkModal.copied'
                                    )}`}
                                    theme="dark"
                                    URL={redemptionResult.payment_hash}
                                />
                            </View>
                        </View>
                    </View>
                )}

                {!loading && error && (
                    <View
                        style={{
                            ...styles.content,
                            height: '80%',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}
                    >
                        <ErrorIcon
                            height={windowSize.width * 0.25}
                            width={windowSize.width}
                            fill={themeColor('highlight')}
                        />
                        <Text
                            style={{
                                color: themeColor('warning'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 32,
                                marginTop: windowSize.height * 0.07
                            }}
                        >
                            {localeString('general.error')}
                        </Text>
                        <View style={{ alignItems: 'center' }}>
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    paddingTop: windowSize.height * 0.03,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize:
                                        windowSize.width *
                                        windowSize.scale *
                                        0.017
                                }}
                            >
                                {error}
                            </Text>
                        </View>
                    </View>
                )}

                {!loading && (error || redemptionResult) && (
                    <View
                        style={{
                            position: 'absolute',
                            bottom: 10,
                            width: '100%',
                            paddingHorizontal: '5%'
                        }}
                    >
                        {!!error && (
                            <Row
                                align="center"
                                style={{
                                    alignSelf: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 20,
                                    width: '100%'
                                }}
                            >
                                <Button
                                    title={localeString(
                                        'views.SendingLightning.tryAgain'
                                    )}
                                    icon={{
                                        name: 'return-up-back',
                                        type: 'ionicon',
                                        size: 25
                                    }}
                                    onPress={() => navigation.goBack()}
                                    buttonStyle={{
                                        backgroundColor: 'white',
                                        height: 40,
                                        width: '100%'
                                    }}
                                    containerStyle={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        alignSelf: 'stretch'
                                    }}
                                    adaptiveWidth
                                />
                            </Row>
                        )}

                        {!!redemptionResult && (
                            <Row
                                align="center"
                                style={{
                                    alignSelf: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 10,
                                    width: '100%'
                                }}
                            >
                                <Button
                                    title={
                                        storedNote
                                            ? localeString(
                                                  'views.SendingLightning.UpdateNote'
                                              )
                                            : localeString(
                                                  'views.SendingLightning.AddANote'
                                              )
                                    }
                                    onPress={() =>
                                        navigation.navigate('AddNotes', {
                                            noteKey
                                        })
                                    }
                                    secondary
                                    adaptiveWidth
                                    buttonStyle={{
                                        height: 40,
                                        width: '100%'
                                    }}
                                    containerStyle={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        alignSelf: 'stretch'
                                    }}
                                />
                            </Row>
                        )}

                        <Row
                            align="center"
                            style={{
                                alignSelf: 'center',
                                justifyContent: 'center',
                                width: '100%'
                            }}
                        >
                            <Button
                                title={localeString(
                                    'views.SendingLightning.goToWallet'
                                )}
                                icon={{
                                    name: 'list',
                                    size: 25,
                                    color: themeColor('background')
                                }}
                                onPress={() => {
                                    navigation.popTo('Wallet');
                                }}
                                buttonStyle={{
                                    height: 40,
                                    width: '100%'
                                }}
                                titleStyle={{
                                    color: themeColor('background')
                                }}
                                containerStyle={{
                                    width: '100%',
                                    maxWidth: '100%',
                                    alignSelf: 'stretch'
                                }}
                                adaptiveWidth
                            />
                        </Row>
                    </View>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: Dimensions.get('window').height * 0.12,
        width: '100%'
    }
});
