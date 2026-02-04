import React, {useEffect, useState, useRef, useCallback} from 'react';
import {useSelector, useDispatch} from "react-redux";
import type {RootState} from "@/store/store.ts";
import type {Chat, Message} from "@/services/chat/types.ts";
import {
    useLazyGetChatQuery,
    useLazyGetMessagesQuery,
    useSendMessageMutation,
    useSendInitialMessageMutation
} from "@/services/chat/chatApi.ts";
import {useParams, useNavigate} from "react-router";
import {addChat} from "@/store/chatSlice.ts";
// import ChatHeader from './ChatHeader.tsx';
import MessageList from './MessageList.tsx';
import MessageInput from './MessageInput.tsx';
import WelcomeScreen from './WelcomeScreen.tsx';
import toast, {Toaster} from 'react-hot-toast';

const PAGE_SIZE = 10;

const notify = (message: string) => toast.error(message);

const ChatComponent: React.FC = () => {
    const dispatch = useDispatch();
    const [message, setMessage] = useState('');
    const [isTransitioning, setIsTransitioning] = useState(false);
    const isConnected = useSelector((state: RootState) => state.chat.isConnected);
    const [messages, setMessages] = useState<Message[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
    const [getMessagesQuery, {isLoading}] = useLazyGetMessagesQuery();
    const [sendMessage, {isLoading: isSending}] = useSendMessageMutation();
    const [sendInitialMessage, {isLoading: isSingingInitialMessages}] = useSendInitialMessageMutation();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const isFetchingRef = useRef(false);
    const {id: chatId} = useParams();
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [fetchChat] = useLazyGetChatQuery();
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadTriggerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const [isLimited, setIsLimited] = useState(false);

    const loadMessages = useCallback(async (pageToLoad: number) => {
        if (isFetchingRef.current || !isConnected || !selectedChat) {
            return;
        }

        isFetchingRef.current = true;

        try {
            const response = await getMessagesQuery({
                chatId: selectedChat.id,
                page: pageToLoad,
                size: PAGE_SIZE
            }).unwrap();

            if (response.content) {
                setShouldScrollToBottom(pageToLoad === 0);
                const scrollContainer = messagesContainerRef.current;
                const oldScrollHeight = scrollContainer?.scrollHeight || 0;

                setMessages(prev => {
                    const newMessages = [...prev, ...response.content];
                    return newMessages;
                });
                setHasMore(!response.last);
                setPage(response.page);

                if (pageToLoad === 0) {
                    setTimeout(() => {
                        scrollToBottom();
                    }, 100);
                } else {
                    setTimeout(() => {
                        if (scrollContainer) {
                            const newScrollHeight = scrollContainer.scrollHeight;
                            const scrollDiff = newScrollHeight - oldScrollHeight;
                            scrollContainer.scrollTop = scrollDiff;
                        }
                    }, 0);
                }
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            isFetchingRef.current = false;
        }
    }, [isConnected, selectedChat, getMessagesQuery]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && hasMore && !isFetchingRef.current) {
                    loadMessages(page + 1);
                }
            },
            {
                root: null,
                rootMargin: '100px',
                threshold: 0.1
            }
        );

        observerRef.current = observer;

        if (loadTriggerRef.current) {
            observer.observe(loadTriggerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, [hasMore, page, loadMessages, messages]);

    useEffect(() => {
        if (!chatId || isNaN(+chatId)) {
            setSelectedChat(null);
            setMessages([]);
            return;
        }
        if (chatId === selectedChat?.id.toString()) {
            return;
        }

        const fetchChatData = async () => {
            try {
                const chatData = await fetchChat({chatId: +chatId}).unwrap();
                setSelectedChat(chatData);
                const initialMessages = await getMessagesQuery({
                    chatId: chatData.id,
                    page: 0,
                    size: PAGE_SIZE
                }).unwrap();
                setMessages(initialMessages.content || []);
                setPage(0);
                setHasMore(!initialMessages.last);
                setShouldScrollToBottom(true);

                setTimeout(() => {
                    scrollToBottom();
                }, 100);
            } catch (error) {
                console.error('Failed to fetch chat:', error);
            }
        };
        fetchChatData();
    }, [chatId, fetchChat, getMessagesQuery]);

    useEffect(() => {
        if (messages.length > 0 && shouldScrollToBottom) {
            const timer = setTimeout(() => {
                scrollToBottom();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [messages.length, shouldScrollToBottom]);

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({behavior: "smooth"});
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || isSending) return;

        const userMessage: Message = {
            id: Date.now(),
            content: message.trim(),
            user: true,
            createdDate: new Date().toISOString(),
            sources: null,
            number: messages.length,
            version: 1
        };

        try {
            console.log('Starting message submission...');
            setShouldScrollToBottom(true);
            setMessages(prev => [userMessage, ...prev]);
            setMessage('');
            scrollToBottom();

            if (selectedChat) {
                console.log('Sending message to existing chat...');
                const response = await sendMessage({
                    chatId: selectedChat.id,
                    content: message.trim()
                }).unwrap();
                console.log('Received response:', response);
                setMessages(prev => [response.messageResponse, ...prev]);
            } else {
                console.log('Sending initial message...');
                const response = await sendInitialMessage({
                    content: message.trim()
                }).unwrap();
                console.log('Received initial response:', response);

                if (response.messageResponse && response.chatId && response.title) {
                    console.log('Creating new chat...');
                    const newChat: Chat = {
                        id: response.chatId,
                        title: response.title,
                        createdDate: new Date().toISOString()
                    };


                    // Start transition animation
                    setIsTransitioning(true);
                    
                    // Wait for animation to complete before updating state
                    setTimeout(() => {
                        console.log('Setting messages...');
                        setMessages([response.messageResponse, userMessage]);
                        scrollToBottom();
                        console.log('Updating chat state...');
                        setSelectedChat(newChat);
                        dispatch(addChat(newChat));
                        console.log('Navigating...');
                        navigate(`/${response.chatId}`, {replace: true});
                        setIsTransitioning(false);
                    }, 500);
                } else {
                    console.error('Invalid response format:', response);
                }
            }
            console.log('Message submission completed');
            setIsLimited(false);
            scrollToBottom();
        } catch (error) {
            console.error('Failed to send message:', error);
            if(error.originalStatus === 400) {
                notify(error.data);
                setIsLimited(true);
            }
            setMessages(prev => prev.filter(m => m.id !== userMessage.id));
            setIsTransitioning(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-50 h-full">
            <Toaster />
            {selectedChat ? (
                <div className={`flex-1 flex flex-col h-full transition-all duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                    {/*<ChatHeader chat={selectedChat} />*/}
                    <div className="flex-1 overflow-y-auto">
                        <MessageList
                            messages={messages}
                            isLoading={isLoading || isSingingInitialMessages}
                            onLoadMore={() => loadMessages(page + 1)}
                            hasMore={hasMore}
                            isFetching={isFetchingRef.current}
                        />
                    </div>
                    <div className="p-2 sm:p-4 w-full max-w-3xl mx-auto bg-transparent mt-auto">
                        <MessageInput
                            message={message}
                            setMessage={setMessage}
                            handleSubmit={handleSubmit}
                            isSending={isSending || isSingingInitialMessages}
                            className="max-w-3xl mx-auto"
                        />
                    </div>
                </div>
            ) : (
                <div className={`flex-1 flex flex-col items-center justify-center p-4 h-full transition-all duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                    <WelcomeScreen
                        messages={messages}
                        message={message}
                        setMessage={setMessage}
                        handleSubmit={handleSubmit}
                        isSending={isSending || isSingingInitialMessages}
                    />
                </div>
            )}
        </div>
    );
};

export default ChatComponent;