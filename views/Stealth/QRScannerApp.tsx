import * as React from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StatusBar,
    Animated,
    Clipboard,
    Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStealthTapDetector } from './StealthTapDetector';

interface QRScannerAppProps {
    onUnlock: () => void;
    requiredTaps?: number;
}

interface ScanResult {
    id: string;
    content: string;
    timestamp: number;
}

const STORAGE_KEY = '@stealth_qrscanner_history';

const QRScannerApp: React.FC<QRScannerAppProps> = ({
    onUnlock,
    requiredTaps = 5
}) => {
    const [scanHistory, setScanHistory] = React.useState<ScanResult[]>([]);
    const [showHistory, setShowHistory] = React.useState(false);
    const [isScanning, _setIsScanning] = React.useState(true);

    const scanLineAnim = React.useRef(new Animated.Value(0)).current;

    // Secret unlock: tap "QR Scanner" title requiredTaps times within 4 seconds
    const { handleTap: handleSecretTap } = useStealthTapDetector({
        requiredTaps,
        timeWindow: 4000,
        onUnlock
    });

    React.useEffect(() => {
        loadHistory();
    }, []);

    React.useEffect(() => {
        if (isScanning) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanLineAnim, {
                        toValue: 1,
                        duration: 2000,
                        useNativeDriver: true
                    }),
                    Animated.timing(scanLineAnim, {
                        toValue: 0,
                        duration: 2000,
                        useNativeDriver: true
                    })
                ])
            ).start();
        }
    }, [isScanning, scanLineAnim]);

    const loadHistory = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                setScanHistory(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load scan history:', error);
        }
    };

    const saveHistory = async (history: ScanResult[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            setScanHistory(history);
        } catch (error) {
            console.error('Failed to save scan history:', error);
        }
    };

    const handleCopyToClipboard = (content: string) => {
        Clipboard.setString(content);
        Alert.alert('Copied', 'Content copied to clipboard');
    };

    const handleDeleteResult = (id: string) => {
        const updated = scanHistory.filter((item) => item.id !== id);
        saveHistory(updated);
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const translateY = scanLineAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 200]
    });

    const renderHistoryItem = ({ item }: { item: ScanResult }) => (
        <View style={styles.historyItem}>
            <TouchableOpacity
                style={styles.historyContent}
                onPress={() => handleCopyToClipboard(item.content)}
            >
                <Text style={styles.historyText} numberOfLines={2}>
                    {item.content}
                </Text>
                <Text style={styles.historyDate}>
                    {formatTimestamp(item.timestamp)}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteResult(item.id)}
            >
                <Text style={styles.deleteButtonText}>✕</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Scanner View */}
            <View style={styles.scannerContainer}>
                {/* Simulated camera view */}
                <View style={styles.cameraView}>
                    {/* Corner markers */}
                    <View style={[styles.corner, styles.topLeft]} />
                    <View style={[styles.corner, styles.topRight]} />
                    <View style={[styles.corner, styles.bottomLeft]} />
                    <View style={[styles.corner, styles.bottomRight]} />

                    {/* Scan line */}
                    <Animated.View
                        style={[
                            styles.scanLine,
                            { transform: [{ translateY }] }
                        ]}
                    />

                    {/* Center frame */}
                    <View style={styles.scanFrame} />
                </View>

                {/* Instructions */}
                <Text style={styles.instructions}>
                    Point camera at a QR code or barcode
                </Text>
            </View>

            {/* Bottom Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    onPress={handleSecretTap}
                    activeOpacity={1}
                    style={styles.titleContainer}
                >
                    <Text style={styles.appTitle}>QR Scanner</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.historyButton}
                    onPress={() => setShowHistory(true)}
                >
                    <Text style={styles.historyButtonText}>History</Text>
                    {scanHistory.length > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {scanHistory.length}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* History Modal */}
            <Modal visible={showHistory} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity
                                onPress={handleSecretTap}
                                activeOpacity={1}
                            >
                                <Text style={styles.modalTitle}>
                                    Scan History
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setShowHistory(false)}
                            >
                                <Text style={styles.modalClose}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        {scanHistory.length === 0 ? (
                            <View style={styles.emptyHistory}>
                                <Text style={styles.emptyIcon}>📷</Text>
                                <Text style={styles.emptyText}>
                                    No scans yet
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    Scanned codes will appear here
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={scanHistory}
                                renderItem={renderHistoryItem}
                                keyExtractor={(item) => item.id}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000'
    },
    scannerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    cameraView: {
        width: 250,
        height: 250,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a'
    },
    corner: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderColor: '#00C853',
        borderWidth: 3
    },
    topLeft: {
        top: 0,
        left: 0,
        borderRightWidth: 0,
        borderBottomWidth: 0
    },
    topRight: {
        top: 0,
        right: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 0
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderRightWidth: 0,
        borderTopWidth: 0
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderLeftWidth: 0,
        borderTopWidth: 0
    },
    scanFrame: {
        width: 200,
        height: 200,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        borderStyle: 'dashed'
    },
    scanLine: {
        position: 'absolute',
        width: 200,
        height: 2,
        backgroundColor: '#00C853',
        top: 25
    },
    instructions: {
        color: '#888',
        fontSize: 14,
        marginTop: 30,
        textAlign: 'center'
    },
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 30,
        backgroundColor: '#1a1a1a'
    },
    titleContainer: {
        flex: 1
    },
    appTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600'
    },
    historyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20
    },
    historyButtonText: {
        color: '#fff',
        fontSize: 14
    },
    badge: {
        backgroundColor: '#00C853',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8
    },
    badgeText: {
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold'
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    modalContent: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        minHeight: '50%'
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
        color: '#00C853',
        fontSize: 16
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    historyContent: {
        flex: 1
    },
    historyText: {
        color: '#fff',
        fontSize: 14
    },
    historyDate: {
        color: '#666',
        fontSize: 12,
        marginTop: 4
    },
    deleteButton: {
        padding: 10
    },
    deleteButtonText: {
        color: '#666',
        fontSize: 16
    },
    emptyHistory: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60
    },
    emptyIcon: {
        fontSize: 50,
        marginBottom: 15
    },
    emptyText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600'
    },
    emptySubtext: {
        color: '#666',
        fontSize: 14,
        marginTop: 8
    }
});

export default QRScannerApp;
