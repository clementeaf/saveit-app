-- SaveIt App - Initial Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    phone VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_or_phone_check CHECK (email IS NOT NULL OR phone IS NOT NULL),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_phone_unique UNIQUE (phone)
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- ============================================================================
-- USER CHANNEL IDENTIFIERS TABLE
-- ============================================================================
CREATE TYPE channel_type AS ENUM ('whatsapp', 'instagram', 'webchat', 'email');

CREATE TABLE user_channel_identifiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel channel_type NOT NULL,
    channel_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_channel_unique UNIQUE (channel, channel_user_id)
);

CREATE INDEX idx_user_channel_identifiers_user_id ON user_channel_identifiers(user_id);
CREATE INDEX idx_user_channel_identifiers_channel ON user_channel_identifiers(channel, channel_user_id);

-- ============================================================================
-- RESTAURANTS TABLE
-- ============================================================================
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    
    -- Business hours (stored as JSON)
    business_hours JSONB NOT NULL DEFAULT '{}',
    
    -- Reservation settings
    max_advance_days INTEGER NOT NULL DEFAULT 90,
    min_advance_hours INTEGER NOT NULL DEFAULT 2,
    reservation_duration_minutes INTEGER NOT NULL DEFAULT 120,
    cancellation_hours_before INTEGER NOT NULL DEFAULT 24,
    
    -- Deposit settings
    requires_deposit BOOLEAN DEFAULT FALSE,
    deposit_amount DECIMAL(10,2),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT restaurants_max_advance_days_positive CHECK (max_advance_days > 0),
    CONSTRAINT restaurants_min_advance_hours_positive CHECK (min_advance_hours >= 0)
);

CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_is_active ON restaurants(is_active);

-- ============================================================================
-- TABLES TABLE (Restaurant tables)
-- ============================================================================
CREATE TYPE table_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance');

CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL,
    min_capacity INTEGER NOT NULL DEFAULT 1,
    location VARCHAR(100),
    status table_status DEFAULT 'available',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT tables_capacity_positive CHECK (capacity > 0),
    CONSTRAINT tables_min_capacity_check CHECK (min_capacity > 0 AND min_capacity <= capacity),
    CONSTRAINT tables_restaurant_number_unique UNIQUE (restaurant_id, table_number)
);

CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);
CREATE INDEX idx_tables_status ON tables(status) WHERE is_active = TRUE;
CREATE INDEX idx_tables_capacity ON tables(capacity) WHERE is_active = TRUE;

-- ============================================================================
-- RESERVATIONS TABLE (Partitioned by date)
-- ============================================================================
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show');

CREATE TABLE reservations (
    id UUID DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    table_id UUID NOT NULL REFERENCES tables(id),
    
    -- Reservation details
    date DATE NOT NULL,
    time_slot TIME NOT NULL,
    party_size INTEGER NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 120,
    
    -- Contact info (denormalized for quick access)
    guest_name VARCHAR(255) NOT NULL,
    guest_phone VARCHAR(50),
    guest_email VARCHAR(255),
    
    -- Special requests
    special_requests TEXT,
    
    -- Status
    status reservation_status DEFAULT 'pending',
    
    -- Channel tracking
    channel channel_type NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    PRIMARY KEY (id, date),
    CONSTRAINT reservations_party_size_positive CHECK (party_size > 0),
    CONSTRAINT reservations_duration_positive CHECK (duration_minutes > 0)
) PARTITION BY RANGE (date);

-- Critical index to prevent double bookings
CREATE UNIQUE INDEX idx_reservations_unique_slot ON reservations(table_id, date, time_slot) 
WHERE status IN ('confirmed', 'checked_in', 'pending');

CREATE INDEX idx_reservations_restaurant_date ON reservations(restaurant_id, date);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_channel ON reservations(channel);
CREATE INDEX idx_reservations_created_at ON reservations(created_at);

-- Create partitions for next 12 months
DO $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
BEGIN
    FOR i IN 0..11 LOOP
        start_date := DATE_TRUNC('month', CURRENT_DATE) + (i || ' months')::INTERVAL;
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'reservations_' || TO_CHAR(start_date, 'YYYY_MM');
        
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF reservations FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
    END LOOP;
END $$;

-- ============================================================================
-- RESERVATION LOGS TABLE (Audit trail)
-- ============================================================================
CREATE TABLE reservation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL,
    reservation_date DATE NOT NULL,
    action VARCHAR(50) NOT NULL,
    previous_status reservation_status,
    new_status reservation_status,
    changed_by UUID,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details JSONB DEFAULT '{}',
    FOREIGN KEY (reservation_id, reservation_date) REFERENCES reservations(id, date)
);

CREATE INDEX idx_reservation_logs_reservation ON reservation_logs(reservation_id, reservation_date);
CREATE INDEX idx_reservation_logs_changed_at ON reservation_logs(changed_at);

-- ============================================================================
-- QR CODES TABLE
-- ============================================================================
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL,
    reservation_date DATE NOT NULL,
    code VARCHAR(255) NOT NULL UNIQUE,
    s3_url TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id, reservation_date) REFERENCES reservations(id, date)
);

CREATE INDEX idx_qr_codes_reservation ON qr_codes(reservation_id, reservation_date);
CREATE INDEX idx_qr_codes_code ON qr_codes(code);
CREATE INDEX idx_qr_codes_expires_at ON qr_codes(expires_at);

-- ============================================================================
-- CONVERSATIONS TABLE
-- ============================================================================
CREATE TYPE conversation_status AS ENUM ('active', 'completed', 'abandoned');

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    restaurant_id UUID REFERENCES restaurants(id),
    channel channel_type NOT NULL,
    status conversation_status DEFAULT 'active',
    context JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_restaurant_id ON conversations(restaurant_id);
CREATE INDEX idx_conversations_channel ON conversations(channel);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    direction message_direction NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ============================================================================
-- RESTAURANT STATS TABLE (Aggregated metrics)
-- ============================================================================
CREATE TABLE restaurant_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_reservations INTEGER DEFAULT 0,
    confirmed_reservations INTEGER DEFAULT 0,
    cancelled_reservations INTEGER DEFAULT 0,
    no_show_reservations INTEGER DEFAULT 0,
    total_guests INTEGER DEFAULT 0,
    occupancy_rate DECIMAL(5,2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT restaurant_stats_unique UNIQUE (restaurant_id, date)
);

CREATE INDEX idx_restaurant_stats_restaurant_date ON restaurant_stats(restaurant_id, date);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log reservation changes
CREATE OR REPLACE FUNCTION log_reservation_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO reservation_logs (reservation_id, reservation_date, action, previous_status, new_status, changed_at)
        VALUES (NEW.id, NEW.date, 'status_change', OLD.status, NEW.status, CURRENT_TIMESTAMP);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO reservation_logs (reservation_id, reservation_date, action, new_status, changed_at)
        VALUES (NEW.id, NEW.date, 'created', NEW.status, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_reservation_changes
    AFTER INSERT OR UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION log_reservation_change();

-- Function to prevent reservations in the past
CREATE OR REPLACE FUNCTION prevent_past_reservations()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot create reservation in the past';
    END IF;
    IF NEW.date = CURRENT_DATE AND NEW.time_slot < CURRENT_TIME THEN
        RAISE EXCEPTION 'Cannot create reservation in the past';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_reservation_date
    BEFORE INSERT ON reservations
    FOR EACH ROW EXECUTE FUNCTION prevent_past_reservations();

-- ============================================================================
-- ROW LEVEL SECURITY (Optional - for multi-tenant setup)
-- ============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Create policies (example - adjust based on your auth mechanism)
-- CREATE POLICY restaurant_isolation ON reservations
--     USING (restaurant_id = current_setting('app.current_restaurant_id')::UUID);

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to check table availability
CREATE OR REPLACE FUNCTION check_table_availability(
    p_table_id UUID,
    p_date DATE,
    p_time_slot TIME,
    p_duration_minutes INTEGER DEFAULT 120
) RETURNS BOOLEAN AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM reservations
    WHERE table_id = p_table_id
      AND date = p_date
      AND status IN ('confirmed', 'checked_in', 'pending')
      AND (
          -- Check if time slots overlap
          (time_slot, time_slot + (duration_minutes || ' minutes')::INTERVAL) OVERLAPS
          (p_time_slot, p_time_slot + (p_duration_minutes || ' minutes')::INTERVAL)
      );
    
    RETURN conflict_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to get available tables
CREATE OR REPLACE FUNCTION get_available_tables(
    p_restaurant_id UUID,
    p_date DATE,
    p_time_slot TIME,
    p_party_size INTEGER,
    p_duration_minutes INTEGER DEFAULT 120
) RETURNS TABLE (
    table_id UUID,
    table_number VARCHAR,
    capacity INTEGER,
    location VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.table_number, t.capacity, t.location
    FROM tables t
    WHERE t.restaurant_id = p_restaurant_id
      AND t.is_active = TRUE
      AND t.status = 'available'
      AND t.capacity >= p_party_size
      AND t.min_capacity <= p_party_size
      AND check_table_availability(t.id, p_date, p_time_slot, p_duration_minutes)
    ORDER BY t.capacity ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE reservations IS 'Partitioned table storing all reservations, with strict unique constraint to prevent double bookings';
COMMENT ON INDEX idx_reservations_unique_slot IS 'Critical index that guarantees zero double bookings by enforcing uniqueness on (table_id, date, time_slot) for active reservations';
COMMENT ON FUNCTION check_table_availability IS 'Returns true if a table is available for the given date/time slot, considering overlapping reservations';
COMMENT ON FUNCTION get_available_tables IS 'Returns all available tables for a restaurant that can accommodate the party size and have no conflicting reservations';
