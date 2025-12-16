import React from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    Linking,
    Platform
} from 'react-native';
import { inject, observer } from 'mobx-react';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ModalBox from '../ModalBox';

import { localeString } from '../../utils/LocaleUtils';

import ModalStore from '../../stores/ModalStore';

interface RatingModalProps {
    ModalStore?: ModalStore;
}

const APP_STORE_ID = '1456038895';

type ViewState = 'initial' | 'low_rating' | 'high_rating';

@inject('ModalStore')
@observer
export default class RatingModal extends React.Component<RatingModalProps, {}> {
    state = {
        rating: 0,
        viewState: 'initial' as ViewState
    };

    handleRating = async (score: number) => {
        this.setState({ rating: score });

        setTimeout(() => {
            if (score <= 2) {
                this.setState({ viewState: 'low_rating' });
            } else {
                this.setState({ viewState: 'high_rating' });
            }
        }, 400);
    };

    redirectToStore = async () => {
        const url =
            Platform.OS === 'ios'
                ? `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`
                : 'market://details?id=com.zeusln.zeus';

        const supported = await Linking.canOpenURL(url);
        if (supported) {
            Linking.openURL(url);
        }
        this.handleClose();
    };

    handleClose = () => {
        const { ModalStore } = this.props;
        ModalStore?.toggleRatingModal(false);

        setTimeout(() => {
            this.setState({ rating: 0, viewState: 'initial' });
        }, 400);
    };

    renderStars = () => {
        let stars = [];
        for (let i = 1; i <= 5; i++) {
            const name = i <= this.state.rating ? 'star' : 'star-outline';
            const color = '#007AFF';

            stars.push(
                <TouchableOpacity key={i} onPress={() => this.handleRating(i)}>
                    <Ionicons
                        name={name}
                        size={26}
                        color={color}
                        style={{ marginHorizontal: 10 }}
                    />
                </TouchableOpacity>
            );
        }
        return <View style={styles.starContainer}>{stars}</View>;
    };

    renderInitialView = (storeName: string) => (
        <>
            <Text style={styles.title}>
                {localeString('components.RatingModal.enjoyingZeus')}
            </Text>
            <Text style={styles.subtitle}>
                {`${localeString(
                    'components.RatingModal.tapToRate'
                )} \n${storeName}.`}
            </Text>

            <View style={styles.divider} />

            {this.renderStars()}

            <View style={styles.divider} />

            <TouchableOpacity
                style={styles.actionButton}
                onPress={this.handleClose}
            >
                <Text style={styles.actionText}>
                    {localeString('components.RatingModal.notNow')}
                </Text>
            </TouchableOpacity>
        </>
    );

    renderLowRatingView = () => (
        <>
            <Text style={styles.title}>
                {localeString('components.RatingModal.weAreSorry')}
            </Text>
            <Text style={styles.subtitle}>
                {localeString('components.RatingModal.whatWentWrong')}
            </Text>

            <View style={styles.divider} />

            <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                    Linking.openURL(
                        `mailto:support@zeusln.com?subject=Feedback (Rating: ${this.state.rating} stars)`
                    );
                    this.handleClose();
                }}
            >
                <Text style={[styles.actionText, styles.bold]}>
                    {localeString('components.RatingModal.contactSupport')}
                </Text>
            </TouchableOpacity>
            <View style={styles.divider} />

            <TouchableOpacity
                style={styles.actionButton}
                onPress={this.handleClose}
            >
                <Text style={styles.actionText}>
                    {localeString('components.RatingModal.noThanks')}
                </Text>
            </TouchableOpacity>
        </>
    );

    renderHighRatingView = () => (
        <>
            <Text style={styles.title}>
                {localeString('component.RatingModal.thankYouFeedback')}
            </Text>

            <Text style={styles.subtitle}>
                {localeString('components.RatingModal.leaveReview')}
            </Text>

            <View style={styles.divider} />

            <TouchableOpacity
                style={styles.actionButton}
                onPress={this.redirectToStore}
            >
                <Text style={[styles.actionText, styles.bold]}>
                    {localeString('component.RatingModal.writeAReview')}
                </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
                style={styles.actionButton}
                onPress={this.handleClose}
            >
                <Text style={styles.actionText}>
                    {localeString('components.RatingModal.noThanks')}
                </Text>
            </TouchableOpacity>
        </>
    );

    render() {
        const { ModalStore } = this.props;
        const { showRatingModal } = ModalStore!;
        const { viewState } = this.state;

        const storeName =
            Platform.OS === 'ios'
                ? localeString('general.appStore')
                : localeString('general.playStore');
        return (
            <ModalBox
                isOpen={showRatingModal}
                style={styles.modalBox}
                onClosed={this.handleClose}
                position="center"
                swipeToClose={false}
                backButtonClose={false}
                backdropPressToClose={false}
                backdropOpacity={0.5}
            >
                <View style={styles.container}>
                    {viewState === 'initial' &&
                        this.renderInitialView(storeName)}
                    {viewState === 'low_rating' && this.renderLowRatingView()}
                    {viewState === 'high_rating' && this.renderHighRatingView()}
                </View>
            </ModalBox>
        );
    }
}

const styles = StyleSheet.create({
    modalBox: {
        backgroundColor: 'transparent',
        width: 300,
        height: undefined,
        borderRadius: 14,
        overflow: 'hidden'
    },
    container: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        paddingTop: 20,
        width: '100%',
        borderRadius: 14
    },
    title: {
        color: '#000',
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 4
    },
    subtitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 18,
        paddingHorizontal: 15
    },
    starContainer: {
        flexDirection: 'row',
        marginVertical: 14,
        justifyContent: 'center'
    },
    divider: {
        height: 1,
        width: '100%',
        backgroundColor: '#3F3F3F',
        opacity: 0.15
    },
    actionText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#007AFF',
        textAlign: 'center'
    },
    actionButton: {
        width: '100%',
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent'
    },
    bold: {
        fontWeight: '600'
    }
});
