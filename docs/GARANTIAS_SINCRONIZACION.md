# SaveIt App - Garantías de Sincronización y Estrictez del Sistema

## Principio Fundamental

**CERO TOLERANCIA A DOBLE RESERVA**  
**SINCRONIZACIÓN ATÓMICA GARANTIZADA**  
**VALIDACIÓN ESTRICTA EN CADA OPERACIÓN**

---

## 1. Mecanismos de Sincronización Garantizada

### 1.1 Sistema de Locks Distribuidos (Redis)

**Implementación Obligatoria en TODAS las Reservas**

```typescript
// reservation-service/src/core/ReservationLock.ts

interface LockConfig {
  ttl: number; // 30 segundos máximo
  retries: number; // 0 - sin reintentos automáticos
  waitTime: number; // 0 - falla inmediatamente si ocupado
}

class ReservationLock {
  private redis: RedisCluster;
  private readonly LOCK_PREFIX = 'lock:reservation:';
  
  /**
   * Adquiere lock ATÓMICO para una reserva
   * GARANTÍA: Solo UNA operación puede adquirir el lock a la vez
   * FALLA RÁPIDO: Si el lock está tomado, retorna false inmediatamente
   */
  async acquire(
    restaurantId: string,
    date: string, // YYYY-MM-DD
    timeSlot: string, // HH:mm
    tableId: string
  ): Promise<{ success: boolean; lockId: string | null }> {
    
    const lockKey = this.buildLockKey(restaurantId, date, timeSlot, tableId);
    const lockId = this.generateUniqueLockId(); // UUID v4
    
    // SET NX (set if not exists) con TTL atómico
    // GARANTÍA: Operación atómica de Redis, imposible race condition
    const result = await this.redis.set(
      lockKey,
      lockId,
      'NX', // Only set if NOT exists
      'EX', // Set expiry time in seconds
      30    // TTL: 30 segundos
    );
    
    if (result === 'OK') {
      // Lock adquirido exitosamente
      return { success: true, lockId };
    }
    
    // Lock NO disponible - otra operación en proceso
    // ESTRICTO: NO esperamos, fallamos inmediatamente
    return { success: false, lockId: null };
  }
  
  /**
   * Libera lock de manera segura
   * GARANTÍA: Solo el dueño del lock puede liberarlo (verificación de lockId)
   */
  async release(lockKey: string, lockId: string): Promise<boolean> {
    // Script Lua atómico para verificar y eliminar
    // GARANTÍA: Verificación + eliminación en una sola operación atómica
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(luaScript, 1, lockKey, lockId);
    return result === 1;
  }
  
  /**
   * Extiende lock si la operación requiere más tiempo
   * GARANTÍA: Solo se extiende si el lockId coincide
   */
  async extend(lockKey: string, lockId: string, additionalSeconds: number): Promise<boolean> {
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(luaScript, 1, lockKey, lockId, additionalSeconds);
    return result === 1;
  }
  
  private buildLockKey(restaurantId: string, date: string, timeSlot: string, tableId: string): string {
    // GRANULARIDAD: Lock específico por mesa + horario
    return `${this.LOCK_PREFIX}${restaurantId}:${date}:${timeSlot}:${tableId}`;
  }
  
  private generateUniqueLockId(): string {
    // UUID v4 + timestamp para máxima unicidad
    return `${uuidv4()}-${Date.now()}`;
  }
}
```

### 1.2 Transacciones ACID en PostgreSQL

**GARANTÍA: Consistencia Total en Base de Datos**

```typescript
// reservation-service/src/core/ReservationTransaction.ts

class ReservationTransaction {
  private db: PostgresClient;
  
  /**
   * Crea reserva con GARANTÍAS ACID
   * AISLAMIENTO: SERIALIZABLE (máximo nivel)
   * ROLLBACK AUTOMÁTICO: En caso de cualquier error
   */
  async createReservation(
    reservation: ReservationRequest,
    lockId: string
  ): Promise<Result<Reservation, ReservationError>> {
    
    const client = await this.db.getClient();
    
    try {
      // INICIO DE TRANSACCIÓN CON AISLAMIENTO SERIALIZABLE
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      
      // 1. VERIFICACIÓN CRÍTICA: Mesa disponible en el horario exacto
      const availabilityCheck = await client.query(`
        SELECT 
          t.id,
          t.status,
          COUNT(r.id) as active_reservations
        FROM tables t
        LEFT JOIN reservations r ON (
          r.table_id = t.id 
          AND r.date = $1 
          AND r.time_slot = $2
          AND r.status IN ('confirmed', 'checked_in')
        )
        WHERE 
          t.id = $3 
          AND t.restaurant_id = $4
          AND t.status = 'available'
        GROUP BY t.id, t.status
        FOR UPDATE -- LOCK PESIMISTA: Bloquea la fila hasta commit
      `, [reservation.date, reservation.timeSlot, reservation.tableId, reservation.restaurantId]);
      
      if (availabilityCheck.rows.length === 0) {
        throw new TableNotAvailableError('Mesa no disponible');
      }
      
      if (availabilityCheck.rows[0].active_reservations > 0) {
        throw new DoubleBookingError('Mesa ya reservada en este horario');
      }
      
      // 2. VALIDACIÓN: Capacidad de la mesa vs tamaño del grupo
      const table = availabilityCheck.rows[0];
      if (reservation.partySize > table.capacity) {
        throw new CapacityExceededError('Grupo excede capacidad de la mesa');
      }
      
      // 3. VALIDACIÓN: Reglas del restaurante
      const rulesValid = await this.validateRestaurantRules(
        client, 
        reservation.restaurantId, 
        reservation
      );
      if (!rulesValid.success) {
        throw new RuleViolationError(rulesValid.errors);
      }
      
      // 4. VALIDACIÓN: Usuario no tiene otra reserva en horario conflictivo
      const userConflict = await client.query(`
        SELECT id 
        FROM reservations 
        WHERE 
          user_id = $1 
          AND restaurant_id = $2
          AND date = $3
          AND status IN ('confirmed', 'checked_in')
          AND (
            -- Conflicto de horario (±2 horas)
            (time_slot >= $4::time - interval '2 hours' 
             AND time_slot <= $4::time + interval '2 hours')
          )
        FOR UPDATE
      `, [reservation.userId, reservation.restaurantId, reservation.date, reservation.timeSlot]);
      
      if (userConflict.rows.length > 0) {
        throw new UserConflictError('Usuario ya tiene reserva en horario cercano');
      }
      
      // 5. INSERCIÓN: Crear reserva
      const insertResult = await client.query(`
        INSERT INTO reservations (
          id, user_id, restaurant_id, table_id, 
          date, time_slot, party_size, status, 
          lock_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, 
          $4, $5, $6, 'confirmed', 
          $7, NOW(), NOW()
        )
        RETURNING *
      `, [
        reservation.userId,
        reservation.restaurantId,
        reservation.tableId,
        reservation.date,
        reservation.timeSlot,
        reservation.partySize,
        lockId
      ]);
      
      const newReservation = insertResult.rows[0];
      
      // 6. AUDITORÍA: Registro de operación
      await client.query(`
        INSERT INTO reservation_logs (
          reservation_id, action, performed_by, 
          details, ip_address, created_at
        ) VALUES ($1, 'CREATED', $2, $3, $4, NOW())
      `, [
        newReservation.id,
        reservation.userId,
        JSON.stringify({ lockId, source: reservation.source }),
        reservation.ipAddress
      ]);
      
      // 7. COMMIT: Todas las operaciones exitosas
      await client.query('COMMIT');
      
      return { success: true, data: newReservation };
      
    } catch (error) {
      // ROLLBACK AUTOMÁTICO: Cualquier error deshace TODA la transacción
      await client.query('ROLLBACK');
      
      // Log del error para análisis
      await this.logTransactionError(error, reservation);
      
      return { 
        success: false, 
        error: this.mapErrorToUserFriendly(error) 
      };
      
    } finally {
      // SIEMPRE liberar la conexión al pool
      client.release();
    }
  }
  
  /**
   * Validación estricta de reglas del restaurante
   */
  private async validateRestaurantRules(
    client: any,
    restaurantId: string,
    reservation: ReservationRequest
  ): Promise<ValidationResult> {
    
    const rules = await this.getRestaurantRules(restaurantId);
    const errors: string[] = [];
    
    // VALIDACIÓN 1: Ventana de reserva
    const hoursDiff = this.getHoursDifference(new Date(), reservation.date);
    if (hoursDiff < rules.minHoursAdvance) {
      errors.push(`Reserva debe hacerse con al menos ${rules.minHoursAdvance} horas de anticipación`);
    }
    if (hoursDiff > rules.maxDaysAdvance * 24) {
      errors.push(`Reserva no puede hacerse con más de ${rules.maxDaysAdvance} días de anticipación`);
    }
    
    // VALIDACIÓN 2: Horario de operación
    const dayOfWeek = this.getDayOfWeek(reservation.date);
    const businessHours = rules.businessHours[dayOfWeek];
    
    if (businessHours.closed) {
      errors.push(`Restaurante cerrado los ${dayOfWeek}`);
    }
    
    if (!this.isWithinBusinessHours(reservation.timeSlot, businessHours)) {
      errors.push(`Horario debe estar entre ${businessHours.open} y ${businessHours.close}`);
    }
    
    // VALIDACIÓN 3: Fechas especiales
    const specialDate = rules.specialDates.find(sd => sd.date === reservation.date);
    if (specialDate?.type === 'closed') {
      errors.push(`Restaurante cerrado en fecha especial: ${specialDate.date}`);
    }
    
    // VALIDACIÓN 4: Tamaño del grupo
    if (reservation.partySize < 1) {
      errors.push('Tamaño del grupo debe ser al menos 1 persona');
    }
    if (reservation.partySize > rules.maxPartySize) {
      errors.push(`Tamaño máximo del grupo: ${rules.maxPartySize} personas`);
    }
    
    // VALIDACIÓN 5: Requisitos especiales
    if (rules.requiresPhoneVerification && !reservation.phoneVerified) {
      errors.push('Verificación de teléfono requerida');
    }
    
    if (rules.requiresDeposit && !reservation.depositPaid) {
      errors.push(`Depósito de $${rules.depositAmount} requerido`);
    }
    
    // VALIDACIÓN 6: Usuario bloqueado por no-shows
    const userStatus = await this.getUserReservationStatus(client, reservation.userId, restaurantId);
    if (userStatus.isBlocked) {
      errors.push('Usuario bloqueado por no-shows previos. Contactar al restaurante.');
    }
    
    return {
      success: errors.length === 0,
      errors
    };
  }
}
```

### 1.3 Flujo Completo con Todas las Garantías

```typescript
// reservation-service/src/api/ReservationController.ts

class ReservationController {
  private lockManager: ReservationLock;
  private transactionManager: ReservationTransaction;
  private cacheManager: RedisCache;
  private eventBus: EventBridge;
  
  /**
   * ENDPOINT: POST /reservations
   * GARANTÍAS:
   * 1. Lock distribuido previene race conditions
   * 2. Transacción ACID garantiza consistencia
   * 3. Validaciones estrictas en cada paso
   * 4. Rollback automático en caso de error
   * 5. Eventos publicados solo después de commit exitoso
   */
  async createReservation(req: Request, res: Response): Promise<Response> {
    
    const startTime = Date.now();
    let lockId: string | null = null;
    let lockKey: string = '';
    
    try {
      // PASO 1: Validación de entrada (fail-fast)
      const validationResult = this.validateInput(req.body);
      if (!validationResult.valid) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: validationResult.errors,
          timestamp: new Date().toISOString()
        });
      }
      
      const reservation = validationResult.data;
      
      // PASO 2: Rate Limiting estricto (prevenir abuse)
      const rateLimitCheck = await this.checkRateLimit(reservation.userId, req.ip);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitCheck.retryAfter,
          timestamp: new Date().toISOString()
        });
      }
      
      // PASO 3: LOCK DISTRIBUIDO (CRÍTICO)
      const lockResult = await this.lockManager.acquire(
        reservation.restaurantId,
        reservation.date,
        reservation.timeSlot,
        reservation.tableId
      );
      
      if (!lockResult.success) {
        // FALLA ESTRICTA: Otra operación en proceso
        return res.status(409).json({
          error: 'RESERVATION_IN_PROGRESS',
          message: 'Otra reserva está siendo procesada para este horario. Intente con otro horario.',
          timestamp: new Date().toISOString()
        });
      }
      
      lockId = lockResult.lockId!;
      lockKey = this.lockManager.buildLockKey(
        reservation.restaurantId,
        reservation.date,
        reservation.timeSlot,
        reservation.tableId
      );
      
      // PASO 4: TRANSACCIÓN ACID (CRÍTICO)
      const transactionResult = await this.transactionManager.createReservation(
        reservation,
        lockId
      );
      
      if (!transactionResult.success) {
        // ROLLBACK AUTOMÁTICO ya ejecutado
        await this.lockManager.release(lockKey, lockId);
        
        return res.status(400).json({
          error: transactionResult.error.code,
          message: transactionResult.error.message,
          details: transactionResult.error.details,
          timestamp: new Date().toISOString()
        });
      }
      
      const newReservation = transactionResult.data!;
      
      // PASO 5: Invalidar cache (sincronización)
      await this.cacheManager.invalidateAvailability(
        reservation.restaurantId,
        reservation.date
      );
      
      // PASO 6: Publicar evento (solo después de commit exitoso)
      await this.eventBus.publish({
        source: 'reservation-service',
        detailType: 'reservation.created',
        detail: {
          reservationId: newReservation.id,
          restaurantId: reservation.restaurantId,
          userId: reservation.userId,
          date: reservation.date,
          timeSlot: reservation.timeSlot,
          partySize: reservation.partySize,
          createdAt: newReservation.created_at
        }
      });
      
      // PASO 7: Liberar lock
      await this.lockManager.release(lockKey, lockId);
      
      // PASO 8: Métricas
      const duration = Date.now() - startTime;
      await this.recordMetrics('reservation.created.success', duration, reservation);
      
      // RESPUESTA EXITOSA
      return res.status(201).json({
        success: true,
        reservation: {
          id: newReservation.id,
          restaurantId: newReservation.restaurant_id,
          date: newReservation.date,
          timeSlot: newReservation.time_slot,
          partySize: newReservation.party_size,
          status: newReservation.status,
          qrCodeUrl: null, // Se genera asíncronamente
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // MANEJO DE ERRORES CRÍTICOS
      
      // Liberar lock si fue adquirido
      if (lockId && lockKey) {
        await this.lockManager.release(lockKey, lockId).catch(e => {
          // Log pero no falla (TTL lo liberará)
          console.error('Failed to release lock:', e);
        });
      }
      
      // Log de error para análisis
      await this.logCriticalError(error, req.body);
      
      // Alerta a equipo de ops
      await this.sendAlert('CRITICAL', 'Reservation creation failed', error);
      
      // Respuesta genérica (no exponer detalles internos)
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'No se pudo procesar la reserva. Intente nuevamente.',
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    }
  }
  
  /**
   * Validación de rate limiting por usuario e IP
   * PREVENCIÓN: Abuse, bots, ataques
   */
  private async checkRateLimit(userId: string, ip: string): Promise<RateLimitResult> {
    
    const limits = {
      perUser: { max: 5, windowSeconds: 60 }, // 5 reservas por minuto por usuario
      perIP: { max: 20, windowSeconds: 60 },   // 20 reservas por minuto por IP
    };
    
    const userKey = `ratelimit:user:${userId}`;
    const ipKey = `ratelimit:ip:${ip}`;
    
    // Check user limit
    const userCount = await this.cacheManager.increment(userKey, limits.perUser.windowSeconds);
    if (userCount > limits.perUser.max) {
      return { 
        allowed: false, 
        retryAfter: await this.cacheManager.getTTL(userKey) 
      };
    }
    
    // Check IP limit
    const ipCount = await this.cacheManager.increment(ipKey, limits.perIP.windowSeconds);
    if (ipCount > limits.perIP.max) {
      return { 
        allowed: false, 
        retryAfter: await this.cacheManager.getTTL(ipKey) 
      };
    }
    
    return { allowed: true };
  }
}
```

---

## 2. Validaciones Estrictas en Todos los Niveles

### 2.1 Validación de Entrada (API Gateway + Lambda)

```typescript
// Esquema de validación con Joi/Zod
const ReservationSchema = z.object({
  restaurantId: z.string().uuid('ID de restaurante inválido'),
  userId: z.string().uuid('ID de usuario inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'Formato de hora inválido (HH:mm)'),
  partySize: z.number().int().min(1).max(50, 'Tamaño de grupo inválido'),
  tableId: z.string().uuid('ID de mesa inválido'),
  specialRequests: z.string().max(500, 'Solicitudes especiales muy largas').optional(),
  phoneVerified: z.boolean(),
  depositPaid: z.boolean().optional(),
});

// ESTRICTO: Validación antes de procesar
function validateReservationRequest(input: any): ValidationResult {
  try {
    const validated = ReservationSchema.parse(input);
    
    // Validaciones adicionales de negocio
    const now = new Date();
    const reservationDate = new Date(validated.date);
    
    // No permitir fechas pasadas
    if (reservationDate < now) {
      return { 
        valid: false, 
        errors: ['No se pueden hacer reservas en fechas pasadas'] 
      };
    }
    
    // No permitir más de 1 año en el futuro
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(now.getFullYear() + 1);
    
    if (reservationDate > oneYearFromNow) {
      return { 
        valid: false, 
        errors: ['No se pueden hacer reservas con más de 1 año de anticipación'] 
      };
    }
    
    return { valid: true, data: validated };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`) 
      };
    }
    throw error;
  }
}
```

### 2.2 Validación de Disponibilidad en Tiempo Real

```typescript
// availability-service/src/core/AvailabilityChecker.ts

class AvailabilityChecker {
  
  /**
   * Verifica disponibilidad con MÚLTIPLES fuentes
   * GARANTÍA: Consulta fuente de verdad (PostgreSQL) + cache para performance
   */
  async checkAvailability(
    restaurantId: string,
    date: string,
    timeSlot: string
  ): Promise<AvailabilityResult> {
    
    // 1. Intentar desde cache (performance)
    const cachedResult = await this.getCachedAvailability(restaurantId, date, timeSlot);
    
    if (cachedResult && this.isCacheFresh(cachedResult)) {
      // Cache válido pero SIEMPRE verificar en DB antes de confirmar
      // Cache es solo para reducir latencia, NO fuente de verdad
    }
    
    // 2. FUENTE DE VERDAD: PostgreSQL
    const dbAvailability = await this.db.query(`
      WITH time_slots AS (
        SELECT 
          t.id as table_id,
          t.number as table_number,
          t.capacity,
          t.status as table_status,
          COUNT(r.id) as active_reservations
        FROM tables t
        LEFT JOIN reservations r ON (
          r.table_id = t.id
          AND r.date = $2
          AND r.time_slot = $3
          AND r.status IN ('confirmed', 'checked_in', 'pending')
        )
        WHERE 
          t.restaurant_id = $1
          AND t.status = 'available'
        GROUP BY t.id, t.number, t.capacity, t.status
      )
      SELECT 
        table_id,
        table_number,
        capacity,
        table_status,
        active_reservations,
        CASE 
          WHEN active_reservations = 0 THEN true
          ELSE false
        END as is_available
      FROM time_slots
      ORDER BY capacity, table_number
    `, [restaurantId, date, timeSlot]);
    
    const availableTables = dbAvailability.rows.filter(t => t.is_available);
    
    // 3. Actualizar cache con resultado fresco
    await this.setCachedAvailability(restaurantId, date, timeSlot, {
      available: availableTables.length > 0,
      tables: availableTables,
      checkedAt: new Date().toISOString()
    });
    
    return {
      available: availableTables.length > 0,
      tables: availableTables,
      nextAvailableSlot: await this.findNextAvailableSlot(restaurantId, date, timeSlot)
    };
  }
  
  /**
   * ESTRICTO: Cache tiene TTL corto (30 segundos)
   * INVALIDACIÓN: Cualquier reserva/cancelación invalida cache
   */
  private async getCachedAvailability(
    restaurantId: string,
    date: string,
    timeSlot: string
  ): Promise<CachedAvailability | null> {
    
    const cacheKey = `availability:${restaurantId}:${date}:${timeSlot}`;
    const cached = await this.redis.get(cacheKey);
    
    if (!cached) return null;
    
    try {
      return JSON.parse(cached);
    } catch {
      // Cache corrupto, eliminar
      await this.redis.del(cacheKey);
      return null;
    }
  }
  
  private isCacheFresh(cached: CachedAvailability): boolean {
    const checkedAt = new Date(cached.checkedAt);
    const now = new Date();
    const ageSeconds = (now.getTime() - checkedAt.getTime()) / 1000;
    
    // ESTRICTO: Cache válido por máximo 30 segundos
    return ageSeconds < 30;
  }
}
```

---

## 3. Manejo de Errores y Recuperación

### 3.1 Estrategia de Rollback y Compensación

```typescript
// orchestration/src/SagaOrchestrator.ts

/**
 * SAGA PATTERN para operaciones distribuidas
 * GARANTÍA: Consistencia eventual con compensación automática
 */
class ReservationSaga {
  
  async execute(reservation: ReservationRequest): Promise<SagaResult> {
    
    const steps: SagaStep[] = [];
    
    try {
      // STEP 1: Acquire lock
      const lockResult = await this.acquireLock(reservation);
      steps.push({ 
        name: 'acquire_lock', 
        data: lockResult,
        compensate: () => this.releaseLock(lockResult.lockId)
      });
      
      // STEP 2: Validate rules
      const validationResult = await this.validateRules(reservation);
      if (!validationResult.valid) {
        throw new ValidationError(validationResult.errors);
      }
      steps.push({ name: 'validate_rules', data: validationResult });
      
      // STEP 3: Create reservation in DB
      const dbResult = await this.createInDatabase(reservation);
      steps.push({ 
        name: 'create_db', 
        data: dbResult,
        compensate: () => this.deleteFromDatabase(dbResult.id)
      });
      
      // STEP 4: Generate QR
      const qrResult = await this.generateQR(dbResult.id);
      steps.push({ 
        name: 'generate_qr', 
        data: qrResult,
        compensate: () => this.deleteQR(qrResult.qrId)
      });
      
      // STEP 5: Send notification
      const notificationResult = await this.sendNotification(dbResult.id);
      steps.push({ name: 'send_notification', data: notificationResult });
      
      return { success: true, data: dbResult };
      
    } catch (error) {
      // COMPENSACIÓN: Deshacer pasos completados en orden inverso
      console.error('Saga failed, executing compensations:', error);
      
      for (let i = steps.length - 1; i >= 0; i--) {
        const step = steps[i];
        if (step.compensate) {
          try {
            await step.compensate();
            console.log(`Compensated step: ${step.name}`);
          } catch (compensationError) {
            // Log crítico: compensación falló
            console.error(`CRITICAL: Compensation failed for ${step.name}:`, compensationError);
            await this.alertOps('COMPENSATION_FAILED', { step: step.name, error: compensationError });
          }
        }
      }
      
      return { success: false, error };
    }
  }
}
```

### 3.2 Circuit Breaker para Servicios Externos

```typescript
// resilience/src/CircuitBreaker.ts

/**
 * Circuit Breaker para prevenir cascadas de fallos
 * PROTECCIÓN: Sistema se auto-protege de servicios degradados
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  
  private readonly config = {
    failureThreshold: 5,      // 5 fallos consecutivos
    resetTimeout: 60000,      // 60 segundos
    halfOpenSuccessThreshold: 2  // 2 éxitos para cerrar
  };
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    
    if (this.state === 'OPEN') {
      // Verificar si es tiempo de intentar de nuevo
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError('Service temporarily unavailable');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.config.halfOpenSuccessThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
      }
    }
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.successCount = 0;
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      // Alertar a ops
      this.alertOps('CIRCUIT_BREAKER_OPEN');
    }
  }
  
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.config.resetTimeout;
  }
}
```

---

## 4. Monitoreo y Alertas en Tiempo Real

### 4.1 Métricas Críticas

```typescript
// monitoring/src/MetricsCollector.ts

class ReservationMetrics {
  
  /**
   * Métricas CRÍTICAS que se monitorean constantemente
   */
  async recordReservationAttempt(result: 'success' | 'failure', metadata: any): Promise<void> {
    
    const metrics = {
      // Métricas de sincronización
      'reservation.lock.acquired': result === 'success' ? 1 : 0,
      'reservation.lock.failed': result === 'failure' ? 1 : 0,
      'reservation.lock.duration_ms': metadata.lockDuration,
      
      // Métricas de transacción
      'reservation.db.transaction.duration_ms': metadata.dbDuration,
      'reservation.db.transaction.success': result === 'success' ? 1 : 0,
      'reservation.db.transaction.rollback': result === 'failure' ? 1 : 0,
      
      // Métricas de validación
      'reservation.validation.failed': metadata.validationFailed ? 1 : 0,
      'reservation.rules.violated': metadata.rulesViolated || 0,
      
      // Métricas de negocio
      'reservation.created': result === 'success' ? 1 : 0,
      'reservation.double_booking_prevented': metadata.doubleBookingPrevented ? 1 : 0,
      
      // Dimensiones
      restaurant_id: metadata.restaurantId,
      date: metadata.date,
      time_slot: metadata.timeSlot,
      source: metadata.source, // whatsapp, instagram, webchat, email
    };
    
    // Enviar a CloudWatch
    await this.cloudwatch.putMetricData({
      Namespace: 'SaveIt/Reservations',
      MetricData: Object.entries(metrics).map(([name, value]) => ({
        MetricName: name,
        Value: typeof value === 'number' ? value : 0,
        Unit: name.includes('duration') ? 'Milliseconds' : 'Count',
        Timestamp: new Date(),
        Dimensions: [
          { Name: 'Restaurant', Value: metadata.restaurantId },
          { Name: 'Source', Value: metadata.source },
        ]
      }))
    });
  }
  
  /**
   * Detectar anomalías en tiempo real
   */
  async detectAnomalies(): Promise<void> {
    
    // Anomalía 1: Tasa de fallos de lock alta
    const lockFailureRate = await this.calculateRate('reservation.lock.failed', 300); // 5 min
    if (lockFailureRate > 0.1) { // >10% de fallos
      await this.alert('HIGH_LOCK_FAILURE_RATE', {
        rate: lockFailureRate,
        threshold: 0.1,
        action: 'Revisar contención de locks y carga del sistema'
      });
    }
    
    // Anomalía 2: Rollbacks frecuentes
    const rollbackRate = await this.calculateRate('reservation.db.transaction.rollback', 300);
    if (rollbackRate > 0.05) { // >5% de rollbacks
      await this.alert('HIGH_ROLLBACK_RATE', {
        rate: rollbackRate,
        threshold: 0.05,
        action: 'Posibles conflictos de concurrencia o errores de validación'
      });
    }
    
    // Anomalía 3: Latencia alta
    const p99Latency = await this.calculateP99('reservation.db.transaction.duration_ms', 300);
    if (p99Latency > 2000) { // >2 segundos
      await this.alert('HIGH_LATENCY', {
        p99: p99Latency,
        threshold: 2000,
        action: 'Revisar performance de DB y queries'
      });
    }
  }
}
```

### 4.2 Alertas Automáticas

```yaml
# CloudWatch Alarms configuradas

alarms:
  # CRÍTICO: Doble reserva detectada (NO DEBE PASAR)
  - name: DoubleBookingDetected
    metric: reservation.double_booking_prevented
    threshold: 1
    period: 60 # 1 minuto
    evaluation_periods: 1
    action: 
      - PagerDuty: critical
      - SMS: on-call team
      - Slack: #incidents
    
  # CRÍTICO: Locks no liberados
  - name: StaleLocks
    metric: reservation.lock.stale
    threshold: 5
    period: 300 # 5 minutos
    action:
      - PagerDuty: high
      - Slack: #engineering
  
  # ALTO: Tasa de fallos de sincronización
  - name: SyncFailureRate
    metric: reservation.lock.failed
    threshold: 10 # >10% de intentos
    period: 300
    action:
      - Slack: #engineering
      - Email: eng-team
  
  # MEDIO: Latencia alta
  - name: HighLatencyP99
    metric: reservation.db.transaction.duration_ms
    statistic: p99
    threshold: 2000 # 2 segundos
    period: 300
    action:
      - Slack: #performance
```

---

## 5. Testing de Sincronización

### 5.1 Tests de Concurrencia

```typescript
// tests/concurrency/reservation.test.ts

describe('Reservation Concurrency Tests', () => {
  
  /**
   * TEST CRÍTICO: Prevención de doble reserva
   * GARANTÍA: Solo una de las solicitudes simultáneas debe tener éxito
   */
  it('should prevent double booking with 100 simultaneous requests', async () => {
    
    const restaurantId = 'test-restaurant-1';
    const date = '2025-12-25';
    const timeSlot = '20:00';
    const tableId = 'test-table-1';
    
    // 100 usuarios intentan reservar la misma mesa al mismo tiempo
    const promises = Array.from({ length: 100 }, (_, i) => 
      createReservation({
        restaurantId,
        date,
        timeSlot,
        tableId,
        userId: `user-${i}`,
        partySize: 2
      })
    );
    
    const results = await Promise.allSettled(promises);
    
    // Contar éxitos
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.success);
    const failures = results.filter(r => 
      r.status === 'fulfilled' && !r.value.success ||
      r.status === 'rejected'
    );
    
    // GARANTÍA: Exactamente 1 éxito
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(99);
    
    // Verificar que los fallos son por conflicto, no errores
    const conflictErrors = failures.filter(f => 
      f.status === 'fulfilled' && 
      f.value.error?.code === 'RESERVATION_IN_PROGRESS'
    );
    
    expect(conflictErrors.length).toBeGreaterThan(90); // >90% detectados correctamente
  });
  
  /**
   * TEST: Verificar que locks se liberan correctamente
   */
  it('should release locks after transaction completes', async () => {
    
    const reservation1 = await createReservation({ /* ... */ });
    expect(reservation1.success).toBe(true);
    
    // Verificar que lock fue liberado
    const lockExists = await redis.exists(`lock:reservation:${restaurantId}:${date}:${timeSlot}:${tableId}`);
    expect(lockExists).toBe(0);
    
    // Segunda reserva para mismo horario debe fallar por disponibilidad, no por lock
    const reservation2 = await createReservation({ /* ... */ });
    expect(reservation2.success).toBe(false);
    expect(reservation2.error?.code).toBe('TABLE_NOT_AVAILABLE'); // No 'RESERVATION_IN_PROGRESS'
  });
  
  /**
   * TEST: Recuperación ante timeout de lock
   */
  it('should handle lock timeout gracefully', async () => {
    
    // Simular proceso lento que excede TTL del lock
    jest.setTimeout(35000); // 35 segundos
    
    const mockSlowDB = jest.spyOn(db, 'query').mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 35000))
    );
    
    const result = await createReservation({ /* ... */ });
    
    // Lock debe haber expirado
    const lockExists = await redis.exists(`lock:reservation:...`);
    expect(lockExists).toBe(0);
    
    // Transacción debe haber hecho rollback
    const reservationInDB = await db.query('SELECT * FROM reservations WHERE id = ?', [result.id]);
    expect(reservationInDB.rows.length).toBe(0);
    
    mockSlowDB.mockRestore();
  });
});
```

### 5.2 Chaos Engineering

```typescript
// tests/chaos/reservation-chaos.ts

/**
 * Chaos Engineering para validar resiliencia
 */
class ReservationChaosTest {
  
  /**
   * TEST: Sistema funciona bajo fallo parcial de Redis
   */
  async testRedisFailure(): Promise<void> {
    
    // Simular fallo de Redis
    await this.chaos.failService('redis', {
      duration: 10000, // 10 segundos
      failureType: 'connection_timeout'
    });
    
    // Intentar crear reserva
    const result = await createReservation({ /* ... */ });
    
    // Sistema debe fallar gracefully
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('LOCK_UNAVAILABLE');
    
    // NO debe haber reserva en DB (fail-safe)
    const reservationExists = await this.checkReservationExists(result.id);
    expect(reservationExists).toBe(false);
  }
  
  /**
   * TEST: Sistema se recupera de fallo de DB
   */
  async testDatabaseFailover(): Promise<void> {
    
    // Simular failover de RDS Multi-AZ
    await this.chaos.triggerDBFailover();
    
    // Durante failover (1-2 minutos), requests deben fallar gracefully
    const resultsODuringFailover = await Promise.all(
      Array.from({ length: 10 }, () => createReservation({ /* ... */ }))
    );
    
    // Todas deben fallar con error de DB
    expect(resultsDuringFailover.every(r => !r.success)).toBe(true);
    
    // Después de failover, debe funcionar normalmente
    await this.chaos.waitForDBRecovery();
    
    const resultAfterRecovery = await createReservation({ /* ... */ });
    expect(resultAfterRecovery.success).toBe(true);
  }
}
```

---

## 6. Documentación de Garantías para Usuarios

### 6.1 SLA (Service Level Agreement)

```markdown
# SaveIt - Garantías de Servicio

## Disponibilidad
- **Uptime garantizado**: 99.9% mensual
- **Downtime máximo permitido**: 43.2 minutos/mes
- **Ventana de mantenimiento**: Martes 2AM-4AM (horario local del restaurante)

## Performance
- **Latencia de reserva (P95)**: < 500ms
- **Latencia de reserva (P99)**: < 1000ms
- **Tiempo de confirmación**: < 2 segundos

## Sincronización
- **Garantía de no doble reserva**: 100%
- **Consistencia de disponibilidad**: Tiempo real (< 1 segundo)
- **Integridad de datos**: ACID completo

## Notificaciones
- **Confirmación de reserva**: < 5 segundos
- **Recordatorio previo**: 24 horas antes
- **Actualización de estado**: Tiempo real

## Compensación por Incumplimiento
- < 99.9% uptime: 10% crédito del mes
- < 99.0% uptime: 25% crédito del mes
- < 95.0% uptime: 100% crédito del mes
- Doble reserva: Compensación completa + $100 USD
```

---

## 7. Resumen de Garantías

### ✅ Garantías Técnicas Absolutas

1. **CERO DOBLE RESERVA**
   - Lock distribuido atómico (Redis SETNX)
   - Transacciones ACID con aislamiento SERIALIZABLE
   - Validación múltiple antes de commit

2. **SINCRONIZACIÓN EN TIEMPO REAL**
   - Invalidación de cache inmediata post-reserva
   - Eventos publicados solo después de commit exitoso
   - WebSocket broadcast a todas las conexiones activas

3. **VALIDACIÓN ESTRICTA**
   - Validación de entrada con schemas tipados
   - Validación de reglas de negocio pre-transacción
   - Validación de disponibilidad desde fuente de verdad (DB)

4. **RECUPERACIÓN AUTOMÁTICA**
   - Rollback automático ante cualquier error
   - Compensación de transacciones distribuidas (Saga)
   - Circuit breakers para servicios externos

5. **OBSERVABILIDAD TOTAL**
   - Métricas en tiempo real de todos los componentes
   - Alertas automáticas para anomalías
   - Tracing distribuido de cada request

6. **TESTING EXHAUSTIVO**
   - Tests de concurrencia con 100+ threads
   - Chaos engineering para validar resiliencia
   - Load testing con 10K+ req/s

### ⚠️ Puntos Críticos de Atención

- **Locks Redis**: TTL de 30 segundos, monitoreo de locks stale
- **DB Connections**: Pool de 1000 conexiones máximo con RDS Proxy
- **Rate Limiting**: 5 intentos/minuto por usuario, 20/minuto por IP
- **Cache TTL**: 30 segundos máximo para disponibilidad
- **Transaction Timeout**: 10 segundos máximo para commit

---

**Este documento define los estándares MÍNIMOS aceptables. Cualquier desviación es considerada un bug crítico.**
