import * as React from 'react';
import {
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StatusBar,
    Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStealthTapDetector } from './StealthTapDetector';

interface NotepadAppProps {
    onUnlock: () => void;
    requiredTaps?: number;
}

interface Note {
    id: string;
    title: string;
    content: string;
    updatedAt: number;
}

const STORAGE_KEY = '@stealth_notepad_notes';

const NotepadApp: React.FC<NotepadAppProps> = ({
    onUnlock,
    requiredTaps = 5
}) => {
    const [notes, setNotes] = React.useState<Note[]>([]);
    const [showEditor, setShowEditor] = React.useState(false);
    const [editingNote, setEditingNote] = React.useState<Note | null>(null);
    const [title, setTitle] = React.useState('');
    const [content, setContent] = React.useState('');

    // Secret unlock: tap "Notepad" title requiredTaps times within 4 seconds
    const { handleTap: handleSecretTap } = useStealthTapDetector({
        requiredTaps,
        timeWindow: 4000,
        onUnlock
    });

    React.useEffect(() => {
        loadNotes();
    }, []);

    const loadNotes = async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            if (stored) {
                setNotes(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Failed to load notes:', error);
        }
    };

    const saveNotes = async (updatedNotes: Note[]) => {
        try {
            await AsyncStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(updatedNotes)
            );
            setNotes(updatedNotes);
        } catch (error) {
            console.error('Failed to save notes:', error);
        }
    };

    const handleNewNote = () => {
        setEditingNote(null);
        setTitle('');
        setContent('');
        setShowEditor(true);
    };

    const handleEditNote = (note: Note) => {
        setEditingNote(note);
        setTitle(note.title);
        setContent(note.content);
        setShowEditor(true);
    };

    const handleSaveNote = () => {
        if (!title.trim() && !content.trim()) {
            setShowEditor(false);
            return;
        }

        const now = Date.now();
        let updatedNotes: Note[];

        if (editingNote) {
            updatedNotes = notes.map((note) =>
                note.id === editingNote.id
                    ? {
                          ...note,
                          title: title.trim() || 'Untitled',
                          content: content.trim(),
                          updatedAt: now
                      }
                    : note
            );
        } else {
            const newNote: Note = {
                id: `note_${now}`,
                title: title.trim() || 'Untitled',
                content: content.trim(),
                updatedAt: now
            };
            updatedNotes = [newNote, ...notes];
        }

        saveNotes(updatedNotes);
        setShowEditor(false);
    };

    const handleDeleteNote = (noteId: string) => {
        Alert.alert(
            'Delete Note',
            'Are you sure you want to delete this note?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        const updatedNotes = notes.filter(
                            (note) => note.id !== noteId
                        );
                        saveNotes(updatedNotes);
                    }
                }
            ]
        );
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderNote = ({ item }: { item: Note }) => (
        <TouchableOpacity
            style={styles.noteCard}
            onPress={() => handleEditNote(item)}
            onLongPress={() => handleDeleteNote(item.id)}
        >
            <Text style={styles.noteTitle} numberOfLines={1}>
                {item.title}
            </Text>
            <Text style={styles.notePreview} numberOfLines={2}>
                {item.content}
            </Text>
            <Text style={styles.noteDate}>{formatDate(item.updatedAt)}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFF9C4" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleSecretTap} activeOpacity={1}>
                    <Text style={styles.headerTitle}>Notepad</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={handleNewNote}
                >
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            {/* Notes List */}
            {notes.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📝</Text>
                    <Text style={styles.emptyText}>No notes yet</Text>
                    <Text style={styles.emptySubtext}>
                        Tap + to create your first note
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notes}
                    renderItem={renderNote}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.notesList}
                    numColumns={2}
                />
            )}

            {/* Editor Modal */}
            <Modal visible={showEditor} animationType="slide">
                <View style={styles.editorContainer}>
                    <View style={styles.editorHeader}>
                        <TouchableOpacity onPress={() => setShowEditor(false)}>
                            <Text style={styles.cancelButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.editorTitle}>
                            {editingNote ? 'Edit Note' : 'New Note'}
                        </Text>
                        <TouchableOpacity onPress={handleSaveNote}>
                            <Text style={styles.saveButton}>Save</Text>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={styles.titleInput}
                        placeholder="Title"
                        placeholderTextColor="#999"
                        value={title}
                        onChangeText={setTitle}
                        autoFocus
                    />

                    <TextInput
                        style={styles.contentInput}
                        placeholder="Start typing..."
                        placeholderTextColor="#999"
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                    />
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF9C4'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: '#FFE082'
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#5D4037'
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#5D4037',
        justifyContent: 'center',
        alignItems: 'center'
    },
    addButtonText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '300',
        marginTop: -2
    },
    notesList: {
        padding: 10
    },
    noteCard: {
        flex: 1,
        backgroundColor: '#FFFDE7',
        margin: 5,
        padding: 15,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        minHeight: 120
    },
    noteTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8
    },
    notePreview: {
        fontSize: 14,
        color: '#666',
        flex: 1
    },
    noteDate: {
        fontSize: 11,
        color: '#999',
        marginTop: 8
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyIcon: {
        fontSize: 60,
        marginBottom: 20
    },
    emptyText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#5D4037'
    },
    emptySubtext: {
        fontSize: 14,
        color: '#8D6E63',
        marginTop: 8
    },
    editorContainer: {
        flex: 1,
        backgroundColor: '#FFFDE7'
    },
    editorHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: '#FFE082',
        borderBottomWidth: 1,
        borderBottomColor: '#E0C068'
    },
    editorTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#5D4037'
    },
    cancelButton: {
        fontSize: 16,
        color: '#8D6E63'
    },
    saveButton: {
        fontSize: 16,
        color: '#5D4037',
        fontWeight: '600'
    },
    titleInput: {
        fontSize: 20,
        fontWeight: '600',
        color: '#333',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E0C068'
    },
    contentInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        paddingHorizontal: 20,
        paddingVertical: 15,
        lineHeight: 24
    }
});

export default NotepadApp;
