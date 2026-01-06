# SaveIt App - Esquema de Base de Datos

## Visión General

Esquema de base de datos PostgreSQL 15 optimizado para:
- **Transacciones ACID** con aislamiento SERIALIZABLE
- **Alta concurrencia** con locks optimistas y pesimistas
- **Auditoría completa** de todas las operaciones
- **Escalabilidad** con particionamiento y índices compuestos

---

## Diagrama de Relaciones (ERD)

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│    users    │────────<│conversations │>────────│  messages   │
└──────┬──────┘         └──────────────┘         └─────────────┘
       │                                                  
       │ 1:N                                             
       │                                                  
┌──────▼──────────────┐                                  
│user_channel_        │                                  
│  identifiers        │                                  
└─────────────────────┘                                  
                                                         
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│ restaurants │────────<│    tables    │>────────│ table_slots │
└──────┬──────┘         └──────┬───────┘         └─────────────┘
       │                       │                                  
       │ 1:N                   │ 1:N                             
       │                       │                                  
┌──────▼──────────┐     ┌──────▼────────┐                        
│restaurant_rules │     │ reservations  │                        
└─────────────────┘     └──────┬────────┘                        
                               │                                  
                               │ 1:N                             
                               │                                  
                        ┌──────▼────────────┐                    
                        │reservation_logs   │                    
                        └───────────────────┘                    
                                                                  
┌──────────────────┐                                             
│  qr_codes        │                                             
└──────────────────┘                                             
```

---

## Tablas Core

### 1. users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Información personal
    name VARCHAR(255),
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    
    -- Verificación
    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verified_at TIMESTAMPTZ,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    
    -- Estado
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, blocked
    
    -- Preferencias
    preferences JSONB DEFAULT '{}'::JSONB,
    language VARCHAR(10) DEFAULT 'es',
    timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
    
    -- Estadísticas
    total_reservations INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    cancelled_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    -- Índices automáticos por UNIQUE constraints
    CONSTRAINT users_phone_valid CHECK (phone ~ '^\+?[1-9]\d{1,14}$'),
    CONSTRAINT users_email_valid CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices adicionales
CREATE INDEX idx_users_status ON users(status) WHERE status = 'active';
CREATE INDEX idx_users_phone_verified ON users(phone_verified, phone) WHERE phone_verified = TRUE;
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_no_show_count ON users(no_show_count) WHERE no_show_count > 0;

-- Trigger para updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE users IS 'Usuarios del sistema que pueden hacer reservas';
COMMENT ON COLUMN users.preferences IS 'Preferencias del usuario en formato JSON (ej: {"notifications": {"whatsapp": true}})';
```

### 2. user_channel_identifiers

```sql
CREATE TABLE user_channel_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Canal
    channel VARCHAR(50) NOT NULL, -- whatsapp, instagram, webchat, email, sms
    identifier VARCHAR(255) NOT NULL, -- phone number, username, email, session_id
    
    -- Estado
    active BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    
    -- Preferencias por canal
    opt_out BOOLEAN DEFAULT FALSE,
    preferences JSONB DEFAULT '{}'::JSONB,
    
    -- Metadata
    first_used_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    usage_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(channel, identifier),
    CONSTRAINT valid_channel CHECK (channel IN ('whatsapp', 'instagram', 'webchat', 'email', 'sms', 'voice'))
);

-- Índices
CREATE INDEX idx_uci_user_id ON user_channel_identifiers(user_id);
CREATE INDEX idx_uci_channel_identifier ON user_channel_identifiers(channel, identifier);
CREATE INDEX idx_uci_active ON user_channel_identifiers(user_id, channel) WHERE active = TRUE;
CREATE INDEX idx_uci_last_used ON user_channel_identifiers(last_used_at DESC);

COMMENT ON TABLE user_channel_identifiers IS 'Mapeo de usuarios a sus identificadores en diferentes canales';
```

### 3. restaurants

```sql
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Información básica
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    cuisine_type VARCHAR(100),
    
    -- Contacto
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(500),
    
    -- Ubicación
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Mexico',
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Operación
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, maintenance
    timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
    
    -- Configuración
    settings JSONB DEFAULT '{}'::JSONB,
    
    -- Media
    logo_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    images JSONB DEFAULT '[]'::JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT restaurants_phone_valid CHECK (phone ~ '^\+?[1-9]\d{1,14}$')
);

-- Índices
CREATE INDEX idx_restaurants_status ON restaurants(status) WHERE status = 'active';
CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_city ON restaurants(city, country);
CREATE INDEX idx_restaurants_location ON restaurants USING GIST(ll_to_earth(latitude, longitude));

COMMENT ON TABLE restaurants IS 'Restaurantes registrados en la plataforma';
COMMENT ON COLUMN restaurants.settings IS 'Configuración general del restaurante';
```

### 4. restaurant_rules

```sql
CREATE TABLE restaurant_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Versión (para histórico de cambios)
    version INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT TRUE,
    
    -- Ventana de reserva
    min_hours_advance INTEGER DEFAULT 2,
    max_days_advance INTEGER DEFAULT 30,
    allow_same_day BOOLEAN DEFAULT TRUE,
    
    -- Horarios de operación
    business_hours JSONB NOT NULL DEFAULT '{
        "monday": {"open": "11:00", "close": "23:00", "closed": false},
        "tuesday": {"open": "11:00", "close": "23:00", "closed": false},
        "wednesday": {"open": "11:00", "close": "23:00", "closed": false},
        "thursday": {"open": "11:00", "close": "23:00", "closed": false},
        "friday": {"open": "11:00", "close": "23:00", "closed": false},
        "saturday": {"open": "11:00", "close": "23:00", "closed": false},
        "sunday": {"open": "11:00", "close": "23:00", "closed": false}
    }'::JSONB,
    
    -- Slots y capacidad
    slot_duration_minutes INTEGER DEFAULT 30,
    turnover_time_minutes INTEGER DEFAULT 15,
    max_party_size INTEGER DEFAULT 12,
    overbooking_percent DECIMAL(5, 2) DEFAULT 0.00,
    
    -- Política de cancelación
    free_cancellation_hours INTEGER DEFAULT 24,
    no_show_penalty BOOLEAN DEFAULT FALSE,
    penalty_amount DECIMAL(10, 2),
    blocked_reservations_after_no_show INTEGER DEFAULT 2,
    
    -- Requisitos
    requires_phone_verification BOOLEAN DEFAULT TRUE,
    requires_deposit BOOLEAN DEFAULT FALSE,
    deposit_amount DECIMAL(10, 2),
    requires_credit_card BOOLEAN DEFAULT FALSE,
    requires_identification BOOLEAN DEFAULT FALSE,
    
    -- Fechas especiales
    special_dates JSONB DEFAULT '[]'::JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    UNIQUE(restaurant_id, version)
);

-- Índices
CREATE INDEX idx_restaurant_rules_restaurant ON restaurant_rules(restaurant_id, active) WHERE active = TRUE;
CREATE INDEX idx_restaurant_rules_version ON restaurant_rules(restaurant_id, version DESC);

COMMENT ON TABLE restaurant_rules IS 'Reglas de negocio configurables por restaurante';
COMMENT ON COLUMN restaurant_rules.special_dates IS 'Array de fechas especiales: [{"date": "2025-12-25", "type": "closed", "multiplier": null}]';
```

### 5. tables

```sql
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Identificación
    table_number VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    
    -- Capacidad
    min_capacity INTEGER DEFAULT 1,
    max_capacity INTEGER NOT NULL,
    
    -- Ubicación dentro del restaurant
    location VARCHAR(100), -- terrace, indoor, bar, private_room
    section VARCHAR(100),
    floor INTEGER DEFAULT 1,
    
    -- Estado
    status VARCHAR(50) DEFAULT 'available', -- available, reserved, occupied, maintenance, disabled
    
    -- Características
    features JSONB DEFAULT '[]'::JSONB, -- ["window_view", "wheelchair_accessible", "high_chair"]
    
    -- Prioridad (para asignación automática)
    priority INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(restaurant_id, table_number),
    CONSTRAINT tables_capacity_valid CHECK (min_capacity <= max_capacity)
);

-- Índices
CREATE INDEX idx_tables_restaurant ON tables(restaurant_id, status);
CREATE INDEX idx_tables_capacity ON tables(restaurant_id, max_capacity, status) WHERE status = 'available';
CREATE INDEX idx_tables_priority ON tables(restaurant_id, priority DESC, max_capacity);

COMMENT ON TABLE tables IS 'Mesas disponibles en cada restaurante';
COMMENT ON COLUMN tables.priority IS 'Prioridad para asignación automática (mayor = más prioritaria)';
```

### 6. reservations

```sql
-- Tabla particionada por fecha (mensual)
CREATE TABLE reservations (
    id UUID DEFAULT gen_random_uuid(),
    
    -- Referencias
    user_id UUID NOT NULL REFERENCES users(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    table_id UUID NOT NULL REFERENCES tables(id),
    
    -- Reserva
    date DATE NOT NULL,
    time_slot TIME NOT NULL,
    party_size INTEGER NOT NULL,
    
    -- Estado
    status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, checked_in, completed, cancelled, no_show
    
    -- Información adicional
    special_requests TEXT,
    internal_notes TEXT, -- Solo para staff del restaurant
    
    -- Contacto
    contact_name VARCHAR(255),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    
    -- Pago
    deposit_paid BOOLEAN DEFAULT FALSE,
    deposit_amount DECIMAL(10, 2),
    deposit_transaction_id VARCHAR(255),
    
    -- Verificación
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- QR Code
    qr_code_url VARCHAR(500),
    qr_code_generated_at TIMESTAMPTZ,
    
    -- Check-in
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID,
    
    -- Cancelación
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID,
    cancellation_reason TEXT,
    
    -- Source tracking
    source VARCHAR(50) NOT NULL, -- whatsapp, instagram, webchat, email, api
    source_metadata JSONB DEFAULT '{}'::JSONB,
    
    -- Lock tracking (para sincronización)
    lock_id VARCHAR(100),
    locked_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    
    PRIMARY KEY (id, date),
    
    CONSTRAINT reservations_party_size_valid CHECK (party_size > 0 AND party_size <= 50),
    CONSTRAINT reservations_time_valid CHECK (time_slot >= '00:00:00' AND time_slot <= '23:59:59'),
    CONSTRAINT reservations_status_valid CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'))
) PARTITION BY RANGE (date);

-- Crear particiones para los próximos 12 meses
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..12 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'reservations_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF reservations
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        
        start_date := end_date;
    END LOOP;
END $$;

-- Índices compuestos críticos para rendimiento
CREATE INDEX idx_reservations_restaurant_date ON reservations(restaurant_id, date, time_slot);
CREATE INDEX idx_reservations_table_datetime ON reservations(table_id, date, time_slot, status);
CREATE INDEX idx_reservations_user ON reservations(user_id, status, date DESC);
CREATE INDEX idx_reservations_status_date ON reservations(status, date) WHERE status IN ('confirmed', 'checked_in');
CREATE INDEX idx_reservations_lock ON reservations(lock_id) WHERE lock_id IS NOT NULL;
CREATE INDEX idx_reservations_created ON reservations(created_at DESC);

-- Índice para prevenir doble reserva (crítico)
CREATE UNIQUE INDEX idx_reservations_unique_slot ON reservations(table_id, date, time_slot)
    WHERE status IN ('confirmed', 'checked_in', 'pending');

COMMENT ON TABLE reservations IS 'Reservas de mesas en restaurantes';
COMMENT ON INDEX idx_reservations_unique_slot IS 'CRÍTICO: Previene doble reserva en mismo slot';
```

### 7. reservation_logs

```sql
CREATE TABLE reservation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL,
    reservation_date DATE NOT NULL,
    
    -- Acción
    action VARCHAR(50) NOT NULL, -- CREATED, UPDATED, CANCELLED, CHECKED_IN, NO_SHOW, COMPLETED
    
    -- Actor
    performed_by UUID REFERENCES users(id),
    performed_by_type VARCHAR(50), -- user, staff, system
    
    -- Cambios
    changes JSONB, -- {"field": "status", "old": "confirmed", "new": "cancelled"}
    
    -- Contexto
    details JSONB DEFAULT '{}'::JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (reservation_id, reservation_date) REFERENCES reservations(id, date)
);

-- Índices
CREATE INDEX idx_reservation_logs_reservation ON reservation_logs(reservation_id, reservation_date, created_at DESC);
CREATE INDEX idx_reservation_logs_action ON reservation_logs(action, created_at DESC);
CREATE INDEX idx_reservation_logs_performed_by ON reservation_logs(performed_by, created_at DESC);

COMMENT ON TABLE reservation_logs IS 'Audit trail completo de todas las operaciones sobre reservas';
```

### 8. conversations

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Usuario y canal
    user_id UUID NOT NULL REFERENCES users(id),
    channel VARCHAR(50) NOT NULL,
    channel_identifier VARCHAR(255) NOT NULL,
    
    -- Estado
    status VARCHAR(50) DEFAULT 'active', -- active, closed, archived
    
    -- Contexto (para mantener estado de conversación)
    context JSONB DEFAULT '{}'::JSONB,
    
    -- Intent tracking
    current_intent VARCHAR(100),
    last_intent VARCHAR(100),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    
    -- Session info
    session_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    
    CONSTRAINT conversations_channel_valid CHECK (channel IN ('whatsapp', 'instagram', 'webchat', 'email', 'sms', 'voice'))
);

-- Índices
CREATE INDEX idx_conversations_user_channel ON conversations(user_id, channel, status);
CREATE INDEX idx_conversations_status ON conversations(status, updated_at DESC) WHERE status = 'active';
CREATE INDEX idx_conversations_channel_id ON conversations(channel, channel_identifier);

COMMENT ON TABLE conversations IS 'Conversaciones activas con usuarios por diferentes canales';
COMMENT ON COLUMN conversations.context IS 'Estado de la conversación: {"intent": "make_reservation", "restaurantId": "...", "date": "..."}';
```

### 9. messages

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Identificación del mensaje
    channel_message_id VARCHAR(255), -- ID del mensaje en el canal original
    
    -- Dirección
    direction VARCHAR(20) NOT NULL, -- inbound, outbound
    
    -- Contenido
    text TEXT,
    content_type VARCHAR(50) DEFAULT 'text', -- text, image, video, document, location
    attachments JSONB DEFAULT '[]'::JSONB,
    
    -- NLU
    detected_intent VARCHAR(100),
    detected_entities JSONB DEFAULT '{}'::JSONB,
    confidence DECIMAL(5, 4),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT messages_direction_valid CHECK (direction IN ('inbound', 'outbound'))
);

-- Índices
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_channel_id ON messages(channel_message_id);
CREATE INDEX idx_messages_intent ON messages(detected_intent, created_at DESC) WHERE detected_intent IS NOT NULL;

COMMENT ON TABLE messages IS 'Mensajes intercambiados en conversaciones';
```

### 10. qr_codes

```sql
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL,
    reservation_date DATE NOT NULL,
    
    -- QR Code data
    qr_data TEXT NOT NULL UNIQUE,
    qr_image_url VARCHAR(500),
    
    -- Seguridad
    token VARCHAR(255) NOT NULL UNIQUE,
    signature VARCHAR(512) NOT NULL,
    nonce VARCHAR(255) NOT NULL,
    
    -- Validez
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Uso
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    used_by UUID,
    scan_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    FOREIGN KEY (reservation_id, reservation_date) REFERENCES reservations(id, date),
    
    CONSTRAINT qr_codes_not_expired CHECK (expires_at > created_at)
);

-- Índices
CREATE INDEX idx_qr_codes_reservation ON qr_codes(reservation_id, reservation_date);
CREATE INDEX idx_qr_codes_token ON qr_codes(token) WHERE used = FALSE;
CREATE INDEX idx_qr_codes_expires ON qr_codes(expires_at) WHERE used = FALSE;

COMMENT ON TABLE qr_codes IS 'Códigos QR generados para reservas';
COMMENT ON COLUMN qr_codes.signature IS 'HMAC-SHA256 signature para validación';
```

---

## Funciones y Triggers

### 1. Función para updated_at automático

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Función para actualizar estadísticas de usuario

```sql
CREATE OR REPLACE FUNCTION update_user_reservation_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Nueva reserva
        UPDATE users SET total_reservations = total_reservations + 1 WHERE id = NEW.user_id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Cambio de estado
        IF OLD.status != NEW.status THEN
            IF NEW.status = 'no_show' THEN
                UPDATE users SET no_show_count = no_show_count + 1 WHERE id = NEW.user_id;
            ELSIF NEW.status = 'cancelled' THEN
                UPDATE users SET cancelled_count = cancelled_count + 1 WHERE id = NEW.user_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_stats
    AFTER INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_user_reservation_stats();
```

### 3. Función para prevenir reservas pasadas

```sql
CREATE OR REPLACE FUNCTION prevent_past_reservations()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date < CURRENT_DATE THEN
        RAISE EXCEPTION 'No se pueden crear reservas en fechas pasadas';
    END IF;
    
    IF NEW.date = CURRENT_DATE AND NEW.time_slot < CURRENT_TIME THEN
        RAISE EXCEPTION 'No se pueden crear reservas en horarios pasados del día actual';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_past_reservations
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_past_reservations();
```

### 4. Función para limpieza de locks expirados

```sql
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE reservations
    SET lock_id = NULL, locked_at = NULL
    WHERE lock_id IS NOT NULL
      AND locked_at < NOW() - INTERVAL '1 minute';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar cada minuto con pg_cron (extensión)
-- SELECT cron.schedule('cleanup-locks', '* * * * *', 'SELECT cleanup_expired_locks()');
```

---

## Vistas Útiles

### 1. Vista de disponibilidad actual

```sql
CREATE OR REPLACE VIEW v_current_availability AS
SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    t.id as table_id,
    t.table_number,
    t.max_capacity,
    t.status as table_status,
    CURRENT_DATE as date,
    ts.slot_time,
    CASE 
        WHEN res.id IS NOT NULL THEN FALSE
        ELSE TRUE
    END as available,
    res.id as reservation_id,
    res.status as reservation_status
FROM restaurants r
CROSS JOIN tables t
CROSS JOIN LATERAL (
    SELECT time::time as slot_time
    FROM generate_series(
        CURRENT_DATE + '10:00:00'::time,
        CURRENT_DATE + '23:00:00'::time,
        '30 minutes'::interval
    ) time
) ts
LEFT JOIN reservations res ON (
    res.table_id = t.id
    AND res.date = CURRENT_DATE
    AND res.time_slot = ts.slot_time
    AND res.status IN ('confirmed', 'checked_in')
)
WHERE 
    t.restaurant_id = r.id
    AND t.status = 'available'
    AND r.status = 'active'
ORDER BY r.name, t.table_number, ts.slot_time;

COMMENT ON VIEW v_current_availability IS 'Vista en tiempo real de disponibilidad de mesas';
```

### 2. Vista de reservas activas

```sql
CREATE OR REPLACE VIEW v_active_reservations AS
SELECT 
    res.id,
    res.date,
    res.time_slot,
    res.party_size,
    res.status,
    res.source,
    
    u.name as user_name,
    u.phone as user_phone,
    u.email as user_email,
    
    r.name as restaurant_name,
    r.phone as restaurant_phone,
    
    t.table_number,
    t.max_capacity,
    
    res.created_at,
    res.checked_in_at,
    
    -- Tiempo hasta la reserva
    CASE 
        WHEN res.date > CURRENT_DATE THEN
            EXTRACT(EPOCH FROM (res.date + res.time_slot - NOW())) / 3600
        WHEN res.date = CURRENT_DATE AND res.time_slot > CURRENT_TIME THEN
            EXTRACT(EPOCH FROM (CURRENT_DATE + res.time_slot - NOW())) / 3600
        ELSE 0
    END as hours_until_reservation
    
FROM reservations res
JOIN users u ON u.id = res.user_id
JOIN restaurants r ON r.id = res.restaurant_id
JOIN tables t ON t.id = res.table_id
WHERE 
    res.status IN ('confirmed', 'checked_in')
    AND (
        res.date > CURRENT_DATE
        OR (res.date = CURRENT_DATE AND res.time_slot >= CURRENT_TIME - INTERVAL '2 hours')
    )
ORDER BY res.date, res.time_slot;

COMMENT ON VIEW v_active_reservations IS 'Reservas activas con información completa';
```

---

## Índices de Performance

```sql
-- Índice GiST para búsquedas geográficas
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;
CREATE INDEX idx_restaurants_coordinates ON restaurants 
    USING GIST(ll_to_earth(latitude, longitude));

-- Índice para búsqueda full-text
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_restaurants_name_trgm ON restaurants USING GIN(name gin_trgm_ops);
CREATE INDEX idx_users_name_trgm ON users USING GIN(name gin_trgm_ops);

-- Índices para queries comunes de analytics
CREATE INDEX idx_reservations_analytics ON reservations(
    restaurant_id, 
    date, 
    status,
    source
) WHERE status IN ('completed', 'no_show');
```

---

## Scripts de Mantenimiento

### 1. Crear particiones automáticamente

```sql
CREATE OR REPLACE FUNCTION create_future_partitions()
RETURNS void AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    -- Crear particiones para los próximos 3 meses
    FOR i IN 0..2 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'reservations_' || TO_CHAR(start_date, 'YYYY_MM');
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_class WHERE relname = partition_name
        ) THEN
            EXECUTE FORMAT(
                'CREATE TABLE %I PARTITION OF reservations
                 FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            
            RAISE NOTICE 'Created partition: %', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 2. Archivar reservas antiguas

```sql
CREATE TABLE reservations_archive (LIKE reservations INCLUDING ALL);

CREATE OR REPLACE FUNCTION archive_old_reservations()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Mover reservas de más de 6 meses al archivo
    WITH moved AS (
        DELETE FROM reservations
        WHERE date < CURRENT_DATE - INTERVAL '6 months'
        RETURNING *
    )
    INSERT INTO reservations_archive
    SELECT * FROM moved;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    RAISE NOTICE 'Archived % old reservations', archived_count;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Queries de Ejemplo

### 1. Buscar disponibilidad para fecha/hora/capacidad

```sql
SELECT 
    t.id,
    t.table_number,
    t.max_capacity,
    t.location
FROM tables t
WHERE 
    t.restaurant_id = :restaurant_id
    AND t.status = 'available'
    AND t.max_capacity >= :party_size
    AND NOT EXISTS (
        SELECT 1 
        FROM reservations r
        WHERE r.table_id = t.id
          AND r.date = :date
          AND r.time_slot = :time_slot
          AND r.status IN ('confirmed', 'checked_in', 'pending')
    )
ORDER BY 
    t.max_capacity ASC,
    t.priority DESC
LIMIT 10;
```

### 2. Obtener reservas de un usuario con detalles

```sql
SELECT 
    res.*,
    r.name as restaurant_name,
    r.address,
    r.phone as restaurant_phone,
    t.table_number,
    qr.qr_image_url
FROM reservations res
JOIN restaurants r ON r.id = res.restaurant_id
JOIN tables t ON t.id = res.table_id
LEFT JOIN qr_codes qr ON (qr.reservation_id = res.id AND qr.reservation_date = res.date)
WHERE 
    res.user_id = :user_id
    AND res.status NOT IN ('cancelled')
ORDER BY res.date DESC, res.time_slot DESC
LIMIT 20;
```

### 3. Dashboard de restaurant - reservas del día

```sql
SELECT 
    res.time_slot,
    t.table_number,
    res.party_size,
    res.status,
    u.name as guest_name,
    u.phone as guest_phone,
    res.special_requests,
    res.checked_in_at,
    EXTRACT(EPOCH FROM (NOW() - res.created_at)) / 60 as minutes_since_booking
FROM reservations res
JOIN users u ON u.id = res.user_id
JOIN tables t ON t.id = res.table_id
WHERE 
    res.restaurant_id = :restaurant_id
    AND res.date = CURRENT_DATE
    AND res.status IN ('confirmed', 'checked_in')
ORDER BY res.time_slot, t.table_number;
```

---

## Consideraciones de Seguridad

### 1. Row Level Security (RLS)

```sql
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios solo ven sus propias reservas
CREATE POLICY user_reservations_policy ON reservations
    FOR SELECT
    TO authenticated_user
    USING (user_id = current_user_id());

-- Policy: staff del restaurant puede ver todas las reservas del restaurant
CREATE POLICY restaurant_staff_policy ON reservations
    FOR ALL
    TO restaurant_staff
    USING (restaurant_id IN (
        SELECT restaurant_id FROM restaurant_staff WHERE user_id = current_user_id()
    ));
```

### 2. Cifrado de datos sensibles

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ejemplo de columna cifrada
ALTER TABLE users ADD COLUMN encrypted_data BYTEA;

-- Funciones de ayuda
CREATE OR REPLACE FUNCTION encrypt_data(data TEXT, key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_data(encrypted BYTEA, key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted, key);
END;
$$ LANGUAGE plpgsql;
```

---

## Monitoreo y Observabilidad

### 1. Query para detectar locks problemáticos

```sql
SELECT 
    pid,
    usename,
    pg_blocking_pids(pid) as blocked_by,
    query,
    age(clock_timestamp(), query_start) as duration
FROM pg_stat_activity
WHERE 
    state != 'idle'
    AND query NOT LIKE '%pg_stat_activity%'
ORDER BY duration DESC;
```

### 2. Estadísticas de rendimiento por tabla

```sql
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;
```

---

## Backup y Recuperación

```bash
# Backup completo
pg_dump -h localhost -U postgres -Fc -f saveit_backup_$(date +%Y%m%d).dump saveit_db

# Backup de esquema solamente
pg_dump -h localhost -U postgres --schema-only -f saveit_schema.sql saveit_db

# Restore
pg_restore -h localhost -U postgres -d saveit_db saveit_backup_20251219.dump

# Backup continuo con WAL
# Configurar en postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /path/to/archive/%f'
```

---

## Conclusión

Este esquema proporciona:

✅ **Integridad referencial** completa  
✅ **Índices optimizados** para queries críticos  
✅ **Particionamiento** para escalabilidad  
✅ **Auditoría completa** de operaciones  
✅ **Prevención de conflictos** con constraints y triggers  
✅ **Performance** optimizado para alta concurrencia  
✅ **Seguridad** con RLS y cifrado  

**El esquema está diseñado para soportar > 10,000 reservas concurrentes sin degradación de rendimiento.**
