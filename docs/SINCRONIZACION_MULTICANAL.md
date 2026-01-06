# SaveIt App - Sincronización Multi-Canal

## Principio Fundamental

**TODOS LOS CANALES COMPARTEN LA MISMA FUENTE DE VERDAD**  
**SINCRONIZACIÓN ATÓMICA INDEPENDIENTE DEL ORIGEN**  
**EXPERIENCIA CONSISTENTE EN TODOS LOS PUNTOS DE CONTACTO**

---

## 1. Arquitectura de Canales Unificada

### 1.1 Canales Soportados

```yaml
Canales de Entrada:
  - WhatsApp Business API (vía Twilio/Meta)
  - Instagram Direct Messages (vía Meta Graph API)
  - WebChat Widget (embebido en sitios web)
  - Email (Amazon SES)
  
Canales Futuros:
  - SMS (Amazon SNS)
  - Google Business Messages
  - Facebook Messenger
  - Telegram
  - Voice (Amazon Connect)
```

### 1.2 Capa de Abstracción de Canales

```typescript
// shared/types/Channel.ts

/**
 * Tipos de canales soportados
 */
export enum ChannelType {
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  WEBCHAT = 'webchat',
  EMAIL = 'email',
  SMS = 'sms',
  VOICE = 'voice'
}

/**
 * Mensaje unificado entre canales
 */
interface UnifiedMessage {
  // Identificación
  messageId: string;
  conversationId: string;
  
  // Canal
  channel: ChannelType;
  channelMessageId: string; // ID del mensaje en el canal original
  
  // Usuario
  userId: string;
  userIdentifier: string; // phone, email, username según canal
  
  // Contenido
  content: {
    text?: string;
    attachments?: Attachment[];
    quickReplies?: QuickReply[];
  };
  
  // Contexto
  intent?: string; // detectado por NLU
  entities?: Record<string, any>; // extraídos del mensaje
  
  // Metadata
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  metadata: Record<string, any>;
}

/**
 * Respuesta unificada para enviar a cualquier canal
 */
interface UnifiedResponse {
  conversationId: string;
  channel: ChannelType;
  recipient: string;
  
  content: {
    text: string;
    buttons?: Button[];
    quickReplies?: QuickReply[];
    attachments?: Attachment[];
  };
  
  metadata?: Record<string, any>;
}
```

---

## 2. Gateway de Canales Unificado

### 2.1 Channel Gateway Service

```typescript
// channel-gateway/src/ChannelGateway.ts

/**
 * Gateway central que recibe mensajes de TODOS los canales
 * y los normaliza a un formato unificado
 */
class ChannelGateway {
  private adapters: Map<ChannelType, ChannelAdapter>;
  private redis: RedisClient;
  private eventBus: EventBridge;
  
  constructor() {
    // Registrar adaptadores para cada canal
    this.adapters = new Map([
      [ChannelType.WHATSAPP, new WhatsAppAdapter()],
      [ChannelType.INSTAGRAM, new InstagramAdapter()],
      [ChannelType.WEBCHAT, new WebChatAdapter()],
      [ChannelType.EMAIL, new EmailAdapter()],
    ]);
  }
  
  /**
   * Recibe mensaje de cualquier canal y lo normaliza
   * GARANTÍA: Todos los canales pasan por aquí
   */
  async receiveMessage(
    channel: ChannelType,
    rawMessage: any
  ): Promise<UnifiedMessage> {
    
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new UnsupportedChannelError(`Channel ${channel} not supported`);
    }
    
    // 1. Normalizar mensaje del canal específico
    const unifiedMessage = await adapter.normalizeInbound(rawMessage);
    
    // 2. Identificar/crear usuario (idempotente)
    const user = await this.identifyUser(unifiedMessage);
    unifiedMessage.userId = user.id;
    
    // 3. Obtener o crear conversación
    const conversation = await this.getOrCreateConversation(
      user.id,
      channel,
      unifiedMessage.userIdentifier
    );
    unifiedMessage.conversationId = conversation.id;
    
    // 4. Guardar mensaje en base de datos central
    await this.saveMessage(unifiedMessage);
    
    // 5. Publicar evento para procesamiento
    await this.eventBus.publish({
      source: 'channel-gateway',
      detailType: 'message.received',
      detail: {
        messageId: unifiedMessage.messageId,
        conversationId: unifiedMessage.conversationId,
        channel: channel,
        userId: user.id,
        content: unifiedMessage.content,
        timestamp: unifiedMessage.timestamp
      }
    });
    
    return unifiedMessage;
  }
  
  /**
   * Envía respuesta a cualquier canal
   * GARANTÍA: Mismo mensaje adaptado a cada canal
   */
  async sendMessage(response: UnifiedResponse): Promise<void> {
    
    const adapter = this.adapters.get(response.channel);
    if (!adapter) {
      throw new UnsupportedChannelError(`Channel ${response.channel} not supported`);
    }
    
    // 1. Adaptar respuesta al formato del canal específico
    const channelMessage = await adapter.normalizeOutbound(response);
    
    // 2. Enviar a través del canal
    const result = await adapter.send(channelMessage);
    
    // 3. Guardar respuesta enviada
    await this.saveMessage({
      messageId: result.messageId,
      conversationId: response.conversationId,
      channel: response.channel,
      userId: '', // system message
      userIdentifier: response.recipient,
      content: response.content,
      timestamp: new Date(),
      direction: 'outbound',
      metadata: result.metadata
    });
    
    // 4. Actualizar última interacción
    await this.updateConversationTimestamp(response.conversationId);
  }
  
  /**
   * Identifica usuario de manera unificada entre canales
   * CRÍTICO: Mismo usuario puede usar múltiples canales
   */
  private async identifyUser(message: UnifiedMessage): Promise<User> {
    
    // Buscar usuario por identificador del canal
    let user = await this.db.query(`
      SELECT u.* 
      FROM users u
      JOIN user_channel_identifiers uci ON uci.user_id = u.id
      WHERE 
        uci.channel = $1 
        AND uci.identifier = $2
    `, [message.channel, message.userIdentifier]);
    
    if (user) {
      return user;
    }
    
    // Buscar por identificador normalizado (ej: mismo teléfono)
    const normalized = this.normalizeIdentifier(
      message.channel,
      message.userIdentifier
    );
    
    user = await this.db.query(`
      SELECT u.* 
      FROM users u
      WHERE u.phone = $1 OR u.email = $2
    `, [normalized.phone, normalized.email]);
    
    if (user) {
      // Vincular nuevo canal al usuario existente
      await this.linkChannelToUser(
        user.id,
        message.channel,
        message.userIdentifier
      );
      return user;
    }
    
    // Crear nuevo usuario
    return await this.createUser(message.channel, message.userIdentifier);
  }
  
  /**
   * Obtiene o crea conversación para usuario en canal específico
   */
  private async getOrCreateConversation(
    userId: string,
    channel: ChannelType,
    identifier: string
  ): Promise<Conversation> {
    
    // Buscar conversación activa
    let conversation = await this.db.query(`
      SELECT * FROM conversations
      WHERE 
        user_id = $1 
        AND channel = $2
        AND status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `, [userId, channel]);
    
    if (conversation) {
      return conversation;
    }
    
    // Crear nueva conversación
    return await this.db.query(`
      INSERT INTO conversations (
        id, user_id, channel, channel_identifier, 
        status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 
        'active', NOW(), NOW()
      )
      RETURNING *
    `, [userId, channel, identifier]);
  }
}
```

### 2.2 Adaptadores de Canales

```typescript
// channel-gateway/src/adapters/WhatsAppAdapter.ts

interface ChannelAdapter {
  normalizeInbound(rawMessage: any): Promise<UnifiedMessage>;
  normalizeOutbound(response: UnifiedResponse): Promise<any>;
  send(message: any): Promise<SendResult>;
}

class WhatsAppAdapter implements ChannelAdapter {
  
  async normalizeInbound(rawMessage: any): Promise<UnifiedMessage> {
    // Mensaje de WhatsApp via Twilio/Meta
    return {
      messageId: uuidv4(),
      conversationId: '', // se asignará después
      channel: ChannelType.WHATSAPP,
      channelMessageId: rawMessage.MessageSid || rawMessage.id,
      userId: '', // se asignará después
      userIdentifier: rawMessage.From || rawMessage.from,
      content: {
        text: rawMessage.Body || rawMessage.text?.body,
        attachments: this.extractAttachments(rawMessage)
      },
      timestamp: new Date(rawMessage.timestamp || Date.now()),
      direction: 'inbound',
      metadata: {
        profileName: rawMessage.ProfileName,
        waId: rawMessage.WaId
      }
    };
  }
  
  async normalizeOutbound(response: UnifiedResponse): Promise<any> {
    // Formato para Twilio WhatsApp API
    return {
      to: response.recipient,
      body: response.content.text,
      mediaUrl: response.content.attachments?.map(a => a.url),
      // Buttons se convierten en quick replies en WhatsApp
      // (limitaciones del canal)
    };
  }
  
  async send(message: any): Promise<SendResult> {
    const result = await this.twilioClient.messages.create(message);
    return {
      messageId: result.sid,
      status: 'sent',
      metadata: { sid: result.sid }
    };
  }
}

class InstagramAdapter implements ChannelAdapter {
  
  async normalizeInbound(rawMessage: any): Promise<UnifiedMessage> {
    // Mensaje de Instagram via Meta Graph API
    return {
      messageId: uuidv4(),
      conversationId: '',
      channel: ChannelType.INSTAGRAM,
      channelMessageId: rawMessage.id,
      userId: '',
      userIdentifier: rawMessage.sender.id,
      content: {
        text: rawMessage.message?.text,
        attachments: this.extractAttachments(rawMessage.message)
      },
      timestamp: new Date(rawMessage.timestamp),
      direction: 'inbound',
      metadata: {
        igId: rawMessage.sender.id
      }
    };
  }
  
  async normalizeOutbound(response: UnifiedResponse): Promise<any> {
    // Formato para Instagram Messaging API
    const message: any = {
      recipient: { id: response.recipient },
      message: { text: response.content.text }
    };
    
    // Instagram soporta quick replies
    if (response.content.quickReplies) {
      message.message.quick_replies = response.content.quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload
      }));
    }
    
    return message;
  }
  
  async send(message: any): Promise<SendResult> {
    const result = await this.graphAPI.post('/me/messages', message);
    return {
      messageId: result.message_id,
      status: 'sent',
      metadata: result
    };
  }
}

class WebChatAdapter implements ChannelAdapter {
  
  async normalizeInbound(rawMessage: any): Promise<UnifiedMessage> {
    // Mensaje del WebChat widget
    return {
      messageId: uuidv4(),
      conversationId: rawMessage.conversationId || '',
      channel: ChannelType.WEBCHAT,
      channelMessageId: rawMessage.id,
      userId: rawMessage.userId || '',
      userIdentifier: rawMessage.sessionId,
      content: {
        text: rawMessage.text,
        attachments: rawMessage.attachments
      },
      timestamp: new Date(rawMessage.timestamp),
      direction: 'inbound',
      metadata: {
        sessionId: rawMessage.sessionId,
        userAgent: rawMessage.userAgent,
        ipAddress: rawMessage.ipAddress
      }
    };
  }
  
  async normalizeOutbound(response: UnifiedResponse): Promise<any> {
    // WebChat soporta rich content
    return {
      conversationId: response.conversationId,
      text: response.content.text,
      buttons: response.content.buttons,
      quickReplies: response.content.quickReplies,
      attachments: response.content.attachments
    };
  }
  
  async send(message: any): Promise<SendResult> {
    // Enviar via WebSocket
    await this.websocketManager.sendToConnection(
      message.conversationId,
      message
    );
    
    return {
      messageId: uuidv4(),
      status: 'delivered',
      metadata: {}
    };
  }
}
```

---

## 3. Sincronización en Tiempo Real Entre Canales

### 3.1 Estado de Conversación Compartido

```typescript
// conversation-manager/src/ConversationState.ts

/**
 * Gestiona estado de conversación de manera unificada
 * GARANTÍA: Estado consistente sin importar el canal
 */
class ConversationStateManager {
  private redis: RedisClient;
  private db: PostgresClient;
  
  /**
   * Obtiene estado actual de conversación
   * UNIFICADO: Mismo estado para todos los canales del usuario
   */
  async getState(conversationId: string): Promise<ConversationState> {
    
    // 1. Intentar desde cache (Redis)
    const cached = await this.redis.get(`conversation:${conversationId}`);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // 2. Cargar desde DB
    const state = await this.db.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.phone as user_phone,
        u.email as user_email,
        COUNT(m.id) as message_count
      FROM conversations c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.id = $1
      GROUP BY c.id, u.id
    `, [conversationId]);
    
    // 3. Cachear (TTL 1 hora)
    await this.redis.setex(
      `conversation:${conversationId}`,
      3600,
      JSON.stringify(state)
    );
    
    return state;
  }
  
  /**
   * Actualiza contexto de conversación
   * SINCRONIZADO: Actualización atómica visible en todos los canales
   */
  async updateContext(
    conversationId: string,
    context: Record<string, any>
  ): Promise<void> {
    
    // Script Lua para actualización atómica en Redis
    const luaScript = `
      local key = KEYS[1]
      local context = cjson.decode(ARGV[1])
      
      local current = redis.call("GET", key)
      if current then
        local state = cjson.decode(current)
        for k, v in pairs(context) do
          state.context[k] = v
        end
        state.updated_at = ARGV[2]
        redis.call("SETEX", key, 3600, cjson.encode(state))
        return 1
      end
      return 0
    `;
    
    const updated = await this.redis.eval(
      luaScript,
      1,
      `conversation:${conversationId}`,
      JSON.stringify(context),
      new Date().toISOString()
    );
    
    // Actualizar en DB (asíncrono)
    await this.db.query(`
      UPDATE conversations
      SET 
        context = context || $2::jsonb,
        updated_at = NOW()
      WHERE id = $1
    `, [conversationId, context]);
    
    // Publicar evento de actualización
    await this.eventBus.publish({
      source: 'conversation-manager',
      detailType: 'conversation.context.updated',
      detail: {
        conversationId,
        context,
        timestamp: new Date()
      }
    });
  }
}
```

### 3.2 Intención de Reserva Multi-Canal

```typescript
// reservation-intent/src/ReservationIntentHandler.ts

/**
 * Maneja intención de reserva INDEPENDIENTE del canal
 * GARANTÍA: Misma lógica para WhatsApp, Instagram, WebChat, etc.
 */
class ReservationIntentHandler {
  private conversationState: ConversationStateManager;
  private reservationService: ReservationService;
  private channelGateway: ChannelGateway;
  
  /**
   * Procesa intención de hacer reserva
   * CANAL-AGNÓSTICO: Funciona igual para todos los canales
   */
  async handle(message: UnifiedMessage): Promise<void> {
    
    // 1. Obtener estado actual de la conversación
    const state = await this.conversationState.getState(message.conversationId);
    
    // 2. Extraer información de reserva del mensaje y contexto
    const reservationData = await this.extractReservationData(message, state);
    
    // 3. Validar si tenemos toda la información necesaria
    const validation = this.validateReservationData(reservationData);
    
    if (!validation.complete) {
      // Faltan datos, preguntar al usuario
      await this.askForMissingData(
        message.conversationId,
        message.channel,
        message.userIdentifier,
        validation.missingFields
      );
      return;
    }
    
    // 4. CREAR RESERVA (proceso sincronizado)
    const reservationResult = await this.createReservation(
      message.userId,
      reservationData,
      {
        channel: message.channel,
        conversationId: message.conversationId,
        ipAddress: message.metadata.ipAddress
      }
    );
    
    if (!reservationResult.success) {
      // Reserva falló, informar al usuario
      await this.sendErrorResponse(
        message.conversationId,
        message.channel,
        message.userIdentifier,
        reservationResult.error
      );
      return;
    }
    
    // 5. Enviar confirmación
    await this.sendConfirmation(
      message.conversationId,
      message.channel,
      message.userIdentifier,
      reservationResult.reservation
    );
    
    // 6. Actualizar estado de conversación
    await this.conversationState.updateContext(message.conversationId, {
      lastReservationId: reservationResult.reservation.id,
      lastAction: 'reservation_created',
      reservationStatus: 'confirmed'
    });
  }
  
  /**
   * Crea reserva usando el servicio centralizado
   * SINCRONIZADO: Mismo proceso de locks y validaciones
   */
  private async createReservation(
    userId: string,
    data: ReservationData,
    source: ReservationSource
  ): Promise<ReservationResult> {
    
    // Llamar al reservation service (mismo usado por API REST)
    return await this.reservationService.createReservation({
      userId,
      restaurantId: data.restaurantId,
      date: data.date,
      timeSlot: data.timeSlot,
      partySize: data.partySize,
      tableId: data.tableId,
      specialRequests: data.specialRequests,
      phoneVerified: true, // Ya verificado por el canal
      source: source.channel,
      metadata: {
        conversationId: source.conversationId,
        ipAddress: source.ipAddress
      }
    });
  }
  
  /**
   * Envía confirmación adaptada al canal
   */
  private async sendConfirmation(
    conversationId: string,
    channel: ChannelType,
    recipient: string,
    reservation: Reservation
  ): Promise<void> {
    
    const response: UnifiedResponse = {
      conversationId,
      channel,
      recipient,
      content: {
        text: this.buildConfirmationMessage(reservation),
        buttons: this.buildConfirmationButtons(reservation, channel),
        attachments: [
          {
            type: 'image',
            url: reservation.qrCodeUrl,
            caption: 'Tu código QR de reserva'
          }
        ]
      }
    };
    
    await this.channelGateway.sendMessage(response);
  }
  
  /**
   * Construye mensaje de confirmación
   * CONSISTENTE: Mismo contenido para todos los canales
   */
  private buildConfirmationMessage(reservation: Reservation): string {
    return `
✅ ¡Reserva confirmada!

📍 Restaurante: ${reservation.restaurantName}
📅 Fecha: ${formatDate(reservation.date)}
🕐 Hora: ${reservation.timeSlot}
👥 Personas: ${reservation.partySize}
🔢 Mesa: ${reservation.tableNumber}

📱 Guarda este mensaje y muestra el código QR al llegar.

ID de reserva: ${reservation.id}
    `.trim();
  }
  
  /**
   * Construye botones adaptados al canal
   * ADAPTADO: Respeta capacidades de cada canal
   */
  private buildConfirmationButtons(
    reservation: Reservation,
    channel: ChannelType
  ): Button[] {
    
    const buttons: Button[] = [
      {
        type: 'postback',
        title: 'Ver detalles',
        payload: `VIEW_RESERVATION:${reservation.id}`
      },
      {
        type: 'postback',
        title: 'Cancelar reserva',
        payload: `CANCEL_RESERVATION:${reservation.id}`
      }
    ];
    
    // WebChat soporta más botones
    if (channel === ChannelType.WEBCHAT) {
      buttons.push({
        type: 'url',
        title: 'Agregar a calendario',
        url: `${process.env.APP_URL}/calendar/${reservation.id}`
      });
    }
    
    // WhatsApp/Instagram tienen límites
    if (channel === ChannelType.WHATSAPP || channel === ChannelType.INSTAGRAM) {
      // Máximo 3 botones
      return buttons.slice(0, 3);
    }
    
    return buttons;
  }
}
```

---

## 4. Broadcast Multi-Canal

### 4.1 Notificaciones Simultáneas

```typescript
// notification-service/src/MultiChannelNotifier.ts

/**
 * Envía notificaciones a usuarios por TODOS sus canales activos
 * GARANTÍA: Usuario recibe mensaje sin importar dónde esté
 */
class MultiChannelNotifier {
  private channelGateway: ChannelGateway;
  
  /**
   * Envía notificación a usuario en todos sus canales
   */
  async notifyUser(
    userId: string,
    notification: Notification
  ): Promise<NotificationResult> {
    
    // 1. Obtener canales activos del usuario
    const channels = await this.getUserActiveChannels(userId);
    
    if (channels.length === 0) {
      return {
        success: false,
        error: 'No active channels for user'
      };
    }
    
    // 2. Enviar por TODOS los canales en paralelo
    const results = await Promise.allSettled(
      channels.map(channel =>
        this.sendToChannel(userId, channel, notification)
      )
    );
    
    // 3. Registrar envíos
    const successful = results.filter(r => r.status === 'fulfilled');
    const failed = results.filter(r => r.status === 'rejected');
    
    await this.recordNotification({
      userId,
      notificationId: notification.id,
      channels: channels.map(c => c.channel),
      successCount: successful.length,
      failedCount: failed.length,
      timestamp: new Date()
    });
    
    return {
      success: successful.length > 0,
      channelsReached: successful.length,
      channelsFailed: failed.length,
      details: results
    };
  }
  
  /**
   * Obtiene canales donde el usuario está activo
   */
  private async getUserActiveChannels(userId: string): Promise<UserChannel[]> {
    
    return await this.db.query(`
      SELECT 
        uci.channel,
        uci.identifier,
        uci.active,
        uci.last_used_at,
        uci.preferences
      FROM user_channel_identifiers uci
      WHERE 
        uci.user_id = $1
        AND uci.active = true
        AND uci.opt_out = false
      ORDER BY uci.last_used_at DESC
    `, [userId]);
  }
  
  /**
   * Envía notificación por un canal específico
   */
  private async sendToChannel(
    userId: string,
    channel: UserChannel,
    notification: Notification
  ): Promise<void> {
    
    // Obtener conversación activa en ese canal
    const conversation = await this.getOrCreateConversation(
      userId,
      channel.channel,
      channel.identifier
    );
    
    // Adaptar notificación al canal
    const message: UnifiedResponse = {
      conversationId: conversation.id,
      channel: channel.channel,
      recipient: channel.identifier,
      content: this.adaptNotificationToChannel(notification, channel.channel)
    };
    
    // Enviar
    await this.channelGateway.sendMessage(message);
  }
}
```

### 4.2 Sincronización de Disponibilidad en Tiempo Real

```typescript
// availability-sync/src/AvailabilitySyncService.ts

/**
 * Sincroniza disponibilidad en tiempo real para TODOS los canales
 * GARANTÍA: Todos los usuarios ven la misma disponibilidad al mismo tiempo
 */
class AvailabilitySyncService {
  private redis: RedisClient;
  private websocketManager: WebSocketManager;
  private eventBus: EventBridge;
  
  /**
   * Escucha eventos de cambio de disponibilidad
   */
  async initialize(): Promise<void> {
    
    // Suscribirse a eventos de reserva/cancelación
    await this.eventBus.subscribe([
      'reservation.created',
      'reservation.cancelled',
      'reservation.no_show',
      'table.status_changed'
    ], async (event) => {
      await this.handleAvailabilityChange(event);
    });
  }
  
  /**
   * Maneja cambio de disponibilidad
   */
  private async handleAvailabilityChange(event: any): Promise<void> {
    
    const { restaurantId, date, timeSlot } = event.detail;
    
    // 1. Invalidar cache
    await this.redis.del(`availability:${restaurantId}:${date}:${timeSlot}`);
    
    // 2. Calcular nueva disponibilidad
    const availability = await this.calculateAvailability(
      restaurantId,
      date,
      timeSlot
    );
    
    // 3. Actualizar cache
    await this.redis.setex(
      `availability:${restaurantId}:${date}:${timeSlot}`,
      30, // 30 segundos TTL
      JSON.stringify(availability)
    );
    
    // 4. Notificar a TODAS las conexiones activas (WebChat)
    await this.broadcastToWebChat(restaurantId, date, availability);
    
    // 5. Actualizar conversaciones activas en otros canales
    await this.notifyActiveConversations(restaurantId, date, availability);
  }
  
  /**
   * Broadcast a todas las conexiones WebSocket
   */
  private async broadcastToWebChat(
    restaurantId: string,
    date: string,
    availability: Availability
  ): Promise<void> {
    
    // Obtener todas las conexiones WebSocket activas para este restaurant
    const connections = await this.websocketManager.getConnectionsByContext({
      restaurantId,
      date
    });
    
    const message = {
      type: 'availability_update',
      restaurantId,
      date,
      availability
    };
    
    // Enviar a todas las conexiones en paralelo
    await Promise.all(
      connections.map(conn =>
        this.websocketManager.sendToConnection(conn.connectionId, message)
      )
    );
  }
  
  /**
   * Notifica a conversaciones activas en WhatsApp/Instagram/etc
   */
  private async notifyActiveConversations(
    restaurantId: string,
    date: string,
    availability: Availability
  ): Promise<void> {
    
    // Buscar conversaciones activas haciendo reservas para este restaurant/fecha
    const activeConversations = await this.db.query(`
      SELECT DISTINCT
        c.id as conversation_id,
        c.channel,
        c.channel_identifier,
        c.user_id,
        c.context
      FROM conversations c
      WHERE 
        c.status = 'active'
        AND c.context->>'intent' = 'make_reservation'
        AND c.context->>'restaurantId' = $1
        AND c.context->>'date' = $2
        AND c.updated_at > NOW() - INTERVAL '30 minutes'
    `, [restaurantId, date]);
    
    // Notificar solo si la disponibilidad cambió significativamente
    if (!availability.available) {
      // Ya no hay disponibilidad, notificar a usuarios
      for (const conv of activeConversations) {
        await this.channelGateway.sendMessage({
          conversationId: conv.conversation_id,
          channel: conv.channel,
          recipient: conv.channel_identifier,
          content: {
            text: `⚠️ El horario que estabas consultando ya no está disponible. Te muestro otras opciones:`,
            quickReplies: this.buildAlternativeTimeSlots(availability.alternatives)
          }
        });
      }
    }
  }
}
```

---

## 5. Diagrama de Flujo Multi-Canal

```
┌─────────────────────────────────────────────────────────────────┐
│                    MÚLTIPLES PUNTOS DE ENTRADA                   │
├────────────┬────────────┬────────────┬────────────┬─────────────┤
│  WhatsApp  │ Instagram  │  WebChat   │   Email    │     SMS     │
└─────┬──────┴─────┬──────┴─────┬──────┴─────┬──────┴──────┬──────┘
      │            │            │            │             │
      └────────────┴────────────┴────────────┴─────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │    CHANNEL GATEWAY         │
                  │  (Normalización Unificada) │
                  └─────────────┬──────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │   UNIFIED MESSAGE QUEUE    │
                  │    (EventBridge + SQS)     │
                  └─────────────┬──────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
      ┌─────────▼────────┐ ┌───▼────────┐ ┌───▼─────────┐
      │   NLU Service    │ │  Identity  │ │ Conversation│
      │ (Intent Detect)  │ │  Service   │ │   Manager   │
      └─────────┬────────┘ └───┬────────┘ └───┬─────────┘
                │              │              │
                └──────────────┴──────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │   RESERVATION PROCESSOR    │
                  │  (Canal-Agnóstico)         │
                  └─────────────┬──────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
      ┌─────────▼────────┐ ┌───▼────────┐ ┌───▼─────────┐
      │  Lock Manager    │ │    RDS     │ │   Redis     │
      │    (Redis)       │ │(PostgreSQL)│ │   Cache     │
      └──────────────────┘ └────────────┘ └─────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │   RESERVATION CREATED      │
                  │    (EventBridge Event)     │
                  └─────────────┬──────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
      ┌─────────▼────────┐ ┌───▼────────┐ ┌───▼─────────┐
      │  QR Generator    │ │Cache Update│ │Notification │
      └─────────┬────────┘ └───┬────────┘ └───┬─────────┘
                │              │              │
                └──────────────┴──────────────┘
                                │
                  ┌─────────────▼──────────────┐
                  │  MULTI-CHANNEL NOTIFIER    │
                  │  (Broadcast a todos)       │
                  └─────────────┬──────────────┘
                                │
      ┌─────────────────────────┼─────────────────────────┐
      │             │            │            │            │
┌─────▼──────┐ ┌───▼────┐ ┌────▼─────┐ ┌────▼────┐ ┌────▼─────┐
│  WhatsApp  │ │Instagram│ │ WebChat  │ │  Email  │ │   SMS    │
│  Adapter   │ │ Adapter │ │  Adapter │ │ Adapter │ │ Adapter  │
└─────┬──────┘ └───┬────┘ └────┬─────┘ └────┬────┘ └────┬─────┘
      │            │            │            │            │
      ▼            ▼            ▼            ▼            ▼
   Usuario      Usuario      Usuario      Usuario      Usuario
  (WhatsApp)  (Instagram)   (WebChat)    (Email)      (SMS)
```

---

## 6. Tabla de Sincronización de Estados

```typescript
// Estado compartido entre TODOS los canales

interface GlobalReservationState {
  // Base de datos (fuente de verdad)
  postgres: {
    reservations: 'confirmed' | 'checked_in' | 'cancelled' | 'no_show',
    tables: 'available' | 'reserved' | 'occupied',
    updated_at: Date
  },
  
  // Cache (sincronización rápida)
  redis: {
    availability: Map<string, boolean>, // TTL 30s
    locks: Map<string, string>,         // TTL 30s
    conversations: Map<string, ConversationState>, // TTL 1h
    rate_limits: Map<string, number>    // TTL 1m
  },
  
  // Tiempo real (notificaciones instantáneas)
  websockets: {
    connections: Set<ConnectionId>,
    subscriptions: Map<RestaurantId, Set<ConnectionId>>
  },
  
  // Eventos (propagación asíncrona)
  eventBridge: {
    'reservation.created': Event[],
    'reservation.cancelled': Event[],
    'availability.changed': Event[]
  }
}
```

---

## 7. Garantías de Sincronización Multi-Canal

### ✅ Garantías Absolutas

1. **MISMA FUENTE DE VERDAD**
   - PostgreSQL es la única fuente autoritativa
   - Todos los canales consultan la misma base de datos
   - Locks distribuidos previenen race conditions entre canales

2. **SINCRONIZACIÓN ATÓMICA**
   - Lock en Redis antes de cualquier reserva (sin importar canal)
   - Transacción ACID en PostgreSQL para todos los cambios
   - Invalidación de cache inmediata post-commit

3. **BROADCAST UNIVERSAL**
   - Cambios propagados a TODOS los canales activos
   - WebSocket para actualizaciones instantáneas (WebChat)
   - Notificaciones push para canales asíncronos (WhatsApp, Email)

4. **IDENTIDAD UNIFICADA**
   - Usuario único puede usar múltiples canales
   - Historial compartido entre canales
   - Preferencias sincronizadas

5. **EXPERIENCIA CONSISTENTE**
   - Mismo flujo de reserva en todos los canales
   - Validaciones idénticas
   - Mensajes adaptados pero contenido equivalente

### ⚠️ Consideraciones por Canal

```yaml
WhatsApp:
  - Delay: 1-3 segundos (red Twilio/Meta)
  - Limitaciones: 3 botones máximo, sin rich media complejo
  - Garantía: At-least-once delivery

Instagram:
  - Delay: 1-2 segundos (Meta API)
  - Limitaciones: Quick replies limitados
  - Garantía: At-least-once delivery

WebChat:
  - Delay: < 100ms (WebSocket directo)
  - Limitaciones: Ninguna (control total)
  - Garantía: Exactly-once delivery

Email:
  - Delay: Variable (5s - 5min)
  - Limitaciones: No tiempo real, solo confirmaciones
  - Garantía: At-least-once delivery

SMS:
  - Delay: 1-5 segundos
  - Limitaciones: Solo texto, 160 caracteres
  - Garantía: At-least-once delivery
```

---

## 8. Testing Multi-Canal

```typescript
// tests/multi-channel/sync.test.ts

describe('Multi-Channel Synchronization', () => {
  
  /**
   * TEST CRÍTICO: Reserva simultánea desde 3 canales diferentes
   * GARANTÍA: Solo UNA reserva exitosa, otras fallan inmediatamente
   */
  it('should prevent double booking across channels', async () => {
    
    const restaurantId = 'test-restaurant';
    const date = '2025-12-25';
    const timeSlot = '20:00';
    const tableId = 'test-table';
    
    // Usuario A reserva por WhatsApp
    const whatsappReservation = createReservationViaWhatsApp({
      userId: 'user-a',
      restaurantId,
      date,
      timeSlot,
      tableId
    });
    
    // Usuario B reserva por Instagram (mismo horario/mesa)
    const instagramReservation = createReservationViaInstagram({
      userId: 'user-b',
      restaurantId,
      date,
      timeSlot,
      tableId
    });
    
    // Usuario C reserva por WebChat (mismo horario/mesa)
    const webchatReservation = createReservationViaWebChat({
      userId: 'user-c',
      restaurantId,
      date,
      timeSlot,
      tableId
    });
    
    // Ejecutar en paralelo
    const results = await Promise.allSettled([
      whatsappReservation,
      instagramReservation,
      webchatReservation
    ]);
    
    const successes = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    );
    
    // GARANTÍA: Exactamente 1 éxito
    expect(successes.length).toBe(1);
    
    // Verificar que los usuarios recibieron respuestas apropiadas
    const whatsappUser = await getLastMessage('whatsapp', 'user-a');
    const instagramUser = await getLastMessage('instagram', 'user-b');
    const webchatUser = await getLastMessage('webchat', 'user-c');
    
    // Uno debe tener confirmación, otros error de disponibilidad
    const confirmations = [whatsappUser, instagramUser, webchatUser]
      .filter(msg => msg.includes('confirmada'));
    
    expect(confirmations.length).toBe(1);
  });
  
  /**
   * TEST: Disponibilidad sincronizada en tiempo real
   */
  it('should sync availability across all channels immediately', async () => {
    
    // Abrir 3 conversaciones en diferentes canales
    const whatsapp = await openConversation(ChannelType.WHATSAPP);
    const instagram = await openConversation(ChannelType.INSTAGRAM);
    const webchat = await openWebSocketConnection();
    
    // Solicitar disponibilidad en los 3 canales
    const [wa, ig, wc] = await Promise.all([
      checkAvailability(whatsapp, restaurantId, date),
      checkAvailability(instagram, restaurantId, date),
      checkAvailability(webchat, restaurantId, date)
    ]);
    
    // GARANTÍA: Misma disponibilidad en todos
    expect(wa.availableSlots).toEqual(ig.availableSlots);
    expect(ig.availableSlots).toEqual(wc.availableSlots);
    
    // Hacer reserva en uno de los canales
    await createReservation(whatsapp, {
      date,
      timeSlot: '20:00',
      partySize: 4
    });
    
    // Esperar propagación (máximo 1 segundo)
    await sleep(1000);
    
    // Verificar disponibilidad actualizada en TODOS los canales
    const [wa2, ig2, wc2] = await Promise.all([
      checkAvailability(whatsapp, restaurantId, date),
      checkAvailability(instagram, restaurantId, date),
      checkAvailability(webchat, restaurantId, date)
    ]);
    
    // Slot 20:00 debe estar no disponible en TODOS
    expect(wa2.availableSlots).not.toContain('20:00');
    expect(ig2.availableSlots).not.toContain('20:00');
    expect(wc2.availableSlots).not.toContain('20:00');
    
    // GARANTÍA: Siguen sincronizados
    expect(wa2.availableSlots).toEqual(ig2.availableSlots);
    expect(ig2.availableSlots).toEqual(wc2.availableSlots);
  });
});
```

---

## Resumen

**Principios Clave:**
1. ✅ **Capa de abstracción unificada** para todos los canales
2. ✅ **Misma fuente de verdad** (PostgreSQL) para todos
3. ✅ **Sincronización atómica** con locks distribuidos (Redis)
4. ✅ **Broadcast universal** de cambios en tiempo real
5. ✅ **Identidad unificada** del usuario entre canales
6. ✅ **Testing exhaustivo** de sincronización multi-canal

**GARANTÍA ABSOLUTA: No importa desde dónde reserve el usuario (WhatsApp, Instagram, WebChat, Email), el sistema garantiza la misma experiencia, misma disponibilidad y CERO dobles reservas.**
