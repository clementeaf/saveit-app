/**
 * Chat Hooks
 * React Query hooks for chat operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '../services/chatService';
import type { SendMessageRequest, IncomingMessageRequest } from '../types/chat';

/**
 * Query keys for chat queries
 */
export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversation: (userId: string, limit?: number) => 
    [...chatKeys.conversations(), userId, limit] as const,
};

/**
 * Hook to fetch conversation history
 */
export function useConversationHistory(userId: string, limit: number = 50) {
  return useQuery({
    queryKey: chatKeys.conversation(userId, limit),
    queryFn: () => chatService.getConversationHistory(userId, limit),
    enabled: !!userId,
    refetchInterval: (query) => {
      // Only refetch if there are messages (active conversation)
      // or if window is focused (user is actively using the chat)
      const hasMessages = query.state.data && query.state.data.length > 0;
      const isWindowFocused = document.hasFocus();
      
      // Refetch every 5 seconds only if there are messages and window is focused
      return (hasMessages && isWindowFocused) ? 5000 : false;
    },
    refetchOnWindowFocus: true, // Refetch when user returns to the tab
  });
}

/**
 * Hook to send a message
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageRequest) => chatService.sendMessage(data),
    onSuccess: (_, variables) => {
      // Invalidate all conversation queries for this user (with or without limit)
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.conversations(),
        exact: false,
      });
      // Refetch after a short delay to allow bot to process and respond
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: chatKeys.conversation(variables.userId),
        });
      }, 500);
    },
  });
}

/**
 * Hook to handle incoming message
 */
export function useHandleIncomingMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IncomingMessageRequest) => chatService.handleIncomingMessage(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: chatKeys.conversation(variables.userId) 
      });
    },
  });
}

