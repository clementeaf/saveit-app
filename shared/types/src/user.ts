/**
 * User Domain Types
 */

import { ChannelType } from './channels';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserChannelIdentifier {
  id: string;
  userId: string;
  channel: ChannelType;
  channelUserId: string;
  createdAt: Date;
}

export interface UserProfile {
  user: User;
  channelIdentifiers: UserChannelIdentifier[];
  reservationCount: number;
  lastReservationAt?: Date;
}

export enum ConversationStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

export interface Conversation {
  id: string;
  userId: string;
  restaurantId?: string;
  channel: ChannelType;
  status: ConversationStatus;
  context: Record<string, unknown>;
  startedAt: Date;
  lastMessageAt: Date;
  endedAt?: Date;
}
