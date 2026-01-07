-- SaveIt App - Seed Data for Development
-- This file populates the database with test data for local development

-- ============================================================================
-- TEST RESTAURANTS
-- ============================================================================

INSERT INTO restaurants (id, name, slug, address, phone, email, timezone, business_hours, max_advance_days, min_advance_hours, reservation_duration_minutes, cancellation_hours_before, requires_deposit, is_active)
VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'La Trattoria',
    'la-trattoria',
    '123 Main St, New York, NY 10001',
    '+1-212-555-0001',
    'contact@latrattoria.com',
    'America/New_York',
    '{
        "monday": [{"open": "11:00", "close": "22:00"}],
        "tuesday": [{"open": "11:00", "close": "22:00"}],
        "wednesday": [{"open": "11:00", "close": "22:00"}],
        "thursday": [{"open": "11:00", "close": "22:00"}],
        "friday": [{"open": "11:00", "close": "23:00"}],
        "saturday": [{"open": "10:00", "close": "23:00"}],
        "sunday": [{"open": "10:00", "close": "21:00"}]
    }',
    90,
    2,
    120,
    24,
    false,
    true
),
(
    '22222222-2222-2222-2222-222222222222',
    'El Asador',
    'el-asador',
    '456 Park Ave, New York, NY 10022',
    '+1-212-555-0002',
    'reservas@elasador.com',
    'America/New_York',
    '{
        "monday": [{"open": "17:00", "close": "23:00"}],
        "tuesday": [{"open": "17:00", "close": "23:00"}],
        "wednesday": [{"open": "17:00", "close": "23:00"}],
        "thursday": [{"open": "17:00", "close": "23:00"}],
        "friday": [{"open": "17:00", "close": "00:00"}],
        "saturday": [{"open": "17:00", "close": "00:00"}],
        "sunday": []
    }',
    60,
    4,
    150,
    48,
    true,
    true
);

-- ============================================================================
-- TEST TABLES
-- ============================================================================

-- Tables for La Trattoria
INSERT INTO tables (id, restaurant_id, table_number, capacity, min_capacity, location, status, is_active)
VALUES 
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'T01', 2, 1, 'Window', 'available', true),
('a1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'T02', 2, 1, 'Window', 'available', true),
('a1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'T03', 4, 2, 'Main Hall', 'available', true),
('a1111111-1111-1111-1111-111111111114', '11111111-1111-1111-1111-111111111111', 'T04', 4, 2, 'Main Hall', 'available', true),
('a1111111-1111-1111-1111-111111111115', '11111111-1111-1111-1111-111111111111', 'T05', 6, 4, 'Main Hall', 'available', true),
('a1111111-1111-1111-1111-111111111116', '11111111-1111-1111-1111-111111111111', 'T06', 8, 6, 'Private Room', 'available', true),
('a1111111-1111-1111-1111-111111111117', '11111111-1111-1111-1111-111111111111', 'T07', 10, 8, 'Private Room', 'available', true);

-- Tables for El Asador
INSERT INTO tables (id, restaurant_id, table_number, capacity, min_capacity, location, status, is_active)
VALUES 
('a2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'A01', 2, 1, 'Bar Area', 'available', true),
('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'A02', 2, 1, 'Bar Area', 'available', true),
('a2222222-2222-2222-2222-222222222223', '22222222-2222-2222-2222-222222222222', 'A03', 4, 2, 'Terrace', 'available', true),
('a2222222-2222-2222-2222-222222222224', '22222222-2222-2222-2222-222222222222', 'A04', 4, 2, 'Terrace', 'available', true),
('a2222222-2222-2222-2222-222222222225', '22222222-2222-2222-2222-222222222222', 'A05', 6, 4, 'Main Dining', 'available', true),
('a2222222-2222-2222-2222-222222222226', '22222222-2222-2222-2222-222222222222', 'A06', 8, 6, 'Main Dining', 'available', true);

-- ============================================================================
-- TEST USERS
-- ============================================================================

INSERT INTO users (id, email, phone, full_name)
VALUES 
('u1111111-1111-1111-1111-111111111111', 'john.doe@example.com', '+12125550101', 'John Doe'),
('u2222222-2222-2222-2222-222222222222', 'jane.smith@example.com', '+12125550102', 'Jane Smith'),
('u3333333-3333-3333-3333-333333333333', 'bob.wilson@example.com', '+12125550103', 'Bob Wilson'),
('u4444444-4444-4444-4444-444444444444', NULL, '+12125550104', 'Maria Garcia'),
('u5555555-5555-5555-5555-555555555555', 'alice.brown@example.com', NULL, 'Alice Brown');

-- ============================================================================
-- USER CHANNEL IDENTIFIERS
-- ============================================================================

INSERT INTO user_channel_identifiers (user_id, channel, channel_user_id)
VALUES 
('u1111111-1111-1111-1111-111111111111', 'whatsapp', 'whatsapp:+12125550101'),
('u1111111-1111-1111-1111-111111111111', 'email', 'john.doe@example.com'),
('u2222222-2222-2222-2222-222222222222', 'instagram', 'janesmith_ig'),
('u2222222-2222-2222-2222-222222222222', 'email', 'jane.smith@example.com'),
('u3333333-3333-3333-3333-333333333333', 'webchat', 'webchat_user_bob123'),
('u4444444-4444-4444-4444-444444444444', 'whatsapp', 'whatsapp:+12125550104'),
('u5555555-5555-5555-5555-555555555555', 'email', 'alice.brown@example.com');

-- ============================================================================
-- SAMPLE RESERVATIONS
-- ============================================================================

-- Upcoming reservations for testing
INSERT INTO reservations (id, restaurant_id, user_id, table_id, date, time_slot, party_size, duration_minutes, guest_name, guest_phone, guest_email, status, channel)
VALUES 
(
    'r1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'u1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111113',
    CURRENT_DATE + INTERVAL '2 days',
    '19:00',
    4,
    120,
    'John Doe',
    '+12125550101',
    'john.doe@example.com',
    'confirmed',
    'whatsapp'
),
(
    'r2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'u2222222-2222-2222-2222-222222222222',
    'a1111111-1111-1111-1111-111111111111',
    CURRENT_DATE + INTERVAL '3 days',
    '20:00',
    2,
    120,
    'Jane Smith',
    '+12125550102',
    'jane.smith@example.com',
    'confirmed',
    'instagram'
),
(
    'r3333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'u3333333-3333-3333-3333-333333333333',
    'a2222222-2222-2222-2222-222222222225',
    CURRENT_DATE + INTERVAL '5 days',
    '20:30',
    6,
    150,
    'Bob Wilson',
    '+12125550103',
    'bob.wilson@example.com',
    'confirmed',
    'webchat'
),
(
    'r4444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    'u4444444-4444-4444-4444-444444444444',
    'a2222222-2222-2222-2222-222222222223',
    CURRENT_DATE + INTERVAL '1 day',
    '19:30',
    4,
    150,
    'Maria Garcia',
    '+12125550104',
    NULL,
    'confirmed',
    'whatsapp'
);

-- ============================================================================
-- SAMPLE CONVERSATIONS
-- ============================================================================

INSERT INTO conversations (id, user_id, restaurant_id, channel, status, context)
VALUES 
(
    'c1111111-1111-1111-1111-111111111111',
    'u1111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    'whatsapp',
    'completed',
    '{"last_intent": "make_reservation", "reservation_id": "r1111111-1111-1111-1111-111111111111"}'
),
(
    'c2222222-2222-2222-2222-222222222222',
    'u2222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'instagram',
    'completed',
    '{"last_intent": "make_reservation", "reservation_id": "r2222222-2222-2222-2222-222222222222"}'
);

-- ============================================================================
-- SAMPLE MESSAGES
-- ============================================================================

INSERT INTO messages (conversation_id, direction, content, metadata)
VALUES 
(
    'c1111111-1111-1111-1111-111111111111',
    'inbound',
    'Hola, quisiera hacer una reserva',
    '{"timestamp": "2024-01-15T10:00:00Z"}'
),
(
    'c1111111-1111-1111-1111-111111111111',
    'outbound',
    '¡Hola! Claro, con gusto te ayudo. ¿Para qué restaurante deseas hacer la reserva?',
    '{"timestamp": "2024-01-15T10:00:02Z"}'
),
(
    'c1111111-1111-1111-1111-111111111111',
    'inbound',
    'La Trattoria',
    '{"timestamp": "2024-01-15T10:00:15Z"}'
),
(
    'c1111111-1111-1111-1111-111111111111',
    'outbound',
    'Perfecto. ¿Para cuántas personas y qué día?',
    '{"timestamp": "2024-01-15T10:00:17Z"}'
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- These are commented out but can be used to verify the seed data
-- SELECT * FROM restaurants;
-- SELECT * FROM tables;
-- SELECT * FROM users;
-- SELECT * FROM user_channel_identifiers;
-- SELECT * FROM reservations;
-- SELECT * FROM conversations;
-- SELECT * FROM messages;
