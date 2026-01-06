# SaveIt App - Estrategia de Testing

## Visión General

Estrategia de testing completa para garantizar:
- **CERO dobles reservas** bajo cualquier circunstancia
- **Sincronización perfecta** entre todos los canales
- **Alta disponibilidad** (99.9% uptime)
- **Performance** óptimo bajo carga
- **Seguridad** en todas las capas

---

## Pirámide de Testing

```
                    ┌─────────────────┐
                    │   E2E Tests     │ 5%
                    │  (Multi-Canal)  │
               ┌────┴─────────────────┴────┐
               │  Integration Tests        │ 15%
               │  (API + DB + Cache)       │
          ┌────┴───────────────────────────┴────┐
          │    Component Tests                  │ 30%
          │  (Services, Handlers, Adapters)     │
     ┌────┴─────────────────────────────────────┴────┐
     │           Unit Tests                          │ 50%
     │  (Functions, Utils, Validations)              │
     └───────────────────────────────────────────────┘
```

---

## 1. Unit Tests (50%)

### 1.1 Lock Manager

```typescript
// tests/unit/lock-manager.test.ts

describe('ReservationLock', () => {
  let lockManager: ReservationLock;
  let redis: RedisClientMock;
  
  beforeEach(() => {
    redis = new RedisClientMock();
    lockManager = new ReservationLock(redis);
  });
  
  describe('acquire', () => {
    it('should acquire lock successfully when available', async () => {
      const result = await lockManager.acquire(
        'restaurant-1',
        '2025-12-25',
        '20:00',
        'table-1'
      );
      
      expect(result.success).toBe(true);
      expect(result.lockId).toBeDefined();
      expect(redis.set).toHaveBeenCalledWith(
        'lock:reservation:restaurant-1:2025-12-25:20:00:table-1',
        expect.any(String),
        'NX',
        'EX',
        30
      );
    });
    
    it('should fail to acquire when lock already exists', async () => {
      redis.set.mockResolvedValueOnce(null); // Lock already exists
      
      const result = await lockManager.acquire(
        'restaurant-1',
        '2025-12-25',
        '20:00',
        'table-1'
      );
      
      expect(result.success).toBe(false);
      expect(result.lockId).toBeNull();
    });
    
    it('should generate unique lock IDs', async () => {
      const lock1 = await lockManager.acquire('r1', '2025-12-25', '20:00', 't1');
      const lock2 = await lockManager.acquire('r1', '2025-12-25', '20:30', 't1');
      
      expect(lock1.lockId).not.toEqual(lock2.lockId);
    });
  });
  
  describe('release', () => {
    it('should release lock with correct lockId', async () => {
      redis.eval.mockResolvedValueOnce(1);
      
      const released = await lockManager.release('lock-key', 'lock-id-123');
      
      expect(released).toBe(true);
      expect(redis.eval).toHaveBeenCalled();
    });
    
    it('should fail to release with wrong lockId', async () => {
      redis.eval.mockResolvedValueOnce(0);
      
      const released = await lockManager.release('lock-key', 'wrong-id');
      
      expect(released).toBe(false);
    });
  });
});
```

### 1.2 Validation Logic

```typescript
// tests/unit/reservation-validator.test.ts

describe('ReservationValidator', () => {
  let validator: ReservationValidator;
  
  beforeEach(() => {
    validator = new ReservationValidator();
  });
  
  describe('validateReservationWindow', () => {
    it('should reject reservations too far in advance', () => {
      const date = new Date();
      date.setDate(date.getDate() + 100); // 100 days
      
      const rules = { maxDaysAdvance: 30 };
      const result = validator.validateReservationWindow(date, rules);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Reserva no puede hacerse con más de 30 días de anticipación');
    });
    
    it('should reject reservations too soon', () => {
      const date = new Date();
      date.setHours(date.getHours() + 1); // 1 hour
      
      const rules = { minHoursAdvance: 2 };
      const result = validator.validateReservationWindow(date, rules);
      
      expect(result.valid).toBe(false);
    });
    
    it('should accept valid reservation window', () => {
      const date = new Date();
      date.setDate(date.getDate() + 7); // 1 week
      
      const rules = { minHoursAdvance: 2, maxDaysAdvance: 30 };
      const result = validator.validateReservationWindow(date, rules);
      
      expect(result.valid).toBe(true);
    });
  });
  
  describe('validateBusinessHours', () => {
    const businessHours = {
      monday: { open: '11:00', close: '23:00', closed: false },
      sunday: { open: '11:00', close: '23:00', closed: true }
    };
    
    it('should reject reservations when restaurant is closed', () => {
      const sunday = new Date('2025-12-28'); // Sunday
      const result = validator.validateBusinessHours(sunday, '20:00', businessHours);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Restaurante cerrado los sunday');
    });
    
    it('should reject reservations outside business hours', () => {
      const monday = new Date('2025-12-22'); // Monday
      const result = validator.validateBusinessHours(monday, '10:00', businessHours);
      
      expect(result.valid).toBe(false);
    });
  });
});
```

### 1.3 Channel Adapters

```typescript
// tests/unit/adapters/whatsapp-adapter.test.ts

describe('WhatsAppAdapter', () => {
  let adapter: WhatsAppAdapter;
  
  beforeEach(() => {
    adapter = new WhatsAppAdapter();
  });
  
  describe('normalizeInbound', () => {
    it('should normalize Twilio WhatsApp message', async () => {
      const rawMessage = {
        MessageSid: 'SM123456',
        From: 'whatsapp:+5215512345678',
        Body: 'Quiero reservar',
        ProfileName: 'John Doe'
      };
      
      const normalized = await adapter.normalizeInbound(rawMessage);
      
      expect(normalized).toMatchObject({
        channel: ChannelType.WHATSAPP,
        channelMessageId: 'SM123456',
        userIdentifier: 'whatsapp:+5215512345678',
        content: { text: 'Quiero reservar' },
        direction: 'inbound'
      });
    });
  });
  
  describe('normalizeOutbound', () => {
    it('should format message for Twilio API', async () => {
      const response: UnifiedResponse = {
        conversationId: 'conv-123',
        channel: ChannelType.WHATSAPP,
        recipient: 'whatsapp:+5215512345678',
        content: {
          text: 'Reserva confirmada',
          attachments: [{ type: 'image', url: 'https://...' }]
        }
      };
      
      const formatted = await adapter.normalizeOutbound(response);
      
      expect(formatted).toMatchObject({
        to: 'whatsapp:+5215512345678',
        body: 'Reserva confirmada',
        mediaUrl: ['https://...']
      });
    });
  });
});
```

---

## 2. Component Tests (30%)

### 2.1 Reservation Service

```typescript
// tests/component/reservation-service.test.ts

describe('ReservationService', () => {
  let service: ReservationService;
  let db: MockDatabase;
  let redis: MockRedis;
  let eventBus: MockEventBridge;
  
  beforeEach(() => {
    db = new MockDatabase();
    redis = new MockRedis();
    eventBus = new MockEventBridge();
    service = new ReservationService(db, redis, eventBus);
  });
  
  describe('createReservation', () => {
    it('should create reservation with all validations', async () => {
      const request = {
        userId: 'user-123',
        restaurantId: 'restaurant-1',
        date: '2025-12-25',
        timeSlot: '20:00',
        partySize: 4,
        tableId: 'table-1',
        phoneVerified: true
      };
      
      // Mock availability check
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'table-1', active_reservations: 0, capacity: 6 }]
      });
      
      // Mock restaurant rules
      redis.get.mockResolvedValueOnce(JSON.stringify({
        minHoursAdvance: 2,
        maxDaysAdvance: 30,
        maxPartySize: 12
      }));
      
      // Mock user conflict check
      db.query.mockResolvedValueOnce({ rows: [] });
      
      // Mock reservation insert
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'reservation-123',
          ...request,
          status: 'confirmed',
          created_at: new Date()
        }]
      });
      
      const result = await service.createReservation(request);
      
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('reservation-123');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          detailType: 'reservation.created'
        })
      );
    });
    
    it('should fail when table not available', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // No available tables
      
      const result = await service.createReservation({/* ... */});
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('TABLE_NOT_AVAILABLE');
    });
    
    it('should fail when party size exceeds capacity', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'table-1', active_reservations: 0, capacity: 2 }]
      });
      
      const result = await service.createReservation({
        partySize: 4,
        tableId: 'table-1',
        /* ... */
      });
      
      expect(result.success).toBe(false);
      expect(result.error.code).toBe('CAPACITY_EXCEEDED');
    });
  });
});
```

### 2.2 Channel Gateway

```typescript
// tests/component/channel-gateway.test.ts

describe('ChannelGateway', () => {
  let gateway: ChannelGateway;
  let adapters: Map<ChannelType, MockAdapter>;
  
  beforeEach(() => {
    adapters = new Map([
      [ChannelType.WHATSAPP, new MockAdapter()],
      [ChannelType.INSTAGRAM, new MockAdapter()]
    ]);
    gateway = new ChannelGateway(adapters);
  });
  
  describe('receiveMessage', () => {
    it('should normalize and save message from any channel', async () => {
      const rawMessage = {
        MessageSid: 'SM123',
        From: 'whatsapp:+5215512345678',
        Body: 'Hola'
      };
      
      const result = await gateway.receiveMessage(ChannelType.WHATSAPP, rawMessage);
      
      expect(result.channel).toBe(ChannelType.WHATSAPP);
      expect(result.messageId).toBeDefined();
      expect(result.userId).toBeDefined();
      expect(result.conversationId).toBeDefined();
    });
    
    it('should identify existing user by channel identifier', async () => {
      // Setup existing user
      db.mockUser({
        id: 'user-123',
        channels: [
          { channel: 'whatsapp', identifier: 'whatsapp:+5215512345678' }
        ]
      });
      
      const result = await gateway.receiveMessage(ChannelType.WHATSAPP, {
        From: 'whatsapp:+5215512345678',
        Body: 'Hola'
      });
      
      expect(result.userId).toBe('user-123');
    });
    
    it('should create new user if not exists', async () => {
      db.mockNoUser();
      
      const result = await gateway.receiveMessage(ChannelType.WHATSAPP, {
        From: 'whatsapp:+5215559999999',
        Body: 'Hola'
      });
      
      expect(result.userId).toBeDefined();
      expect(db.insert).toHaveBeenCalledWith('users', expect.any(Object));
    });
  });
});
```

---

## 3. Integration Tests (15%)

### 3.1 Full Reservation Flow

```typescript
// tests/integration/reservation-flow.test.ts

describe('Reservation Flow Integration', () => {
  let testEnv: TestEnvironment;
  
  beforeAll(async () => {
    testEnv = await TestEnvironment.create({
      services: ['api-gateway', 'reservation-service', 'postgres', 'redis'],
      seed: true
    });
  });
  
  afterAll(async () => {
    await testEnv.teardown();
  });
  
  it('should complete full reservation flow', async () => {
    // 1. Check availability
    const availability = await testEnv.api.get('/availability', {
      restaurantId: testEnv.restaurants[0].id,
      date: '2025-12-25',
      partySize: 4
    });
    
    expect(availability.data.available).toBe(true);
    expect(availability.data.slots.length).toBeGreaterThan(0);
    
    // 2. Create reservation
    const reservation = await testEnv.api.post('/reservations', {
      userId: testEnv.users[0].id,
      restaurantId: testEnv.restaurants[0].id,
      date: '2025-12-25',
      timeSlot: '20:00',
      partySize: 4,
      tableId: availability.data.slots[0].tableId
    });
    
    expect(reservation.status).toBe(201);
    expect(reservation.data.status).toBe('confirmed');
    expect(reservation.data.id).toBeDefined();
    
    // 3. Verify cache updated
    const cacheKey = `availability:${testEnv.restaurants[0].id}:2025-12-25`;
    const cached = await testEnv.redis.get(cacheKey);
    expect(cached).toBeNull(); // Should be invalidated
    
    // 4. Verify database state
    const dbReservation = await testEnv.db.query(
      'SELECT * FROM reservations WHERE id = $1',
      [reservation.data.id]
    );
    expect(dbReservation.rows[0].status).toBe('confirmed');
    
    // 5. Verify event published
    const events = await testEnv.eventBridge.getEvents('reservation.created');
    expect(events.length).toBe(1);
    expect(events[0].detail.reservationId).toBe(reservation.data.id);
  });
  
  it('should prevent double booking with concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, () =>
      testEnv.api.post('/reservations', {
        userId: `user-${Math.random()}`,
        restaurantId: testEnv.restaurants[0].id,
        date: '2025-12-25',
        timeSlot: '21:00',
        partySize: 2,
        tableId: testEnv.tables[0].id
      })
    );
    
    const results = await Promise.allSettled(requests);
    const successes = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);
    
    // Only one should succeed
    expect(successes.length).toBe(1);
  });
});
```

### 3.2 Database Transaction Tests

```typescript
// tests/integration/database-transactions.test.ts

describe('Database Transactions', () => {
  let db: PostgresTestClient;
  
  beforeEach(async () => {
    db = await PostgresTestClient.connect();
    await db.beginTransaction();
  });
  
  afterEach(async () => {
    await db.rollback();
    await db.disconnect();
  });
  
  it('should rollback on constraint violation', async () => {
    // Create first reservation
    await db.query(`
      INSERT INTO reservations (id, user_id, restaurant_id, table_id, date, time_slot, party_size, status)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'confirmed')
    `, ['user-1', 'restaurant-1', 'table-1', '2025-12-25', '20:00', 4]);
    
    // Attempt second reservation (should fail due to unique constraint)
    await expect(
      db.query(`
        INSERT INTO reservations (id, user_id, restaurant_id, table_id, date, time_slot, party_size, status)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'confirmed')
      `, ['user-2', 'restaurant-1', 'table-1', '2025-12-25', '20:00', 2])
    ).rejects.toThrow(/unique constraint/);
  });
  
  it('should handle SERIALIZABLE isolation correctly', async () => {
    // Start two concurrent transactions
    const tx1 = await db.beginTransaction('SERIALIZABLE');
    const tx2 = await db.beginTransaction('SERIALIZABLE');
    
    // Both read same table
    const table1 = await tx1.query('SELECT * FROM tables WHERE id = $1 FOR UPDATE', ['table-1']);
    
    // tx2 tries to read same table (should wait)
    const readPromise = tx2.query('SELECT * FROM tables WHERE id = $1 FOR UPDATE', ['table-1']);
    
    // tx1 updates and commits
    await tx1.query('UPDATE tables SET status = $1 WHERE id = $2', ['reserved', 'table-1']);
    await tx1.commit();
    
    // Now tx2 can proceed
    const table2 = await readPromise;
    expect(table2.rows[0].status).toBe('reserved');
    
    await tx2.rollback();
  });
});
```

---

## 4. E2E Tests Multi-Canal (5%)

### 4.1 Cross-Channel Synchronization

```typescript
// tests/e2e/multi-channel-sync.test.ts

describe('Multi-Channel E2E Tests', () => {
  let testEnv: E2ETestEnvironment;
  
  beforeAll(async () => {
    testEnv = await E2ETestEnvironment.create({
      deployedServices: true,
      channels: ['whatsapp', 'instagram', 'webchat']
    });
  });
  
  afterAll(async () => {
    await testEnv.teardown();
  });
  
  describe('Concurrent reservations from different channels', () => {
    it('should prevent double booking across channels', async () => {
      const restaurant = await testEnv.createRestaurant();
      const table = await testEnv.createTable(restaurant.id, { capacity: 4 });
      
      // User A via WhatsApp
      const whatsappPromise = testEnv.whatsapp.sendMessage({
        from: '+5215551234567',
        body: `Reservar mesa para 4 el 2025-12-25 a las 20:00 en ${restaurant.name}`
      });
      
      // User B via Instagram
      const instagramPromise = testEnv.instagram.sendMessage({
        sender: { id: 'ig-user-123' },
        message: { text: `Quiero reservar para 4 personas el 25 de diciembre a las 20:00` }
      });
      
      // User C via WebChat
      const webchatPromise = testEnv.webchat.sendMessage({
        sessionId: 'session-789',
        text: 'Reservar 4 personas, diciembre 25, 8pm'
      });
      
      // Wait for all to process
      const [whatsapp, instagram, webchat] = await Promise.allSettled([
        whatsappPromise,
        instagramPromise,
        webchatPromise
      ]);
      
      // Check responses
      const confirmations = [whatsapp, instagram, webchat].filter(r =>
        r.status === 'fulfilled' && r.value.includes('confirmada')
      );
      
      // Only ONE should get confirmation
      expect(confirmations.length).toBe(1);
      
      // Others should get "not available" message
      const rejections = [whatsapp, instagram, webchat].filter(r =>
        r.status === 'fulfilled' && r.value.includes('disponible')
      );
      
      expect(rejections.length).toBe(2);
    });
  });
  
  describe('Availability sync across channels', () => {
    it('should show same availability in all channels', async () => {
      const restaurant = await testEnv.createRestaurant();
      await testEnv.createTable(restaurant.id, { capacity: 4, number: '1' });
      await testEnv.createTable(restaurant.id, { capacity: 6, number: '2' });
      
      // Check availability from all channels simultaneously
      const [wa, ig, wc] = await Promise.all([
        testEnv.whatsapp.requestAvailability(restaurant.id, '2025-12-25'),
        testEnv.instagram.requestAvailability(restaurant.id, '2025-12-25'),
        testEnv.webchat.requestAvailability(restaurant.id, '2025-12-25')
      ]);
      
      // All should see same availability
      expect(wa.availableSlots).toEqual(ig.availableSlots);
      expect(ig.availableSlots).toEqual(wc.availableSlots);
      
      // Make reservation via WhatsApp
      await testEnv.whatsapp.createReservation({
        restaurantId: restaurant.id,
        date: '2025-12-25',
        timeSlot: '20:00',
        partySize: 4
      });
      
      // Wait for propagation (should be < 1 second)
      await testEnv.wait(1000);
      
      // Check availability again from all channels
      const [wa2, ig2, wc2] = await Promise.all([
        testEnv.whatsapp.requestAvailability(restaurant.id, '2025-12-25'),
        testEnv.instagram.requestAvailability(restaurant.id, '2025-12-25'),
        testEnv.webchat.requestAvailability(restaurant.id, '2025-12-25')
      ]);
      
      // All should NOT show 20:00 anymore
      expect(wa2.availableSlots).not.toContain('20:00');
      expect(ig2.availableSlots).not.toContain('20:00');
      expect(wc2.availableSlots).not.toContain('20:00');
      
      // Still synchronized
      expect(wa2.availableSlots).toEqual(ig2.availableSlots);
      expect(ig2.availableSlots).toEqual(wc2.availableSlots);
    });
  });
  
  describe('User identity across channels', () => {
    it('should recognize same user across different channels', async () => {
      // User signs up via WhatsApp
      const whatsappUser = await testEnv.whatsapp.sendMessage({
        from: '+5215551234567',
        body: 'Hola, soy Juan Pérez'
      });
      
      const userId = whatsappUser.userId;
      
      // Same user contacts via Instagram (same phone)
      const instagramUser = await testEnv.instagram.connectAccount({
        igId: 'ig-user-123',
        phone: '+5215551234567' // Same phone
      });
      
      // Should be identified as same user
      expect(instagramUser.userId).toBe(userId);
      
      // User makes reservation via Instagram
      await testEnv.instagram.createReservation({
        restaurantId: 'restaurant-1',
        date: '2025-12-25',
        timeSlot: '20:00',
        partySize: 2
      });
      
      // Query reservation via WhatsApp
      const reservations = await testEnv.whatsapp.sendMessage({
        from: '+5215551234567',
        body: 'Mis reservas'
      });
      
      // Should see the reservation made via Instagram
      expect(reservations).toContain('25 de diciembre');
      expect(reservations).toContain('20:00');
    });
  });
});
```

### 4.2 QR Code Flow E2E

```typescript
// tests/e2e/qr-code-flow.test.ts

describe('QR Code Flow E2E', () => {
  it('should generate QR and validate at restaurant', async () => {
    // 1. Create reservation via WhatsApp
    const reservation = await testEnv.whatsapp.createReservation({
      restaurantId: 'restaurant-1',
      date: '2025-12-25',
      timeSlot: '20:00',
      partySize: 4
    });
    
    // 2. Wait for QR generation (async process)
    await testEnv.waitForEvent('qr.generated', { reservationId: reservation.id });
    
    // 3. User receives QR via WhatsApp
    const qrMessage = await testEnv.whatsapp.getLastMessage('+5215551234567');
    expect(qrMessage.attachments[0].type).toBe('image');
    expect(qrMessage.attachments[0].url).toContain('qr-codes');
    
    const qrUrl = qrMessage.attachments[0].url;
    
    // 4. Download and decode QR
    const qrData = await testEnv.downloadAndDecodeQR(qrUrl);
    
    expect(qrData).toMatchObject({
      reservationId: reservation.id,
      restaurantId: 'restaurant-1',
      token: expect.any(String),
      signature: expect.any(String)
    });
    
    // 5. Simulate restaurant scanning QR
    const validation = await testEnv.restaurantApp.scanQR(qrData);
    
    expect(validation.valid).toBe(true);
    expect(validation.reservation).toMatchObject({
      id: reservation.id,
      status: 'confirmed',
      guestName: expect.any(String)
    });
    
    // 6. Check-in
    const checkin = await testEnv.restaurantApp.checkIn(qrData.token);
    
    expect(checkin.success).toBe(true);
    
    // 7. Verify reservation updated
    const updated = await testEnv.db.query(
      'SELECT * FROM reservations WHERE id = $1',
      [reservation.id]
    );
    
    expect(updated.rows[0].status).toBe('checked_in');
    expect(updated.rows[0].checked_in_at).toBeDefined();
    
    // 8. Try to use QR again (should fail)
    const secondScan = await testEnv.restaurantApp.scanQR(qrData);
    
    expect(secondScan.valid).toBe(false);
    expect(secondScan.error).toBe('QR_ALREADY_USED');
  });
});
```

---

## 5. Performance Tests

### 5.1 Load Testing

```typescript
// tests/performance/load-test.ts

describe('Load Tests', () => {
  it('should handle 1000 concurrent reservations', async () => {
    const restaurant = await testEnv.createRestaurant();
    
    // Create 100 tables
    const tables = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        testEnv.createTable(restaurant.id, { 
          number: `${i + 1}`, 
          capacity: 4 
        })
      )
    );
    
    const startTime = Date.now();
    
    // 1000 users trying to reserve
    const requests = Array.from({ length: 1000 }, (_, i) => ({
      userId: `user-${i}`,
      restaurantId: restaurant.id,
      date: '2025-12-25',
      timeSlot: '20:00',
      partySize: 2,
      tableId: tables[Math.floor(i / 10)].id // 10 users per table
    }));
    
    const results = await Promise.allSettled(
      requests.map(req => testEnv.api.post('/reservations', req))
    );
    
    const duration = Date.now() - startTime;
    
    const successes = results.filter(r => 
      r.status === 'fulfilled' && r.value.status === 201
    );
    
    // Should complete in < 10 seconds
    expect(duration).toBeLessThan(10000);
    
    // Exactly 100 should succeed (1 per table)
    expect(successes.length).toBe(100);
    
    // P95 latency < 500ms
    const latencies = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value.duration)
      .sort((a, b) => a - b);
    
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });
});
```

### 5.2 Stress Testing

```typescript
// tests/performance/stress-test.ts

describe('Stress Tests', () => {
  it('should handle sustained load without degradation', async () => {
    const duration = 60000; // 1 minute
    const requestsPerSecond = 100;
    
    const metrics = await testEnv.runStressTest({
      duration,
      requestsPerSecond,
      endpoint: '/reservations',
      generateRequest: () => ({
        userId: `user-${Math.random()}`,
        restaurantId: testEnv.restaurants[0].id,
        date: '2025-12-25',
        timeSlot: randomTimeSlot(),
        partySize: randomInt(1, 6),
        tableId: randomTable()
      })
    });
    
    // Success rate > 95%
    expect(metrics.successRate).toBeGreaterThan(0.95);
    
    // P99 latency < 1 second
    expect(metrics.p99Latency).toBeLessThan(1000);
    
    // No errors
    expect(metrics.errors).toBe(0);
    
    // Throughput maintained
    expect(metrics.actualRPS).toBeGreaterThan(95);
  });
});
```

---

## 6. Chaos Engineering

```typescript
// tests/chaos/chaos-tests.ts

describe('Chaos Engineering', () => {
  it('should handle Redis failure gracefully', async () => {
    // Start normal operations
    const operations = testEnv.startContinuousOperations({
      requestsPerSecond: 10
    });
    
    // After 10 seconds, kill Redis
    await testEnv.wait(10000);
    await testEnv.chaos.killService('redis');
    
    // Operations should fail but not crash
    await testEnv.wait(5000);
    
    const metrics = await operations.getMetrics();
    
    // Should have errors but no crashes
    expect(metrics.errors).toBeGreaterThan(0);
    expect(metrics.crashes).toBe(0);
    
    // Restart Redis
    await testEnv.chaos.startService('redis');
    
    // System should recover
    await testEnv.wait(5000);
    
    const recoveryMetrics = await operations.getMetrics();
    expect(recoveryMetrics.successRate).toBeGreaterThan(0.9);
    
    await operations.stop();
  });
  
  it('should handle network partition', async () => {
    // Create partition between API and Database
    await testEnv.chaos.createNetworkPartition({
      isolate: 'postgres',
      duration: 30000 // 30 seconds
    });
    
    // Requests should fail with timeout
    const result = await testEnv.api.post('/reservations', {/* ... */});
    
    expect(result.status).toBe(503); // Service Unavailable
    expect(result.data.error).toBe('DATABASE_UNAVAILABLE');
    
    // Wait for partition to heal
    await testEnv.wait(35000);
    
    // Should work again
    const result2 = await testEnv.api.post('/reservations', {/* ... */});
    expect(result2.status).toBe(201);
  });
});
```

---

## 7. Security Tests

```typescript
// tests/security/security-tests.test.ts

describe('Security Tests', () => {
  describe('SQL Injection', () => {
    it('should prevent SQL injection in user input', async () => {
      const maliciousInput = {
        userId: "user-1'; DROP TABLE users; --",
        restaurantId: 'restaurant-1',
        specialRequests: "'; DELETE FROM reservations; --"
      };
      
      const result = await testEnv.api.post('/reservations', maliciousInput);
      
      // Should fail validation
      expect(result.status).toBe(400);
      
      // Tables should still exist
      const tables = await testEnv.db.query(
        "SELECT * FROM information_schema.tables WHERE table_name IN ('users', 'reservations')"
      );
      expect(tables.rows.length).toBe(2);
    });
  });
  
  describe('Rate Limiting', () => {
    it('should enforce rate limits per user', async () => {
      const requests = Array.from({ length: 10 }, () =>
        testEnv.api.post('/reservations', {
          userId: 'user-1',
          /* ... */
        })
      );
      
      const results = await Promise.allSettled(requests);
      
      const rateLimited = results.filter(r =>
        r.status === 'fulfilled' && r.value.status === 429
      );
      
      // Should have rate limited some requests
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
  
  describe('QR Security', () => {
    it('should reject tampered QR codes', async () => {
      const reservation = await testEnv.createReservation();
      const qrData = await testEnv.getQRData(reservation.id);
      
      // Tamper with data
      qrData.signature = 'tampered-signature';
      
      const validation = await testEnv.restaurantApp.scanQR(qrData);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('INVALID_SIGNATURE');
    });
    
    it('should reject expired QR codes', async () => {
      const reservation = await testEnv.createReservation({
        date: '2020-01-01' // Past date
      });
      
      const qrData = await testEnv.getQRData(reservation.id);
      
      const validation = await testEnv.restaurantApp.scanQR(qrData);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('QR_EXPIRED');
    });
  });
});
```

---

## 8. CI/CD Pipeline

```yaml
# .github/workflows/test.yml

name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
  
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run migrate:test
      - run: npm run test:integration
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: docker-compose up -d
      - run: npm run test:e2e
      - run: docker-compose down
  
  performance-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - run: npm run test:performance
      - name: Report results
        run: |
          echo "P95 Latency: $(cat perf-results.json | jq '.p95')" >> $GITHUB_STEP_SUMMARY
```

---

## 9. Test Coverage Requirements

```yaml
Coverage Requirements:
  Overall: 85%
  Critical Paths: 100%
    - Lock acquisition/release
    - Reservation creation
    - Availability checking
    - QR generation/validation
    - Multi-channel message routing
  
  Unit Tests: 90% coverage
  Integration Tests: 80% coverage
  E2E Tests: Critical flows only
```

---

## 10. Test Data Management

```typescript
// tests/helpers/test-data-factory.ts

export class TestDataFactory {
  
  static async createRestaurant(overrides?: Partial<Restaurant>): Promise<Restaurant> {
    return {
      id: uuid(),
      name: faker.company.name(),
      slug: faker.helpers.slugify(faker.company.name()),
      address: faker.location.streetAddress(),
      city: 'Mexico City',
      phone: '+5215551234567',
      status: 'active',
      timezone: 'America/Mexico_City',
      ...overrides
    };
  }
  
  static async createUser(overrides?: Partial<User>): Promise<User> {
    return {
      id: uuid(),
      name: faker.person.fullName(),
      phone: faker.phone.number('+52155########'),
      email: faker.internet.email(),
      phoneVerified: true,
      status: 'active',
      ...overrides
    };
  }
  
  static async createReservation(overrides?: Partial<Reservation>): Promise<Reservation> {
    const futureDate = faker.date.future();
    
    return {
      id: uuid(),
      userId: uuid(),
      restaurantId: uuid(),
      tableId: uuid(),
      date: futureDate.toISOString().split('T')[0],
      timeSlot: '20:00',
      partySize: faker.number.int({ min: 1, max: 6 }),
      status: 'confirmed',
      source: 'whatsapp',
      phoneVerified: true,
      ...overrides
    };
  }
}
```

---

## Conclusión

Esta estrategia de testing garantiza:

✅ **CERO regresiones** en funcionalidad crítica  
✅ **Sincronización perfecta** validada entre todos los canales  
✅ **Performance** óptimo bajo carga extrema  
✅ **Seguridad** validada contra ataques comunes  
✅ **Resiliencia** ante fallos de infraestructura  

**Target: 85% code coverage | 100% critical path coverage | < 1% flaky tests**
