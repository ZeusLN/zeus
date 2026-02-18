import * as React from 'react';
import { Image, Text, View } from 'react-native';

import { themeColor } from '../utils/ThemeUtils';
import { getAvatarInitials } from '../utils/DisplayUtils';

import Ecash from '../assets/images/SVG/Ecash.svg';

interface MintAvatarProps {
    iconUrl?: string | null;
    name?: string | null;
    size?: 'small' | 'medium' | 'large';
    style?: object;
}

const SIZES = {
    small: { container: 24, borderRadius: 12, fontSize: 10, icon: 14 },
    medium: { container: 42, borderRadius: 21, fontSize: 14, icon: 24 },
    large: { container: 100, borderRadius: 50, fontSize: 36, icon: 48 }
};

const MintAvatar: React.FC<MintAvatarProps> = ({
    iconUrl,
    name,
    size = 'medium',
    style
}) => {
    const [imageError, setImageError] = React.useState(false);

    React.useEffect(() => {
        setImageError(false);
    }, [iconUrl]);

    const showPlaceholder = !iconUrl || imageError;
    const dims = SIZES[size];

    if (showPlaceholder) {
        const initials = getAvatarInitials(name || undefined);
        return (
            <View
                style={[
                    {
                        width: dims.container,
                        height: dims.container,
                        borderRadius: dims.borderRadius,
                        backgroundColor: themeColor('text'),
                        alignItems: 'center',
                        justifyContent: 'center'
                    },
                    style
                ]}
            >
                {initials ? (
                    <Text
                        style={{
                            fontSize: dims.fontSize,
                            fontWeight: 'bold',
                            color: themeColor('secondary')
                        }}
                    >
                        {initials}
                    </Text>
                ) : (
                    <Ecash
                        fill={themeColor('secondary')}
                        width={dims.icon}
                        height={dims.icon}
                    />
                )}
            </View>
        );
    }

    return (
        <Image
            source={{ uri: iconUrl }}
            onError={() => setImageError(true)}
            style={[
                {
                    width: dims.container,
                    height: dims.container,
                    borderRadius: dims.borderRadius
                },
                style
            ]}
        />
    );
};

export default MintAvatar;
