import * as React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { observer } from 'mobx-react';
import { LNURLWithdrawParams } from 'js-lnurl';

import Amount from './Amount';
import ModalBox from './ModalBox';
import OnchainFeeInput from './OnchainFeeInput';

import CaretDown from '../assets/images/SVG/Caret Down.svg';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import BackendUtils from '../utils/BackendUtils';

interface FeeEstimateProps {
    satAmount: string;
    lightning?: string;
    lnurlParams?: LNURLWithdrawParams;
    lightningEstimateFee?: number;
    ecashEstimateFee?: number;
    visible?: boolean;
    /** When true, shows OnchainFeeInput for onchain payments */
    showOnchainFeeInput?: boolean;
    feeRate?: string;
    onChangeFee?: (fee: string) => void;
    navigation?: StackNavigationProp<any, any>;
}

interface FeeEstimateState {
    showModal: boolean;
}

@observer
export default class FeeEstimate extends React.PureComponent<
    FeeEstimateProps,
    FeeEstimateState
> {
    state: FeeEstimateState = {
        showModal: false
    };

    renderFeeRow = (label: string, fee?: number, total?: number) => (
        <View style={styles.feeRow}>
            <View style={styles.cell}>
                <Text style={[styles.label, { color: themeColor('text') }]}>
                    {label}
                </Text>
            </View>
            <View style={styles.cell}>
                {fee !== undefined ? (
                    <Amount
                        sats={fee}
                        sensitive={false}
                        colorOverride={themeColor('bitcoin')}
                    />
                ) : (
                    <Text
                        style={[
                            styles.placeholder,
                            { color: themeColor('secondaryText') }
                        ]}
                    >
                        -
                    </Text>
                )}
            </View>
            <View style={styles.cell}>
                {total !== undefined ? (
                    <Amount sats={total} sensitive={false} />
                ) : (
                    <Text
                        style={[
                            styles.placeholder,
                            { color: themeColor('secondaryText') }
                        ]}
                    >
                        -
                    </Text>
                )}
            </View>
        </View>
    );

    render() {
        const {
            satAmount,
            lightning,
            lnurlParams,
            lightningEstimateFee,
            ecashEstimateFee,
            visible = true,
            showOnchainFeeInput,
            feeRate,
            onChangeFee,
            navigation
        } = this.props;

        const windowHeight = Dimensions.get('window').height;
        const modalMaxHeight = Math.min(
            Math.max(windowHeight * (showOnchainFeeInput ? 0.45 : 0.3), 280),
            300
        );
        const { showModal } = this.state;

        if (!satAmount) return null;
        if (!visible) return null;

        const feeContent = (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerSpacer} />
                    <View style={styles.headerCell}>
                        <Text
                            style={[
                                styles.headerText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {localeString('views.PaymentRequest.feeEstimate')}
                        </Text>
                    </View>
                    <View style={styles.headerCell}>
                        <Text
                            style={[
                                styles.headerText,
                                { color: themeColor('secondaryText') }
                            ]}
                        >
                            {localeString(
                                'components.NWCPendingPayInvoiceModal.totalAmount'
                            )}
                        </Text>
                    </View>
                </View>
                {this.renderFeeRow(
                    localeString('general.lightning'),
                    lightningEstimateFee,
                    lightningEstimateFee !== undefined
                        ? Number(satAmount) +
                              (Number(lightningEstimateFee) || 0)
                        : undefined
                )}
                {BackendUtils.supportsCashuWallet() &&
                    (lightning || lnurlParams) &&
                    this.renderFeeRow(
                        localeString('general.ecash'),
                        ecashEstimateFee,
                        ecashEstimateFee !== undefined
                            ? Number(satAmount) +
                                  (Number(ecashEstimateFee) || 0)
                            : undefined
                    )}
                {showOnchainFeeInput &&
                    BackendUtils.supportsOnchainReceiving() &&
                    navigation &&
                    onChangeFee && (
                        <View style={styles.onchainFeeSection}>
                            <Text
                                style={[
                                    styles.onchainFeeLabel,
                                    {
                                        color: themeColor('secondaryText')
                                    }
                                ]}
                            >
                                {localeString('general.onchain')}{' '}
                                {localeString('views.Send.feeSatsVbyte')}
                            </Text>
                            <OnchainFeeInput
                                fee={feeRate}
                                onChangeFee={onChangeFee}
                                navigation={navigation}
                            />
                        </View>
                    )}
            </View>
        );

        return (
            <>
                <View style={styles.triggerSection}>
                    <TouchableOpacity
                        onPress={() => this.setState({ showModal: true })}
                        style={[
                            styles.triggerButton,
                            {
                                backgroundColor: themeColor('secondary')
                            }
                        ]}
                    >
                        <Text
                            style={[
                                styles.triggerText,
                                { color: themeColor('text') }
                            ]}
                        >
                            {localeString('views.PaymentRequest.feeEstimate')}
                        </Text>
                        <CaretDown
                            fill={themeColor('text')}
                            width="16"
                            height="16"
                        />
                    </TouchableOpacity>
                </View>
                <ModalBox
                    style={[
                        styles.modal,
                        {
                            maxHeight: modalMaxHeight,
                            backgroundColor: themeColor('background')
                        }
                    ]}
                    swipeToClose={true}
                    backButtonClose={true}
                    backdropPressToClose={true}
                    backdrop={true}
                    position="bottom"
                    isOpen={showModal}
                    onClosed={() => this.setState({ showModal: false })}
                >
                    <View>
                        <Text
                            style={[
                                styles.modalTitle,
                                { color: themeColor('text') }
                            ]}
                        >
                            {localeString('views.PaymentRequest.feeEstimate')}
                        </Text>
                        {feeContent}
                    </View>
                </ModalBox>
            </>
        );
    }
}

const styles = StyleSheet.create({
    triggerSection: {
        paddingHorizontal: 20,
        paddingVertical: 15
    },
    triggerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 20
    },
    triggerText: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 16,
        marginRight: 8
    },
    modal: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 40
    },
    modalTitle: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 18,
        marginBottom: 20,
        textAlign: 'center'
    },
    container: { paddingTop: 0 },
    header: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingBottom: 8
    },
    headerSpacer: { flex: 1 },
    headerCell: { flex: 1, alignItems: 'center' },
    headerText: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12,
        textTransform: 'uppercase'
    },
    feeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10
    },
    label: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14
    },
    cell: {
        flex: 1,
        alignItems: 'center'
    },
    placeholder: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 12
    },
    onchainFeeSection: {
        paddingTop: 20
    },
    onchainFeeLabel: {
        fontFamily: 'PPNeueMontreal-Book',
        fontSize: 14,
        marginBottom: 5
    }
});
