/**
 * Chat Bot Service
 * Intelligent bot that handles automatic responses and reservation assistance
 */

import { logger } from '@saveit/utils';
import type { ChannelGateway } from './channelGateway';
import type { PoolClient } from 'pg';

interface ConversationContext {
  userId: string;
  conversationId: string;
  intent?: 'reservation' | 'greeting' | 'help' | 'unknown';
  reservationData?: {
    restaurantId?: string;
    date?: string;
    timeSlot?: string;
    partySize?: number;
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string;
    specialRequests?: string;
  };
  step?: 'greeting' | 'asking_restaurant' | 'asking_date' | 'asking_time' | 'asking_party_size' | 'asking_contact' | 'confirming' | 'completed';
}

/**
 * Chat Bot Service
 * Provides intelligent automatic responses for reservations
 */
export class ChatBot {
  constructor(_gateway: ChannelGateway) {
    // Gateway is stored for potential future use
  }

  /**
   * Detect intent from user message
   */
  private detectIntent(content: string): 'reservation' | 'greeting' | 'help' | 'unknown' {
    const lowerContent = content.toLowerCase().trim();

    // Reservation keywords
    const reservationKeywords = [
      'reservar', 'reserva', 'mesa', 'table', 'reservation', 'book',
      'quiero reservar', 'necesito una mesa', 'disponibilidad', 'availability',
      'hacer una reserva', 'agendar', 'cita'
    ];

    // Greeting keywords
    const greetingKeywords = [
      'hola', 'hi', 'hello', 'buenos días', 'buenas tardes', 'buenas noches',
      'saludos', 'hey'
    ];

    // Help keywords
    const helpKeywords = [
      'ayuda', 'help', 'información', 'info', 'qué puedo hacer', 'opciones'
    ];

    if (reservationKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'reservation';
    }

    if (greetingKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'greeting';
    }

    if (helpKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'help';
    }

    return 'unknown';
  }

  /**
   * Get conversation context from database
   */
  private async getConversationContext(
    userId: string,
    conversationId: string,
    client: PoolClient
  ): Promise<ConversationContext> {
    const contextQuery = `
      SELECT context FROM conversations
      WHERE id = $1
    `;
    const result = await client.query(contextQuery, [conversationId]);

    const context: ConversationContext = {
      userId,
      conversationId,
      intent: 'unknown',
      reservationData: {},
      step: 'greeting',
    };

    if (result.rows.length > 0 && result.rows[0].context) {
      const savedContext = result.rows[0].context;
      if (typeof savedContext === 'object') {
        context.intent = savedContext.intent || 'unknown';
        context.reservationData = savedContext.reservationData || {};
        context.step = savedContext.step || 'greeting';
      }
    }

    return context;
  }

  /**
   * Save conversation context to database
   */
  private async saveConversationContext(
    conversationId: string,
    context: ConversationContext,
    client: PoolClient
  ): Promise<void> {
    const updateQuery = `
      UPDATE conversations
      SET context = $1
      WHERE id = $2
    `;
    await client.query(updateQuery, [
      JSON.stringify({
        intent: context.intent,
        reservationData: context.reservationData,
        step: context.step,
      }),
      conversationId,
    ]);
  }

  /**
   * Extract date from message
   */
  private extractDate(content: string): string | null {
    const _lowerContent = content.toLowerCase();
    
    // Today
    if (lowerContent.includes('hoy') || lowerContent.includes('today')) {
      const today = new Date();
      return today.toISOString().split('T')[0]!;
    }

    // Tomorrow
    if (lowerContent.includes('mañana') || lowerContent.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0]!;
    }

    // Date patterns: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /\d{2}\/\d{2}\/\d{4}/, // DD/MM/YYYY or MM/DD/YYYY
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        const dateStr = match[0]!;
        // Try to parse and format as YYYY-MM-DD
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0]!;
        }
      }
    }

    return null;
  }

  /**
   * Extract time from message
   */
  private extractTime(content: string): string | null {
    // Time patterns: HH:mm, HH:mm AM/PM, H:mm
    const timePatterns = [
      /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i,
      /\b(\d{1,2})\s*(am|pm)\b/i,
    ];

    for (const pattern of timePatterns) {
      const match = content.match(pattern);
      if (match) {
        let hours = parseInt(match[1] || match[0]!, 10);
        const minutes = parseInt(match[2] || '0', 10);
        const period = (match[3] || match[2] || '').toLowerCase();

        if (period === 'pm' && hours !== 12) {
          hours += 12;
        } else if (period === 'am' && hours === 12) {
          hours = 0;
        }

        if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }
    }

    return null;
  }

  /**
   * Extract party size from message
   */
  private extractPartySize(content: string): number | null {
    const lowerContent = content.toLowerCase();
    
    // Patterns: "2 personas", "for 4", "party of 3"
    const patterns = [
      /\b(\d+)\s*(personas?|people|guests?|comensales?)\b/i,
      /\b(para|for)\s+(\d+)\b/i,
      /\b(\d+)\s*(personas?|people)\b/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const size = parseInt(match[1] || match[2] || '0', 10);
        if (size > 0 && size <= 20) {
          return size;
        }
      }
    }

    // Direct number
    const numberMatch = content.match(/\b(\d+)\b/);
    if (numberMatch) {
      const size = parseInt(numberMatch[1]!, 10);
      if (size > 0 && size <= 20) {
        return size;
      }
    }

    return null;
  }

  /**
   * Get list of restaurants
   */
  private async getRestaurants(client: PoolClient): Promise<Array<{ id: string; name: string }>> {
    const query = `
      SELECT id, name FROM restaurants
      ORDER BY name
      LIMIT 10
    `;
    const result = await client.query(query);
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
    }));
  }

  /**
   * Generate bot response based on context
   */
  private async generateResponse(
    userMessage: string,
    context: ConversationContext,
    client: PoolClient
  ): Promise<string> {
    const intent = this.detectIntent(userMessage);
    
    // Update context intent if detected
    if (intent !== 'unknown' && !context.intent) {
      context.intent = intent;
    }

    // Handle greeting
    if (intent === 'greeting' || context.step === 'greeting') {
      context.step = 'asking_restaurant';
      const restaurants = await this.getRestaurants(client);
      
      if (restaurants.length === 0) {
        return '¡Hola! Lamentablemente no hay restaurantes disponibles en este momento.';
      }

      const restaurantList = restaurants
        .map((r, i) => `${i + 1}. ${r.name}`)
        .join('\n');

      return `¡Hola! 👋 Bienvenido a SaveIt. Estoy aquí para ayudarte a hacer una reserva.\n\nRestaurantes disponibles:\n${restaurantList}\n\n¿En cuál restaurante te gustaría reservar? (Puedes escribir el nombre o el número)`;
    }

    // Handle help
    if (intent === 'help') {
      return 'Puedo ayudarte a:\n\n✅ Hacer una reserva en uno de nuestros restaurantes\n✅ Consultar disponibilidad\n✅ Modificar o cancelar reservas\n\n¿Qué te gustaría hacer?';
    }

    // Handle reservation flow
    if (context.intent === 'reservation' || intent === 'reservation') {
      context.intent = 'reservation';

      // Step 1: Get restaurant
      if (context.step === 'asking_restaurant' || !context.reservationData?.restaurantId) {
        const restaurants = await this.getRestaurants(client);
        const lowerMessage = userMessage.toLowerCase();

        // Try to find restaurant by name or number
        const restaurantMatch = restaurants.find((r, i) => {
          const nameMatch = r.name.toLowerCase().includes(lowerMessage);
          const numberMatch = lowerMessage.includes((i + 1).toString());
          return nameMatch || numberMatch;
        });

        if (restaurantMatch) {
          context.reservationData!.restaurantId = restaurantMatch.id;
          context.step = 'asking_date';
          await this.saveConversationContext(context.conversationId, context, client);
          return `Perfecto, has elegido ${restaurantMatch.name}. ¿Para qué fecha te gustaría hacer la reserva? (Puedes decir "hoy", "mañana" o una fecha específica)`;
        } else {
          const restaurantList = restaurants
            .map((r, i) => `${i + 1}. ${r.name}`)
            .join('\n');
          return `No encontré ese restaurante. Por favor, elige uno de la lista:\n\n${restaurantList}`;
        }
      }

      // Step 2: Get date
      if (context.step === 'asking_date' || (!context.reservationData?.date && context.reservationData?.restaurantId)) {
        const date = this.extractDate(userMessage);
        if (date) {
          context.reservationData!.date = date;
          context.step = 'asking_time';
          await this.saveConversationContext(context.conversationId, context, client);
          return `Excelente. ¿A qué hora te gustaría? (Por ejemplo: 19:00, 8:00 PM, 20:30)`;
        } else {
          return 'Por favor, indica una fecha. Puedes decir "hoy", "mañana" o una fecha específica (ej: 2026-01-15)';
        }
      }

      // Step 3: Get time
      if (context.step === 'asking_time' || (!context.reservationData?.timeSlot && context.reservationData?.date)) {
        const time = this.extractTime(userMessage);
        if (time) {
          context.reservationData!.timeSlot = time;
          context.step = 'asking_party_size';
          await this.saveConversationContext(context.conversationId, context, client);
          return `Perfecto. ¿Para cuántas personas es la reserva?`;
        } else {
          return 'Por favor, indica una hora. Por ejemplo: 19:00, 8:00 PM, 20:30';
        }
      }

      // Step 4: Get party size
      if (context.step === 'asking_party_size' || (!context.reservationData?.partySize && context.reservationData?.timeSlot)) {
        const partySize = this.extractPartySize(userMessage);
        if (partySize) {
          context.reservationData!.partySize = partySize;
          context.step = 'asking_contact';
          await this.saveConversationContext(context.conversationId, context, client);
          return `Excelente. Para completar la reserva, necesito algunos datos:\n\n¿Cuál es tu nombre?`;
        } else {
          return 'Por favor, indica el número de personas (ej: 2, 4 personas, para 3)';
        }
      }

      // Step 5: Get contact info
      if (context.step === 'asking_contact') {
        if (!context.reservationData!.guestName) {
          context.reservationData!.guestName = userMessage.trim();
          await this.saveConversationContext(context.conversationId, context, client);
          return `Gracias ${context.reservationData!.guestName}. ¿Cuál es tu número de teléfono?`;
        } else if (!context.reservationData!.guestPhone) {
          context.reservationData!.guestPhone = userMessage.trim();
          await this.saveConversationContext(context.conversationId, context, client);
          return `¿Y tu email? (opcional)`;
        } else if (!context.reservationData!.guestEmail) {
          const email = userMessage.trim();
          if (email && email.includes('@')) {
            context.reservationData!.guestEmail = email;
          }
          context.step = 'confirming';
          await this.saveConversationContext(context.conversationId, context, client);
          
          const reservationData = context.reservationData!;
          return `Perfecto. Resumen de tu reserva:\n\n📅 Fecha: ${reservationData.date}\n🕐 Hora: ${reservationData.timeSlot}\n👥 Personas: ${reservationData.partySize}\n👤 Nombre: ${reservationData.guestName}\n📞 Teléfono: ${reservationData.guestPhone}${reservationData.guestEmail ? `\n📧 Email: ${reservationData.guestEmail}` : ''}\n\n¿Confirmas esta reserva? (responde "sí" o "confirmar")`;
        }
      }

      // Step 6: Confirm reservation
      if (context.step === 'confirming') {
        const lowerMessage = userMessage.toLowerCase();
        if (lowerMessage.includes('sí') || lowerMessage.includes('si') || lowerMessage.includes('confirmar') || lowerMessage.includes('confirm')) {
          // Create reservation via API
          try {
            const reservationData = context.reservationData!;
            const reservationResponse = await fetch(`http://localhost:3001/api/reservations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                restaurantId: reservationData.restaurantId,
                date: reservationData.date,
                timeSlot: reservationData.timeSlot,
                partySize: reservationData.partySize,
                guestName: reservationData.guestName,
                guestPhone: reservationData.guestPhone,
                guestEmail: reservationData.guestEmail,
                specialRequests: reservationData.specialRequests,
                channel: 'webchat',
              }),
            });

            if (reservationResponse.ok) {
              const reservation = await reservationResponse.json() as { data: { id: string } };
              context.step = 'completed';
              await this.saveConversationContext(context.conversationId, context, client);
              return `¡Reserva confirmada! ✅\n\nTu número de reserva es: ${reservation.data.id}\n\nTe esperamos el ${reservationData.date} a las ${reservationData.timeSlot} para ${reservationData.partySize} personas.\n\n¿Necesitas algo más?`;
            } else {
              const error = await reservationResponse.json() as { error?: { message?: string } };
              return `Lo siento, hubo un problema al crear la reserva: ${error.error?.message || 'Error desconocido'}\n\n¿Quieres intentar con otra fecha u hora?`;
            }
          } catch (error) {
            logger.error('Error creating reservation', error instanceof Error ? error : undefined);
            return 'Lo siento, hubo un error al procesar tu reserva. Por favor, intenta nuevamente o contacta con nosotros directamente.';
          }
        } else {
          return 'Reserva cancelada. ¿Te gustaría hacer una nueva reserva?';
        }
      }
    }

    // Default response
    return 'No estoy seguro de cómo ayudarte con eso. ¿Te gustaría hacer una reserva? (responde "sí" o "reservar")';
  }

  /**
   * Process incoming message and generate automatic response
   */
  async processMessage(
    userId: string,
    conversationId: string,
    userMessage: string,
    client: PoolClient
  ): Promise<string | null> {
    try {
      logger.info('Processing message with bot', { userId, conversationId, userMessage });
      const context = await this.getConversationContext(userId, conversationId, client);
      logger.info('Context retrieved', { context });
      const botResponse = await this.generateResponse(userMessage, context, client);
      logger.info('Bot response generated', { botResponse });
      
      // Save updated context
      await this.saveConversationContext(conversationId, context, client);

      return botResponse;
    } catch (error) {
      logger.error('Error processing message in chat bot', error instanceof Error ? error : undefined);
      return 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta nuevamente.';
    }
  }
}

