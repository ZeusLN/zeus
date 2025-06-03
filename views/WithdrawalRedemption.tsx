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

interface WithdrawalRedemptionProps {
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

interface WithdrawalRedemptionState {
    loading: boolean;
    error: string | null;
    redemptionResult: any;
    storedNote: string;
    noteKey: string;
}

@inject('InvoicesStore', 'NotesStore')
@observer
export default class WithdrawalRedemption extends React.Component<
    WithdrawalRedemptionProps,
    WithdrawalRedemptionState
> {
    private backPressSubscription: NativeEventSubscription;

    constructor(props: WithdrawalRedemptionProps) {
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
                    <View
                        style={{
                            ...styles.content,
                            paddingTop: windowSize.height * 0.15
                        }}
                    >
                        {(!loading || !error) && (
                            <Wordmark
                                height={windowSize.width * 0.25}
                                width={windowSize.width}
                                fill={themeColor('highlight')}
                            />
                        )}
                        {!loading && !error && (
                            <>
                                <PaidIndicator />
                                <View
                                    style={{
                                        alignItems: 'center',
                                        paddingTop: windowSize.height * 0.1
                                    }}
                                >
                                    <SuccessAnimation />
                                    <Text
                                        style={{
                                            color: themeColor('text'),
                                            paddingTop:
                                                windowSize.height * 0.03,
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
                                            paddingTop: windowSize.height * 0.1
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
                            </>
                        )}
                    </View>
                )}

                {!loading && error && (
                    <View
                        style={{
                            ...styles.content,
                            paddingTop: windowSize.height * 0.05
                        }}
                    >
                        <ErrorIcon
                            height={windowSize.width * 0.25}
                            width={windowSize.width}
                            fill={themeColor('highlight')}
                        />
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

                {(!!error || !!redemptionResult) && (
                    <>
                        <Row
                            align="center"
                            style={{
                                alignSelf: 'center',
                                justifyContent: 'center',
                                marginTop: 50,
                                marginBottom: 15,
                                width: '90%'
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
                        <Row
                            align="center"
                            style={{
                                alignSelf: 'center',
                                justifyContent: 'center',
                                width: '90%'
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
                    </>
                )}
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
    }
});
