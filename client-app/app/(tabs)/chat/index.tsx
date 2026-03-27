import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    SafeAreaView,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    useConversations,
    useChatMessages,
    useChatSocket,
    useInitiateConversation,
    ChatMessage,
} from '../../../hooks/useChat';

export default function ChatTab() {
    const { data: conversations, isLoading: loadingConversations } = useConversations();
    const { mutate: initiateConversation, isPending: initiating } = useInitiateConversation();

    const conversation = conversations?.[0];
    const conversationId = conversation?.id || null;

    const {
        data,
        isLoading: loadingMessages,
        refetch: refetchMessages,
        isRefetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useChatMessages(conversationId || '');

    const { sendMessage, markRead, typingUser } = useChatSocket(conversationId);

    const [input, setInput] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const messages = useMemo(() => {
        if (!data?.pages) return [];
        const all = data.pages.flatMap(p => p.messages);
        return [...all].reverse();
    }, [data]);

    // Mark latest dietitian message as read
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.senderType === 'user' && lastMsg.status !== 'read') {
                markRead(lastMsg.id);
            }
        }
    }, [messages, markRead]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        sendMessage(trimmed);
        setInput('');
    };

    if (loadingConversations) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Chat</Text>
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#17cf54" />
                </View>
            </SafeAreaView>
        );
    }

    if (!conversation) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Chat</Text>
                </View>
                <View style={styles.centered}>
                    <Ionicons name="chatbubble-ellipses-outline" size={56} color="#ccc" />
                    <Text style={styles.emptyText}>No conversation yet</Text>
                    <Text style={styles.emptySubtext}>Start a chat with your dietitian</Text>
                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={() => initiateConversation()}
                        disabled={initiating}
                    >
                        {initiating ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.startButtonText}>Start Chat</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isMe = item.senderType === 'client';
        return (
            <View style={[styles.bubbleRow, isMe ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.content}</Text>
                    <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isMe && item.status === 'read' ? ' \u2713\u2713' : ''}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{conversation.user.fullName}</Text>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {loadingMessages ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color="#17cf54" />
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefetching}
                                onRefresh={refetchMessages}
                                tintColor="#17cf54"
                            />
                        }
                        onStartReached={() => {
                            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                        }}
                        onStartReachedThreshold={0.1}
                        ListHeaderComponent={
                            isFetchingNextPage ? (
                                <ActivityIndicator size="small" color="#999" style={{ marginVertical: 8 }} />
                            ) : null
                        }
                        ListEmptyComponent={
                            <View style={styles.centered}>
                                <Text style={styles.emptyText}>Send a message to start the conversation</Text>
                            </View>
                        }
                    />
                )}

                {typingUser && (
                    <Text style={styles.typingIndicator}>{typingUser} is typing...</Text>
                )}

                <View style={styles.inputContainer}>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="Type a message..."
                        style={styles.input}
                        multiline
                        maxLength={2000}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        disabled={!input.trim()}
                        style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
                    >
                        <Ionicons name="send" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    headerTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    emptyText: { fontSize: 16, fontWeight: '600', color: '#555', marginTop: 16 },
    emptySubtext: { fontSize: 13, color: '#999', marginTop: 6 },
    startButton: {
        marginTop: 24,
        backgroundColor: '#17cf54',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 24,
        minWidth: 140,
        alignItems: 'center',
    },
    startButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
    messagesList: { paddingHorizontal: 12, paddingVertical: 8, flexGrow: 1 },
    bubbleRow: { marginVertical: 2 },
    bubbleRowRight: { alignItems: 'flex-end' },
    bubbleRowLeft: { alignItems: 'flex-start' },
    bubble: {
        maxWidth: '78%',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
    },
    bubbleMe: { backgroundColor: '#17cf54', borderBottomRightRadius: 6 },
    bubbleOther: { backgroundColor: '#f3f4f6', borderBottomLeftRadius: 6 },
    bubbleText: { fontSize: 15, color: '#111', lineHeight: 20 },
    bubbleTextMe: { color: '#fff' },
    bubbleTime: { fontSize: 10, color: '#999', marginTop: 2, textAlign: 'right' },
    bubbleTimeMe: { color: 'rgba(255,255,255,0.7)' },
    typingIndicator: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
        paddingHorizontal: 16,
        paddingBottom: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        backgroundColor: '#fff',
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 100,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#111',
    },
    sendButton: {
        marginLeft: 8,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#17cf54',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: { opacity: 0.5 },
});
