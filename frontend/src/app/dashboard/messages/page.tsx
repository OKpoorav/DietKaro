'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Search,
    Send,
    Loader2,
    MessageSquare,
    Check,
    CheckCheck,
} from 'lucide-react';
import { useClients, Client } from '@/lib/hooks/use-clients';
import {
    useConversations,
    useCreateConversation,
    useMessages,
    useChatSocket,
    useUnreadCounts,
    Conversation,
    Message,
} from '@/lib/hooks/use-chat';
import { getInitials, formatTimeAgo } from '@/lib/utils/formatters';

export default function MessagesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const preselectedClientId = searchParams.get('client');

    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectedClientId);

    const createConversation = useCreateConversation();

    // When opening with ?client=<id>, auto-create/get conversation
    useEffect(() => {
        if (preselectedClientId && !selectedConversation) {
            createConversation.mutateAsync(preselectedClientId).then((conv) => {
                setSelectedConversation(conv);
                setSelectedClientId(preselectedClientId);
            });
        }
    }, [preselectedClientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelectClient = useCallback(async (clientId: string) => {
        setSelectedClientId(clientId);
        try {
            const conv = await createConversation.mutateAsync(clientId);
            setSelectedConversation(conv);
            router.replace('/dashboard/messages?client=' + clientId, { scroll: false });
        } catch {
            // If conversation creation fails, still show the client as selected
        }
    }, [createConversation, router]);

    const handleSelectConversation = useCallback((conv: Conversation) => {
        setSelectedConversation(conv);
        setSelectedClientId(conv.clientId);
        router.replace('/dashboard/messages?client=' + conv.clientId, { scroll: false });
    }, [router]);

    return (
        <div className="flex h-[calc(100vh-5rem)] bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Left panel — contacts */}
            <ContactList
                selectedClientId={selectedClientId}
                onSelectClient={handleSelectClient}
                onSelectConversation={handleSelectConversation}
            />

            {/* Right panel — chat thread */}
            {selectedConversation ? (
                <ChatThread conversation={selectedConversation} />
            ) : (
                <EmptyState />
            )}
        </div>
    );
}

// ==================== CONTACT LIST (LEFT PANEL) ====================

function ContactList({
    selectedClientId,
    onSelectClient,
    onSelectConversation,
}: {
    selectedClientId: string | null;
    onSelectClient: (clientId: string) => void;
    onSelectConversation: (conv: Conversation) => void;
}) {
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 300);

    // Fetch all clients and conversations
    const { data: clientsData, isLoading: clientsLoading } = useClients({ pageSize: 200 });
    const { data: conversations, isLoading: convsLoading } = useConversations();
    const { data: unreadData } = useUnreadCounts();

    const clients = clientsData?.data || [];
    const isLoading = clientsLoading || convsLoading;

    // Build a map: clientId -> conversation
    const convByClient = useMemo(() => {
        const map = new Map<string, Conversation>();
        if (conversations) {
            for (const conv of conversations) {
                map.set(conv.clientId, conv);
            }
        }
        return map;
    }, [conversations]);

    // Build unread map: conversationId -> count
    const unreadMap = useMemo(() => {
        const map = new Map<string, number>();
        if (unreadData?.conversations) {
            for (const c of unreadData.conversations) {
                map.set(c.conversationId, c.unreadCount);
            }
        }
        return map;
    }, [unreadData]);

    // Sort: clients with conversations (by lastMessageAt desc) first, then alphabetical
    const sortedClients = useMemo(() => {
        const filtered = debouncedSearch
            ? clients.filter((c) =>
                c.fullName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                c.phone?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                c.email?.toLowerCase().includes(debouncedSearch.toLowerCase())
            )
            : clients;

        return [...filtered].sort((a, b) => {
            const convA = convByClient.get(a.id);
            const convB = convByClient.get(b.id);

            // Both have conversations — sort by lastMessageAt
            if (convA?.lastMessageAt && convB?.lastMessageAt) {
                return new Date(convB.lastMessageAt).getTime() - new Date(convA.lastMessageAt).getTime();
            }
            // Only one has a conversation — that one first
            if (convA?.lastMessageAt) return -1;
            if (convB?.lastMessageAt) return 1;
            // Neither — alphabetical
            return a.fullName.localeCompare(b.fullName);
        });
    }, [clients, convByClient, debouncedSearch]);

    return (
        <div className="w-[360px] min-w-[360px] border-r border-gray-200 flex flex-col bg-white">
            {/* Header */}
            <div className="px-4 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Messages</h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search clients..."
                        className="w-full h-9 pl-9 pr-3 rounded-lg bg-gray-100 text-sm outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-brand"
                    />
                </div>
            </div>

            {/* Client list */}
            <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                ) : sortedClients.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm px-4">
                        No clients found
                    </div>
                ) : (
                    sortedClients.map((client) => {
                        const conv = convByClient.get(client.id);
                        const unread = conv ? (unreadMap.get(conv.id) || 0) : 0;
                        const isSelected = selectedClientId === client.id;

                        return (
                            <button
                                key={client.id}
                                onClick={() => {
                                    if (conv) {
                                        onSelectConversation(conv);
                                    } else {
                                        onSelectClient(client.id);
                                    }
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 ${
                                    isSelected
                                        ? 'bg-brand/5 border-l-2 border-l-brand'
                                        : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                                }`}
                            >
                                {/* Avatar */}
                                <div className="w-11 h-11 rounded-full bg-brand/15 flex items-center justify-center text-brand font-bold text-sm shrink-0">
                                    {getInitials(client.fullName)}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-sm truncate ${unread > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-900'}`}>
                                            {client.fullName}
                                        </span>
                                        {conv?.lastMessageAt && (
                                            <span className={`text-[11px] shrink-0 ml-2 ${unread > 0 ? 'text-brand font-semibold' : 'text-gray-400'}`}>
                                                {formatTimeAgo(conv.lastMessageAt)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <span className={`text-xs truncate ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                                            {conv?.lastMessageText || (client.phone || client.email || 'No messages yet')}
                                        </span>
                                        {unread > 0 && (
                                            <span className="ml-2 shrink-0 min-w-[20px] h-5 rounded-full bg-brand text-white text-[11px] flex items-center justify-center font-bold px-1.5">
                                                {unread > 99 ? '99+' : unread}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

// ==================== EMPTY STATE ====================

function EmptyState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 text-gray-400">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-lg font-medium text-gray-500">Select a client to start chatting</p>
            <p className="text-sm mt-1">Choose from your client list on the left</p>
        </div>
    );
}

// ==================== CHAT THREAD (RIGHT PANEL) ====================

function ChatThread({ conversation }: { conversation: Conversation }) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const {
        data,
        isLoading,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useMessages(conversation.id);

    const { sendMessage, sendTyping, sendStopTyping, markRead, typingUser } = useChatSocket(conversation.id);

    // Flatten pages into chronological order
    const messages = useMemo(() => {
        if (!data?.pages) return [];
        const all = data.pages.flatMap((p) => p.messages);
        return [...all].reverse(); // oldest first
    }, [data]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    // Mark as read
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.senderType === 'client' && lastMsg.status !== 'read') {
                markRead(lastMsg.id);
            }
        }
    }, [messages, markRead]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        sendMessage(trimmed);
        setInput('');
        sendStopTyping();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        sendTyping();
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => sendStopTyping(), 2000);
    };

    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (container && container.scrollTop < 50 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white">
                <div className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center text-brand font-bold text-sm">
                    {getInitials(conversation.client.fullName)}
                </div>
                <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{conversation.client.fullName}</h3>
                    {typingUser ? (
                        <p className="text-xs text-brand">typing...</p>
                    ) : (
                        <p className="text-xs text-gray-400">
                            {conversation.lastMessageAt
                                ? `Last active ${formatTimeAgo(conversation.lastMessageAt)}`
                                : 'Start a conversation'}
                        </p>
                    )}
                </div>
            </div>

            {/* Messages area */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-1 bg-gray-50/50"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23e5e7eb\' fill-opacity=\'0.3\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
            >
                {isFetchingNextPage && (
                    <div className="text-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
                    </div>
                )}

                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 animate-spin text-brand" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-3">
                                <Send className="w-7 h-7 text-brand/50" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium">No messages yet</p>
                            <p className="text-gray-400 text-xs mt-1">Send a message to start the conversation</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, i) => {
                            const prev = i > 0 ? messages[i - 1] : null;
                            const showDateSep = !prev || !isSameDay(msg.createdAt, prev.createdAt);
                            return (
                                <div key={msg.id}>
                                    {showDateSep && <DateSeparator date={msg.createdAt} />}
                                    <MessageBubble message={msg} />
                                </div>
                            );
                        })}
                    </>
                )}

                {typingUser && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 px-3 py-2 rounded-2xl rounded-bl-md text-xs text-gray-400 italic">
                            {typingUser} is typing...
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-gray-200 px-5 py-3 bg-white">
                <div className="flex items-end gap-3">
                    <textarea
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        rows={1}
                        className="flex-1 resize-none min-h-[40px] max-h-[120px] px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand bg-gray-50 placeholder:text-gray-400"
                        style={{ height: 'auto', overflow: 'hidden' }}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-brand text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ==================== MESSAGE BUBBLE ====================

function MessageBubble({ message }: { message: Message }) {
    const isMe = message.senderType === 'user';
    const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
            <div
                className={`max-w-[65%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                    isMe
                        ? 'bg-brand text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'
                }`}
            >
                <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                <div className={`flex items-center justify-end gap-1 mt-0.5 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                    <span className="text-[10px]">{time}</span>
                    {isMe && (
                        message.status === 'read'
                            ? <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                            : <Check className="w-3 h-3" />
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== DATE SEPARATOR ====================

function DateSeparator({ date }: { date: string }) {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (isSameDay(d.toISOString(), today.toISOString())) {
        label = 'Today';
    } else if (isSameDay(d.toISOString(), yesterday.toISOString())) {
        label = 'Yesterday';
    } else {
        label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return (
        <div className="flex items-center justify-center py-3">
            <span className="text-[11px] text-gray-500 bg-white border border-gray-200 px-3 py-0.5 rounded-full shadow-sm font-medium">
                {label}
            </span>
        </div>
    );
}

// ==================== HELPERS ====================

function isSameDay(a: string, b: string): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}
