/**
 * Chat Component
 * UI/UX only - Visual chat interface without functionality
 */

import { useState } from 'react';
import { FiSend, FiPaperclip, FiSmile, FiMoreVertical } from 'react-icons/fi';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: string;
  avatar?: string;
  status?: 'sent' | 'delivered' | 'read';
}

const mockMessages: Message[] = [
  {
    id: '1',
    text: 'Hello! How can I help you today?',
    sender: 'other',
    timestamp: '10:30 AM',
    status: 'read',
  },
  {
    id: '2',
    text: 'Hi, I need help with my reservation',
    sender: 'user',
    timestamp: '10:32 AM',
    status: 'read',
  },
  {
    id: '3',
    text: 'Sure! What would you like to know?',
    sender: 'other',
    timestamp: '10:33 AM',
    status: 'read',
  },
  {
    id: '4',
    text: 'I want to modify the date of my reservation',
    sender: 'user',
    timestamp: '10:35 AM',
    status: 'delivered',
  },
  {
    id: '5',
    text: 'I can help you with that. What is your reservation ID?',
    sender: 'other',
    timestamp: '10:36 AM',
    status: 'read',
  },
];

export function Chat() {
  const [messages] = useState<Message[]>(mockMessages);
  const [inputValue, setInputValue] = useState('');

  const getStatusIcon = (status?: string) => {
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
  };

  const getStatusColor = (status?: string) => {
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
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
            JD
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">John Doe</h3>
            <p className="text-sm text-gray-500">Online</p>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
          <FiMoreVertical className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
        {messages.map((message) => (
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
              {message.sender === 'user' ? 'ME' : 'JD'}
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
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-white">
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
              placeholder="Type a message..."
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
              <FiSmile className="w-5 h-5" />
            </button>
          </div>

          {/* Send Button */}
          <button
            className={`p-3 rounded-full transition-colors ${
              inputValue.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!inputValue.trim()}
          >
            <FiSend className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

