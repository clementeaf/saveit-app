/**
 * Test Page
 * Test view for development and testing
 */

import { Chat } from '../components/chat';

export function Test() {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 flex-shrink-0">Test</h1>
        <Chat />
    </div>
  );
}

