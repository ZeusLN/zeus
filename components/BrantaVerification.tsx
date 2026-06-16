import * as React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Body } from './text/Body';
import { Row } from './layout/Row';

import { BrantaVerification as BrantaVerificationType } from '../stores/BrantaStore';

import UrlUtils from '../utils/UrlUtils';
import { themeColor } from '../utils/ThemeUtils';

import VerifiedAccount from '../assets/images/SVG/Verified Account.svg';

interface BrantaVerificationProps {
    verification: BrantaVerificationType;
}

export default class BrantaVerification extends React.Component<BrantaVerificationProps> {
    render() {
        const { verification } = this.props;
        const { platform, platformLogoUrl, description, verifyUrl } =
            verification;

        return (
            <TouchableOpacity
                onPress={() => UrlUtils.goToUrl(verifyUrl)}
                style={{
                    ...styles.container,
                    backgroundColor: themeColor('secondary')
                }}
            >
                <Row align="center">
                    <Image
                        source={{ uri: platformLogoUrl }}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <View style={styles.textContainer}>
                        <Row align="center">
                            <Body bold>{platform}</Body>
                            <VerifiedAccount
                                fill={themeColor('success')}
                                width={16}
                                height={16}
                                style={{ marginLeft: 6 }}
                            />
                        </Row>
                        {description && (
                            <Body secondary small>
                                {description}
                            </Body>
                        )}
                    </View>
                </Row>
            </TouchableOpacity>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        padding: 12,
        borderRadius: 8,
        marginVertical: 10
    },
    logo: {
        width: 40,
        height: 40,
        borderRadius: 20
    },
    textContainer: {
        marginLeft: 12,
        flex: 1
    }
});
