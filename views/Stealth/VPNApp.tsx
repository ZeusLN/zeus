import * as React from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StatusBar,
    Animated
} from 'react-native';

interface VPNAppProps {
    onUnlock: () => void;
    unlockCountry?: string;
    unlockServer?: string;
}

interface ServerLocation {
    country: string;
    flag: string;
    servers: string[];
    ping: number;
}

const LOCATIONS: ServerLocation[] = [
    {
        country: 'United States',
        flag: '🇺🇸',
        servers: ['New York', 'Los Angeles', 'Chicago', 'Miami'],
        ping: 45
    },
    {
        country: 'Canada',
        flag: '🇨🇦',
        servers: ['Toronto', 'Vancouver', 'Montreal'],
        ping: 52
    },
    {
        country: 'United Kingdom',
        flag: '🇬🇧',
        servers: ['London', 'Manchester', 'Edinburgh'],
        ping: 89
    },
    {
        country: 'Germany',
        flag: '🇩🇪',
        servers: ['Frankfurt', 'Berlin', 'Munich'],
        ping: 95
    },
    {
        country: 'Netherlands',
        flag: '🇳🇱',
        servers: ['Amsterdam', 'Rotterdam'],
        ping: 88
    },
    {
        country: 'France',
        flag: '🇫🇷',
        servers: ['Paris', 'Lyon', 'Marseille'],
        ping: 92
    },
    {
        country: 'Japan',
        flag: '🇯🇵',
        servers: ['Tokyo', 'Osaka'],
        ping: 156
    },
    {
        country: 'Australia',
        flag: '🇦🇺',
        servers: ['Sydney', 'Melbourne'],
        ping: 198
    },
    {
        country: 'Sweden',
        flag: '🇸🇪',
        servers: ['Stockholm', 'Gothenburg'],
        ping: 78
    },
    {
        country: 'Switzerland',
        flag: '🇨🇭',
        servers: ['Zurich', 'Geneva'],
        ping: 85
    }
];

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

const VPNApp: React.FC<VPNAppProps> = ({
    onUnlock,
    unlockCountry = 'Switzerland',
    unlockServer = 'Geneva'
}) => {
    const [status, setStatus] =
        React.useState<ConnectionStatus>('disconnected');
    const [selectedLocation, setSelectedLocation] =
        React.useState<ServerLocation | null>(null);
    const [selectedServer, setSelectedServer] = React.useState<string | null>(
        null
    );
    const [showLocationPicker, setShowLocationPicker] = React.useState(false);
    const [showServerPicker, setShowServerPicker] = React.useState(false);

    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    React.useEffect(() => {
        if (status === 'connecting') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 500,
                        useNativeDriver: true
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true
                    })
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [status, pulseAnim]);

    const handleConnect = () => {
        if (status === 'connected') {
            setStatus('disconnected');
        } else if (status === 'disconnected') {
            if (!selectedLocation || !selectedServer) {
                setShowLocationPicker(true);
                return;
            }
            setStatus('connecting');
            // Simulate connection delay
            const delay = 2000 + Math.random() * 3000;
            setTimeout(() => {
                setStatus('connected');
            }, delay);
        }
    };

    const handleSelectLocation = (location: ServerLocation) => {
        setSelectedLocation(location);
        setShowLocationPicker(false);
        setShowServerPicker(true);
    };

    const handleSelectServer = (server: string) => {
        setSelectedServer(server);
        setShowServerPicker(false);

        // Check for secret unlock
        if (
            selectedLocation?.country === unlockCountry &&
            server.toLowerCase() === unlockServer.toLowerCase()
        ) {
            onUnlock();
            return;
        }

        // Auto-connect after selection
        setStatus('connecting');
        const delay = 2000 + Math.random() * 3000;
        setTimeout(() => {
            setStatus('connected');
        }, delay);
    };

    const getStatusColor = () => {
        switch (status) {
            case 'connected':
                return '#4CAF50';
            case 'connecting':
                return '#FFC107';
            default:
                return '#666';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'connected':
                return 'Protected';
            case 'connecting':
                return 'Connecting...';
            default:
                return 'Not Connected';
        }
    };

    const renderLocationItem = ({ item }: { item: ServerLocation }) => (
        <TouchableOpacity
            style={styles.listItem}
            onPress={() => handleSelectLocation(item)}
        >
            <Text style={styles.flag}>{item.flag}</Text>
            <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{item.country}</Text>
                <Text style={styles.listItemSubtitle}>
                    {item.servers.length} servers
                </Text>
            </View>
            <Text style={styles.ping}>{item.ping} ms</Text>
        </TouchableOpacity>
    );

    const renderServerItem = ({ item }: { item: string }) => (
        <TouchableOpacity
            style={styles.listItem}
            onPress={() => handleSelectServer(item)}
        >
            <View style={styles.serverDot} />
            <View style={styles.listItemContent}>
                <Text style={styles.listItemTitle}>{item}</Text>
                <Text style={styles.listItemSubtitle}>
                    {selectedLocation?.country}
                </Text>
            </View>
            <Text style={styles.ping}>
                {(selectedLocation?.ping || 50) +
                    Math.floor(Math.random() * 20)}{' '}
                ms
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Edge VPN</Text>
                <Text style={styles.headerSubtitle}>Secure & Private</Text>
            </View>

            {/* Status Circle */}
            <View style={styles.statusContainer}>
                <Animated.View
                    style={[
                        styles.statusCircle,
                        {
                            backgroundColor: getStatusColor(),
                            transform: [{ scale: pulseAnim }]
                        }
                    ]}
                >
                    <TouchableOpacity
                        style={styles.powerButton}
                        onPress={handleConnect}
                    >
                        {/* Custom power icon using views */}
                        <View style={styles.powerIconContainer}>
                            <View style={styles.powerIconRing} />
                            <View style={styles.powerIconLine} />
                        </View>
                    </TouchableOpacity>
                </Animated.View>
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                    {getStatusText()}
                </Text>
            </View>

            {/* Selected Location */}
            <TouchableOpacity
                style={styles.locationSelector}
                onPress={() => setShowLocationPicker(true)}
            >
                {selectedLocation ? (
                    <>
                        <Text style={styles.selectedFlag}>
                            {selectedLocation.flag}
                        </Text>
                        <View style={styles.selectedInfo}>
                            <Text style={styles.selectedCountry}>
                                {selectedLocation.country}
                            </Text>
                            <Text style={styles.selectedServer}>
                                {selectedServer || 'Select server'}
                            </Text>
                        </View>
                    </>
                ) : (
                    <Text style={styles.selectLocationText}>
                        Select Location
                    </Text>
                )}
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* Stats (when connected) */}
            {status === 'connected' && (
                <View style={styles.statsContainer}>
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Download</Text>
                        <Text style={styles.statValue}>
                            {(Math.random() * 50 + 10).toFixed(1)} MB/s
                        </Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Upload</Text>
                        <Text style={styles.statValue}>
                            {(Math.random() * 20 + 5).toFixed(1)} MB/s
                        </Text>
                    </View>
                </View>
            )}

            {/* Location Picker Modal */}
            <Modal
                visible={showLocationPicker}
                animationType="slide"
                transparent
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Select Location
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowLocationPicker(false)}
                            >
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={LOCATIONS}
                            renderItem={renderLocationItem}
                            keyExtractor={(item) => item.country}
                        />
                    </View>
                </View>
            </Modal>

            {/* Server Picker Modal */}
            <Modal visible={showServerPicker} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {selectedLocation?.flag}{' '}
                                {selectedLocation?.country}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowServerPicker(false)}
                            >
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={selectedLocation?.servers || []}
                            renderItem={renderServerItem}
                            keyExtractor={(item) => item}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a2e'
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        alignItems: 'center'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold'
    },
    headerSubtitle: {
        color: '#888',
        fontSize: 14,
        marginTop: 4
    },
    statusContainer: {
        alignItems: 'center',
        marginVertical: 40
    },
    statusCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        justifyContent: 'center',
        alignItems: 'center'
    },
    powerButton: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center'
    },
    powerIconContainer: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center'
    },
    powerIconRing: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 4,
        borderColor: '#fff',
        borderTopColor: 'transparent'
    },
    powerIconLine: {
        position: 'absolute',
        width: 4,
        height: 22,
        backgroundColor: '#fff',
        borderRadius: 2,
        top: 4
    },
    statusText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20
    },
    locationSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#252542',
        marginHorizontal: 20,
        padding: 15,
        borderRadius: 12
    },
    selectedFlag: {
        fontSize: 32
    },
    selectedInfo: {
        flex: 1,
        marginLeft: 15
    },
    selectedCountry: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },
    selectedServer: {
        color: '#888',
        fontSize: 14,
        marginTop: 2
    },
    selectLocationText: {
        flex: 1,
        color: '#888',
        fontSize: 16
    },
    chevron: {
        color: '#888',
        fontSize: 24
    },
    statsContainer: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginTop: 20,
        backgroundColor: '#252542',
        borderRadius: 12,
        padding: 20
    },
    stat: {
        flex: 1,
        alignItems: 'center'
    },
    statDivider: {
        width: 1,
        backgroundColor: '#444'
    },
    statLabel: {
        color: '#888',
        fontSize: 12
    },
    statValue: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 5
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContent: {
        backgroundColor: '#252542',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600'
    },
    modalClose: {
        color: '#888',
        fontSize: 20
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    flag: {
        fontSize: 28
    },
    serverDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#4CAF50',
        marginRight: 10
    },
    listItemContent: {
        flex: 1,
        marginLeft: 15
    },
    listItemTitle: {
        color: '#fff',
        fontSize: 16
    },
    listItemSubtitle: {
        color: '#888',
        fontSize: 12,
        marginTop: 2
    },
    ping: {
        color: '#4CAF50',
        fontSize: 14
    }
});

export default VPNApp;
