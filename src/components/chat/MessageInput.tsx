import React from 'react';

interface MessageInputProps {
    message: string;
    setMessage: (message: string) => void;
    handleSubmit: (e: React.FormEvent) => void;
    isSending: boolean;
    placeholder?: string;
    className?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
    message,
    setMessage,
    handleSubmit,
    isSending,
    placeholder = "Введите сообщение...",
    className = "max-w-[600px]"
}) => {
    return (
        <form onSubmit={handleSubmit} className={className}>
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 p-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                    disabled={isSending}
                />
                <button
                    type="submit"
                    className={`p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors ${
                        isSending ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={isSending || !message.trim()}
                >
                    {isSending ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
                             viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                        </svg>
                    )}
                </button>
            </div>
        </form>
    );
};

export default MessageInput; 