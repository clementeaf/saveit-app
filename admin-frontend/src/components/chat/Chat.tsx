/**
 * Chat Component
 * Chat interface connected to backend API
 */

import { useState, useEffect, useRef } from 'react';
import { FiSend, FiPaperclip, FiSmile, FiMoreVertical } from 'react-icons/fi';
import { useConversationHistory, useSendMessage } from '../../api/hooks/useChat';
import { format } from 'date-fns';
import type { ChatMessage } from '../../api/types/chat';

interface ChatProps {
  userId?: string;
}

/**
 * Get status icon for message status
 * @param status - Message status
 * @returns Status icon string
 */
function getStatusIcon(status?: string): string {
  switch (status) {
    case 'read':
      return '✓✓';
    case 'delivered':
      return '✓✓';
    case 'sent':
      return '✓';
    default:
      return '';
  }
}

/**
 * Get status color class for message status
 * @param status - Message status
 * @returns Tailwind color class
 */
function getStatusColor(status?: string): string {
  switch (status) {
    case 'read':
      return 'text-blue-500';
    case 'delivered':
      return 'text-gray-400';
    case 'sent':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

/**
 * Transform backend message to UI message format
 */
function transformMessage(message: ChatMessage): {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
} {
  const isUser = message.direction === 'outbound';
  const timestamp = format(new Date(message.createdAt), 'h:mm a');
  
  return {
    id: message.id,
    text: message.content,
    sender: isUser ? 'user' : 'other',
    timestamp,
    status: 'read' as const,
  };
}

// Using a valid UUID from the database (you can get this from users table)
// For now, using a UUID that should exist if migrations and seed ran
export function Chat({ userId = '398cd7e1-b90e-41be-b8ad-5c66be32b8f3' }: ChatProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messages = [], isLoading } = useConversationHistory(userId, 50);
  const sendMessageMutation = useSendMessage();

  const transformedMessages = messages.map(transformMessage);

  /**
   * Scroll to bottom when new messages arrive
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transformedMessages]);

  /**
   * Handle send message
   */
  const handleSend = async () => {
    if (!inputValue.trim() || sendMessageMutation.isPending) return;

    const messageText = inputValue.trim();
    setInputValue(''); // Clear input immediately for better UX

    try {
      await sendMessageMutation.mutateAsync({
        userId,
        channel: 'webchat',
        content: messageText,
        metadata: {},
      });
      // The mutation's onSuccess will handle refetch automatically
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore input if there was an error
      setInputValue(messageText);
    }
  };

  /**
   * Handle Enter key press
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[700px] rounded-lg shadow-lg overflow-hidden border border-gray-200">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
            U{userId}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">User {userId}</h3>
            <p className="text-sm text-gray-500">Online</p>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
          <FiMoreVertical className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4" style={{ minHeight: 0 }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading messages...</p>
          </div>
        ) : transformedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No messages yet. Start a conversation!</p>
          </div>
        ) : (
          <>
            {transformedMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 ${
                    message.sender === 'user'
                      ? 'bg-blue-500'
                      : 'bg-gray-400'
                  }`}
                >
                  {message.sender === 'user' ? 'ME' : 'U'}
                </div>

                {/* Message Content */}
                <div
                  className={`flex flex-col max-w-[70%] ${
                    message.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white rounded-tr-sm'
                        : 'bg-white text-gray-900 rounded-tl-sm shadow-sm'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.text}</p>
                  </div>
                  <div
                    className={`flex items-center gap-1 mt-1 text-xs ${
                      message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <span className="text-gray-500">{message.timestamp}</span>
                    {message.sender === 'user' && (
                      <span className={getStatusColor(message.status)}>
                        {getStatusIcon(message.status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
            <FiPaperclip className="w-5 h-5" />
          </button>

          {/* Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={sendMessageMutation.isPending}
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
              <FiSmile className="w-5 h-5" />
            </button>
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            className={`p-3 rounded-full transition-colors ${
              inputValue.trim() && !sendMessageMutation.isPending
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
          >
            <FiSend className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
