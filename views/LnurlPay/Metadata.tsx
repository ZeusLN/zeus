import * as React from 'react';
import { Text, Image, View } from 'react-native';
import { Icon } from '@rneui/themed';

import { themeColor } from '../../utils/ThemeUtils';

interface LnurlPayMetadataProps {
    metadata: string;
    showArrow?: boolean;
    hideImage?: boolean;
}

export default class LnurlPayMetadata extends React.Component<LnurlPayMetadataProps> {
    render() {
        const { metadata, showArrow = true, hideImage = false } = this.props;

        let keypairs: Array<Array<string>>;
        try {
            keypairs = JSON.parse(metadata);
        } catch (err) {
            keypairs = [];
        }
        const rawText: string = keypairs
            .filter(([typ]: any) => typ === 'text/plain')
            .map(([, content]: any) => content)[0];

        // Some LNURL pay servers percent-encode the description (e.g. spaces as
        // %20). Decode it for display, falling back to the raw value if it isn't
        // valid percent-encoding (e.g. a literal "%").
        let text: string = rawText;
        if (rawText) {
            try {
                text = decodeURI(rawText);
            } catch {
                text = rawText;
            }
        }

        const image: string = keypairs
            .filter(([typ]: any) => typ.slice(0, 6) === 'image/')
            .map(([typ, content]: any) => `data:${typ},${content}`)[0];

        return (
            <View
                style={{
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                {image && !hideImage ? (
                    <Image
                        style={{
                            width: 90,
                            height: 90,
                            marginBottom: 10
                        }}
                        source={{ uri: image }}
                    />
                ) : null}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}
                >
                    <Text
                        style={{
                            color: showArrow
                                ? themeColor('highlight')
                                : themeColor('secondaryText'),
                            fontFamily: 'PPNeueMontreal-Book',
                            textAlign: 'center'
                        }}
                    >
                        {text}
                    </Text>
                    {showArrow && (
                        <Icon
                            name="keyboard-arrow-down"
                            type="material"
                            size={15}
                            color={themeColor('highlight')}
                        />
                    )}
                </View>
            </View>
        );
    }
}
