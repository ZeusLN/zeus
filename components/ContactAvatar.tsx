import * as React from 'react';
import { Text } from 'react-native';

import { SharedImage, SharedView } from './SharedTransition';
import { getAvatarInitials } from '../utils/DisplayUtils';
import { themeColor } from '../utils/ThemeUtils';
import Ecash from '../assets/images/SVG/Ecash.svg';

type AvatarSize = 'small' | 'medium' | 'large';

interface ContactAvatarProps {
    contactId: string;
    imageUrl?: string;
    name?: string;
    size?: AvatarSize;
    style?: object;
    contactHasOnlyCashuPubkey?: boolean;
    sharedTransitionEntering?: any;
}

const SIZES: Record<
    AvatarSize,
    {
        container: number;
        borderRadius: number;
        fontSize: number;
        icon: number;
        marginBottom?: number;
    }
> = {
    small: { container: 24, borderRadius: 12, fontSize: 10, icon: 14 },
    medium: { container: 42, borderRadius: 21, fontSize: 14, icon: 24 },
    large: {
        container: 150,
        borderRadius: 75,
        fontSize: 36,
        icon: 48
    }
};

const AvatarContent: React.FC<{
    name?: string;
    fontSize: number;
    iconSize: number;
    contactHasOnlyCashuPubkey?: boolean;
}> = ({ name, fontSize, iconSize, contactHasOnlyCashuPubkey }) => {
    if (contactHasOnlyCashuPubkey) {
        return <Ecash fill="#FACC15" width={iconSize} height={iconSize} />;
    }

    const initials = getAvatarInitials(name);
    if (initials) {
        return (
            <Text
                style={{
                    fontSize,
                    fontWeight: 'bold',
                    color: themeColor('text')
                }}
            >
                {initials}
            </Text>
        );
    }

    return <Text style={{ fontSize: iconSize }}>⚡</Text>;
};

export const ContactAvatar: React.FC<ContactAvatarProps> = ({
    contactId,
    imageUrl,
    name,
    size = 'medium',
    style,
    contactHasOnlyCashuPubkey,
    sharedTransitionEntering
}) => {
    const { container, borderRadius, fontSize, icon, marginBottom } =
        SIZES[size];
    const sharedTag = `contact-photo-${contactId}`;
    const baseStyle = {
        width: container,
        height: container,
        borderRadius,
        marginBottom,
        ...style
    };

    if (imageUrl) {
        return (
            <SharedImage
                tag={sharedTag}
                source={{ uri: imageUrl }}
                style={baseStyle}
                entering={sharedTransitionEntering}
            />
        );
    }

    return (
        <SharedView
            tag={sharedTag}
            style={{
                ...baseStyle,
                backgroundColor: themeColor('secondary'),
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
            }}
            entering={sharedTransitionEntering}
        >
            <AvatarContent
                name={name}
                fontSize={fontSize}
                iconSize={icon}
                contactHasOnlyCashuPubkey={contactHasOnlyCashuPubkey}
            />
        </SharedView>
    );
};
