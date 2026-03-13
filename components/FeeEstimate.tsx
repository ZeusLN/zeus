import * as React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { inject, observer } from 'mobx-react';
import { LNURLWithdrawParams } from 'js-lnurl';

import Amount from './Amount';
import LoadingIndicator from './LoadingIndicator';
import ModalBox from './ModalBox';
import OnchainFeeInput from './OnchainFeeInput';

import CaretDown from '../assets/images/SVG/Caret Down.svg';
import CaretUp from '../assets/images/SVG/Caret Up.svg';

import InvoicesStore from '../stores/InvoicesStore';
import CashuStore from '../stores/CashuStore';
import { feeStore, settingsStore } from '../stores/Stores';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import BackendUtils from '../utils/BackendUtils';

interface FeeEstimateProps {
    satAmount: string;
    lightning?: string;
    lnurlParams?: LNURLWithdrawParams;
    visible?: boolean;
    showOnchainFeeInput?: boolean;
    onFeeChange?: (fee: string) => void;
    feeRate?: string;
    navigation?: NativeStackNavigationProp<any, any>;
    InvoicesStore?: InvoicesStore;
    CashuStore?: CashuStore;
}

interface FeeEstimateState {
    showModal: boolean;
    feeRate: string;
}
const FeeCell = ({
    value,
    loading,
    color
}: {
    value?: number;
    loading?: boolean;
    color?: string;
}) => (
    <View style={styles.cell}>
        {loading ? (
            <LoadingIndicator size={22} />
        ) : value !== undefined ? (
            <Amount sats={value} sensitive={false} colorOverride={color} />
        ) : (
            <Text
                style={[
                    styles.placeholder,
                    { color: themeColor('secondaryText') }
                ]}
            >
                {localeString('general.notAvailable')}
            </Text>
        )}
    </View>
);

@inject('InvoicesStore', 'CashuStore')
@observer
export default class FeeEstimate extends React.PureComponent<
    FeeEstimateProps,
    FeeEstimateState
> {
    state: FeeEstimateState = {
        showModal: false,
        feeRate: ''
    };

    private getDisplayedFeeRate(feeRateProp?: string): string {
        if (feeRateProp) return feeRateProp;
        if (this.state.feeRate) return this.state.feeRate;

        const preferredRate =
            settingsStore?.settings?.payments?.preferredMempoolRate ??
            'fastestFee';
        const fee =
            feeStore?.recommendedFees?.[preferredRate] ??
            feeStore?.recommendedFees?.fastestFee;

        return fee != null ? String(fee) : '';
    }

    private renderFeeRow(
        label: string,
        fee?: number,
        total?: number,
        loading?: boolean
    ) {
        return (
            <View style={styles.feeRow}>
                <View style={styles.cell}>
                    <Text style={[styles.label, { color: themeColor('text') }]}>
                        {label}
                    </Text>
                </View>
                <FeeCell
                    value={fee}
                    loading={loading}
                    color={themeColor('bitcoin')}
                />
                <FeeCell
                    value={
                        total !== undefined
                            ? total
                            : fee !== undefined
                            ? Number(this.props.satAmount) + (Number(fee) || 0)
                            : undefined
                    }
                    loading={loading}
                />
            </View>
        );
    }

    private renderFeeContent(displayedFeeRate: string) {
        const {
            satAmount,
            lightning,
            lnurlParams,
            showOnchainFeeInput,
            onFeeChange,
            navigation,
            InvoicesStore,
            CashuStore
        } = this.props;

        const isLightningPayment = !!(lightning || lnurlParams);
        const lightningFee = InvoicesStore?.feeEstimate ?? undefined;
        const ecashFee = CashuStore?.feeEstimate ?? undefined;
        const lightningLoading =
            isLightningPayment &&
            !!(InvoicesStore?.loading || InvoicesStore?.loadingFeeEstimate);
        const ecashLoading =
            isLightningPayment &&
            BackendUtils.supportsCashuWallet() &&
            !!CashuStore?.loading;

        const satNum = Number(satAmount);

        return (
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
                    lightningFee,
                    lightningFee !== undefined
                        ? satNum + (Number(lightningFee) || 0)
                        : undefined,
                    lightningLoading
                )}

                {BackendUtils.supportsCashuWallet() &&
                    isLightningPayment &&
                    this.renderFeeRow(
                        localeString('general.ecash'),
                        ecashFee,
                        ecashFee !== undefined
                            ? satNum + (Number(ecashFee) || 0)
                            : undefined,
                        ecashLoading
                    )}

                {showOnchainFeeInput &&
                    BackendUtils.supportsOnchainReceiving() &&
                    navigation && (
                        <View style={styles.onchainFeeSection}>
                            <Text
                                style={[
                                    styles.onchainFeeLabel,
                                    { color: themeColor('secondaryText') }
                                ]}
                            >
                                {localeString('general.onchain')}{' '}
                                {localeString('views.Send.feeSatsVbyte')}
                            </Text>
                            <OnchainFeeInput
                                fee={displayedFeeRate}
                                onChangeFee={(text: string) => {
                                    this.setState({ feeRate: text });
                                    onFeeChange?.(text);
                                }}
                                navigation={navigation}
                            />
                        </View>
                    )}
            </View>
        );
    }

    render() {
        const {
            satAmount,
            visible = true,
            showOnchainFeeInput,
            feeRate: feeRateProp
        } = this.props;
        const { showModal } = this.state;

        if (!satAmount || !visible) return null;

        const displayedFeeRate = this.getDisplayedFeeRate(feeRateProp);
        const windowHeight = Dimensions.get('window').height;
        const modalMaxHeight = showOnchainFeeInput
            ? Math.min(Math.max(windowHeight * 0.45, 280), 300)
            : Math.min(Math.max(windowHeight * 0.25, 200), 260);

        return (
            <>
                <View style={styles.triggerSection}>
                    <TouchableOpacity
                        onPress={() => this.setState({ showModal: true })}
                        style={[
                            styles.triggerButton,
                            { backgroundColor: themeColor('secondary') }
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
                        <CaretUp
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
                    swipeToClose
                    backButtonClose
                    backdropPressToClose
                    backdrop
                    position="bottom"
                    isOpen={showModal}
                    onClosed={() => this.setState({ showModal: false })}
                >
                    <View>
                        <TouchableOpacity
                            style={styles.modalHeader}
                            onPress={() => this.setState({ showModal: false })}
                            activeOpacity={0.7}
                        >
                            <Text
                                style={[
                                    styles.modalTitle,
                                    { color: themeColor('text') }
                                ]}
                            >
                                {localeString(
                                    'views.PaymentRequest.feeEstimate'
                                )}
                            </Text>
                            <CaretDown
                                fill={themeColor('text')}
                                width="16"
                                height="16"
                            />
                        </TouchableOpacity>
                        {this.renderFeeContent(displayedFeeRate)}
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
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        gap: 8
    },
    modalTitle: {
        fontFamily: 'PPNeueMontreal-Medium',
        fontSize: 18,
        textAlign: 'center'
    },
    container: {
        paddingTop: 0
    },
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
