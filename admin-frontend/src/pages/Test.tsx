/**
 * Test Page
 * Test view for development and testing
 */

import { Chat } from '../components/chat';

export function Test() {
  return (
    <div className="h-full">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Test</h1>
      <div className="h-[calc(100vh-12rem)] max-w-4xl mx-auto">
        <Chat />
      </div>
    </div>
  );
}

