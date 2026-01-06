# SaveIt App - Arquitectura de Infraestructura en AWS

## Visión General

Sistema de gestión de reservas de restaurantes en tiempo real con múltiples canales de comunicación (WhatsApp, Instagram, WebChat, Email) usando arquitectura basada en eventos y microservicios desplegada en AWS para garantizar alta sincronización, disponibilidad y escalabilidad.

## Principios de Diseño

- **Alta Disponibilidad**: Multi-AZ deployment
- **Escalabilidad Horizontal**: Auto-scaling de servicios
- **Event-Driven**: Arquitectura basada en eventos para desacoplamiento
- **Real-time Sync**: Sincronización en tiempo real con locks distribuidos
- **Security First**: Cifrado en tránsito y reposo, IAM roles granulares
- **Observability**: Monitoreo, logging y tracing completo

---

## Arquitectura AWS

### 1. Capa de Canales (Frontend/Integraciones)

#### Chatbot Gateway

**AWS Lambda Functions** (Node.js/TypeScript)
- `whatsapp-webhook-handler` - Integración con WhatsApp Business API
- `instagram-webhook-handler` - Integración vía Meta Graph API
- `webchat-handler` - API para widget embebible
- `email-processor` - Procesamiento vía Amazon SES

**API Gateway (REST + WebSocket)**
- REST API para integraciones síncronas
- WebSocket API para actualizaciones en tiempo real
- Throttling y rate limiting por API key
- Custom authorizers (Lambda)

#### Procesamiento de Lenguaje Natural

**Amazon Lex v2**
- Intents personalizados por flujo de reserva
- Slots para capturar: fecha, hora, número de personas, nombre
- Multi-idioma (español, inglés)
- Fallback a operador humano

**Alternativa**: AWS Lambda + OpenAI API / Anthropic Claude
- Para conversaciones más complejas
- Context management en DynamoDB

---

### 2. Capa de Aplicación (Backend)

#### API Gateway

**Amazon API Gateway**
- REST APIs para operaciones CRUD
- WebSocket API para real-time updates
- Usage Plans con API Keys por restaurante
- WAF (Web Application Firewall) para protección DDoS
- Custom domain con Route 53

**AWS Application Load Balancer (ALB)**
- Para servicios en ECS/EKS
- Path-based routing
- Health checks
- SSL/TLS termination

#### Microservicios Core

**Compute Options**: AWS ECS Fargate o AWS Lambda

```
reservation-service/
├── Gestión de reservas CRUD
├── Validación de reglas de negocio
├── Sincronización en tiempo real
└── Endpoints:
    ├── POST /reservations
    ├── GET /reservations/{id}
    ├── PUT /reservations/{id}
    ├── DELETE /reservations/{id}
    └── GET /reservations/user/{userId}

availability-service/
├── Cálculo de disponibilidad en tiempo real
├── Bloqueo optimista/pesimista de mesas
├── Cache distribuido de disponibilidad
└── Endpoints:
    ├── GET /availability/{restaurantId}
    ├── POST /availability/check
    └── PUT /availability/refresh

notification-service/
├── Envío multi-canal (WhatsApp, Email, SMS)
├── Templates personalizables (SES Templates)
├── Cola de prioridades (SQS FIFO)
└── Handlers:
    ├── WhatsApp via Twilio/MessageBird
    ├── Email via Amazon SES
    ├── SMS via Amazon SNS

restaurant-config-service/
├── Reglas de reserva por restaurant
├── Horarios, capacidad, políticas
├── Configuración de mesas
└── Endpoints:
    ├── GET /restaurants/{id}/config
    ├── PUT /restaurants/{id}/config
    └── GET /restaurants/{id}/rules

qr-service/
├── Generación de QR únicos por reserva
├── Validación en punto de llegada
├── Check-in automatizado
└── Endpoints:
    ├── POST /qr/generate
    ├── POST /qr/validate
    └── POST /qr/checkin

analytics-service/
├── Métricas y reportes
├── Data aggregation desde Kinesis
└── Dashboards en QuickSight
```

**Deployment Strategy**

```yaml
ECS Fargate (Recomendado para servicios stateful):
  - Cluster por ambiente (dev, staging, prod)
  - Task definitions con auto-scaling
  - Service discovery con AWS Cloud Map
  - Secrets en AWS Secrets Manager

AWS Lambda (Para servicios stateless/event-driven):
  - Notification service
  - QR generation
  - Webhook handlers
  - Event processors
```

---

### 3. Capa de Datos

#### Bases de Datos

**Amazon RDS PostgreSQL (Multi-AZ)**
```sql
-- Base de datos principal ACID
Instancia: db.r6g.xlarge
Storage: gp3 (IOPS optimizado)
Multi-AZ: Sí (failover automático)
Read Replicas: 2 (queries de lectura)
Backup: Snapshots automáticos diarios
Encryption: AWS KMS

Esquemas:
├── reservations (id, user_id, restaurant_id, date, time, party_size, status, qr_code)
├── users (id, name, email, phone, verification_status)
├── restaurants (id, name, address, contact, settings)
├── tables (id, restaurant_id, capacity, number, status)
└── reservation_logs (audit trail completo)
```

**Amazon ElastiCache for Redis (Cluster Mode)**
```yaml
Node Type: cache.r6g.large
Cluster: 3 nodos (1 primary, 2 replicas)
Multi-AZ: Enabled
Encryption: In-transit + at-rest

Uso:
├── Cache de disponibilidad en tiempo real
├── Sesiones de conversación (TTL 1h)
├── Locks distribuidos para reservas (TTL 30s)
├── Rate limiting por usuario/IP
└── Pub/Sub para notificaciones WebSocket
```

**Amazon DynamoDB** (Opcional para alta escala)
```yaml
Tables:
├── ConversationContext (Partition: userId, Sort: timestamp)
├── ReservationEventsStream (Partition: reservationId, Sort: eventTime)
└── AnalyticsAggregates (Partition: restaurantId, Sort: date)

Features:
├── On-demand pricing o provisioned
├── DynamoDB Streams para CDC
├── Global Tables para multi-region
└── TTL para limpieza automática
```

**Amazon S3**
```yaml
Buckets:
├── saveit-qr-codes/ (QR generados)
├── saveit-restaurant-assets/ (logos, imágenes)
├── saveit-backups/ (exports de DB)
└── saveit-logs/ (archivos de logs)

Lifecycle Policies:
├── QR codes: Transition a Glacier después de 90 días
└── Logs: Delete después de 1 año
```

---

### 4. Message Broker & Event Streaming

**Amazon EventBridge**
```yaml
Event Bus: saveit-events

Rules:
├── reservation.created → SNS Topic → Lambda notifications
├── reservation.cancelled → Lambda (availability update)
├── availability.changed → WebSocket broadcast
├── qr.validated → Lambda (check-in processing)
└── no-show.detected → Lambda (penalty processing)

Integrations:
├── Lambda functions
├── SQS queues
├── SNS topics
└── Step Functions workflows
```

**Amazon SQS**
```yaml
FIFO Queues:
├── notification-queue.fifo (notificaciones con orden)
├── high-priority-notifications.fifo
└── analytics-events.fifo

Standard Queues:
├── dead-letter-queue (mensajes fallidos)
└── batch-processing-queue
```

**Amazon SNS**
```yaml
Topics:
├── reservation-notifications
├── system-alerts
└── marketing-campaigns (futuro)
```

**Amazon Kinesis Data Streams** (para analytics)
```yaml
Stream: saveit-analytics-stream
Shards: 4 (auto-scaling)
Retention: 7 días

Producers:
├── Reservation service
├── Availability service
└── QR service

Consumers:
├── Lambda → S3 (data lake)
├── Lambda → OpenSearch (búsqueda)
└── Kinesis Data Analytics → QuickSight
```

---

### 5. Sincronización en Tiempo Real

#### Estrategia de Consistencia con AWS

```
Flujo de Reserva Atómica:

1. API Gateway recibe solicitud
   ↓
2. Lambda/ECS valida JWT
   ↓
3. Availability Service:
   - SET NX lock en Redis: "reservation:lock:{restaurantId}:{date}:{time}"
   - TTL: 30 segundos
   - Si lock falla → HTTP 409 Conflict
   ↓
4. Query PostgreSQL (Read Replica) para validar disponibilidad
   ↓
5. Transacción ACID en PostgreSQL Primary:
   BEGIN;
     INSERT INTO reservations (...);
     UPDATE tables SET status = 'reserved' WHERE id = ?;
   COMMIT;
   ↓
6. EventBridge event: "reservation.created"
   ↓
7. Lambda actualiza Redis cache:
   - DEL "availability:{restaurantId}:{date}"
   - PUBLISH "websocket:availability" → Broadcast
   ↓
8. Lambda release lock:
   - DEL "reservation:lock:..."
   ↓
9. SNS → SQS FIFO → Lambda notificaciones asíncronas
   ↓
10. Return HTTP 201 + reservation details + QR URL
```

#### WebSocket Real-Time Updates

**API Gateway WebSocket API**
```yaml
Routes:
├── $connect (Lambda authorizer)
├── $disconnect (cleanup connections)
├── subscribe (subscribe a restaurant updates)
└── unsubscribe

Connection Management:
- DynamoDB table: websocket_connections
  - connectionId (PK)
  - restaurantId (GSI)
  - userId
  - connectedAt

Broadcast Flow:
1. Event → Lambda
2. Query DynamoDB por restaurantId
3. Para cada connectionId:
   - POST @connections/{connectionId}
   - Handle stale connections
```

---

### 6. Reglas de Negocio Configurables

**DynamoDB Table: restaurant_rules**

```typescript
interface RestaurantRules {
  restaurantId: string; // PK
  version: number; // para control de cambios
  
  reservationWindow: {
    minHoursAdvance: number; // default: 2
    maxDaysAdvance: number; // default: 30
    allowSameDay: boolean;
  };
  
  cancellationPolicy: {
    freeCancellationHours: number; // default: 24
    noShowPenalty: boolean;
    penaltyAmount?: number; // USD
    blockedReservationsAfterNoShow: number; // default: 2
  };
  
  capacity: {
    tables: Table[];
    maxPartySizePerTable: Record<string, number>;
    overbookingPercent: number; // default: 0
    minimumTableTurnoverMinutes: number; // default: 90
  };
  
  timeSlots: {
    slotDuration: number; // minutos, default: 30
    turnoverTime: number; // buffer entre reservas, default: 15
    customSlots?: TimeSlot[]; // para horarios especiales
  };
  
  businessHours: {
    [day: string]: { // monday-sunday
      open: string; // "11:00"
      close: string; // "23:00"
      closed: boolean;
    };
  };
  
  requirements: {
    requiresDeposit: boolean;
    depositAmount?: number;
    requiresPhoneVerification: boolean;
    requiresCreditCard: boolean;
    requiresIdentification: boolean;
  };
  
  specialDates: {
    date: string; // ISO date
    type: 'closed' | 'special_hours' | 'high_demand';
    multiplier?: number; // para high_demand
    customHours?: { open: string; close: string };
  }[];
}
```

**Validación con AWS Lambda**
```typescript
// Lambda: validate-reservation-rules
export async function handler(event) {
  const { restaurantId, date, time, partySize } = event;
  
  // 1. Fetch rules from DynamoDB
  const rules = await getRules(restaurantId);
  
  // 2. Validaciones
  const validations = [
    validateReservationWindow(date, rules),
    validateBusinessHours(date, time, rules),
    validatePartySize(partySize, rules),
    validateSpecialDates(date, rules),
  ];
  
  return {
    valid: validations.every(v => v.valid),
    errors: validations.filter(v => !v.valid),
  };
}
```

---

### 7. Flujo Completo con QR

```
┌─────────────────────────────────────────────────────────┐
│ 1. RESERVA VIA CHATBOT                                  │
└─────────────────────────────────────────────────────────┘
Usuario: "Quiero reservar para 4 personas mañana a las 20:00"
   ↓
WhatsApp → API Gateway → Lambda Webhook Handler
   ↓
Amazon Lex procesa intent: "MakeReservation"
Slots: {date: "2025-12-20", time: "20:00", partySize: 4}
   ↓
Lambda → Reservation Service (ECS)

┌─────────────────────────────────────────────────────────┐
│ 2. VALIDACIÓN Y RESERVA                                 │
└─────────────────────────────────────────────────────────┘
Reservation Service:
   ↓
1. Validate Rules (DynamoDB)
2. Redis Lock (SETNX)
3. Check Availability (PostgreSQL + Redis Cache)
4. Create Reservation (PostgreSQL Transaction)
5. Publish Event (EventBridge: reservation.created)
6. Update Cache (Redis)
7. Release Lock

┌─────────────────────────────────────────────────────────┐
│ 3. GENERACIÓN DE QR                                     │
└─────────────────────────────────────────────────────────┘
EventBridge Rule → Lambda: generate-qr
   ↓
Lambda:
  1. Generate unique token: UUID v4
  2. Sign with HMAC-SHA256 (secret from Secrets Manager)
  3. Create QR payload:
     {
       reservationId: "...",
       restaurantId: "...",
       token: "...",
       expiresAt: "...",
       signature: "..."
     }
  4. Generate QR image (qrcode library)
  5. Upload to S3: saveit-qr-codes/{reservationId}.png
  6. Generate CloudFront signed URL (TTL 48h)
  7. Update reservation with QR URL in PostgreSQL

┌─────────────────────────────────────────────────────────┐
│ 4. NOTIFICACIÓN AL USUARIO                              │
└─────────────────────────────────────────────────────────┘
EventBridge → SNS → SQS FIFO → Lambda: send-notification
   ↓
Lambda:
  - WhatsApp: "✅ Reserva confirmada!"
  - Detalles: Restaurant, Fecha, Hora, Personas
  - QR adjunto (CloudFront URL)
  - Mensaje: "Muestra este QR al llegar"
  
Email vía SES:
  - Template HTML personalizado
  - QR embebido
  - Botón "Agregar a Calendario" (iCal file en S3)

┌─────────────────────────────────────────────────────────┐
│ 5. CLIENTE LLEGA AL RESTAURANTE                         │
└─────────────────────────────────────────────────────────┘
Host escanea QR con app móvil (React Native/Flutter)
   ↓
App → API Gateway → Lambda: validate-qr
   ↓
Lambda:
  1. Decode QR payload
  2. Verify HMAC signature
  3. Check expiration
  4. Query PostgreSQL:
     - Reservation exists?
     - Status = 'confirmed'?
     - Already checked-in?
     - Date/time within tolerance (±15 min)?
  
  Si válido:
    5. UPDATE reservations SET status = 'checked_in'
    6. EventBridge: qr.validated
    7. Redis: SET checkin:{reservationId} "true" EX 7200
    8. Return success + customer details

┌─────────────────────────────────────────────────────────┐
│ 6. POST CHECK-IN                                        │
└─────────────────────────────────────────────────────────┘
EventBridge: qr.validated → Lambda
   ↓
1. Actualizar estado de mesa (PostgreSQL)
2. Enviar notificación a staff (WebSocket)
3. Actualizar métricas (Kinesis → CloudWatch)
4. Registrar en audit log

App del Restaurant (Web Dashboard):
   - WebSocket notification: "Cliente de reserva #123 ha llegado"
   - Mostrar detalles: Nombre, Mesa asignada, Preferencias
```

---

### 8. Stack Tecnológico AWS

```yaml
Compute:
  - AWS Lambda (Node.js 20.x / Python 3.12)
  - Amazon ECS Fargate (containers)
  - Opcional: Amazon EKS (Kubernetes para alta escala)

API & Integration:
  - Amazon API Gateway (REST + WebSocket)
  - AWS AppSync (GraphQL alternativa)
  - Amazon EventBridge (event bus)

Databases:
  - Amazon RDS PostgreSQL 15 (Multi-AZ)
  - Amazon ElastiCache Redis 7.x (Cluster Mode)
  - Amazon DynamoDB (on-demand)

Storage:
  - Amazon S3 (Standard + Intelligent-Tiering)
  - Amazon CloudFront (CDN para QR y assets)

Messaging:
  - Amazon SQS (FIFO + Standard)
  - Amazon SNS (pub/sub)
  - Amazon Kinesis Data Streams

AI/ML:
  - Amazon Lex v2 (chatbot NLU)
  - Amazon Comprehend (sentiment analysis - futuro)
  - AWS Lambda + OpenAI API (conversaciones avanzadas)

Communication:
  - Amazon SES (email)
  - Amazon SNS (SMS)
  - Twilio API (WhatsApp - via Lambda)
  - Meta Graph API (Instagram - via Lambda)

Security:
  - AWS IAM (roles y policies)
  - AWS Secrets Manager (credenciales)
  - AWS KMS (encryption keys)
  - AWS WAF (firewall)
  - AWS Certificate Manager (SSL/TLS)

Monitoring & Logging:
  - Amazon CloudWatch (metrics + logs)
  - AWS X-Ray (distributed tracing)
  - Amazon OpenSearch (log analytics)
  - Amazon QuickSight (BI dashboards)

DevOps:
  - AWS CodePipeline (CI/CD)
  - AWS CodeBuild (build automation)
  - AWS CodeDeploy (deployments)
  - Amazon ECR (container registry)
  - AWS CloudFormation / Terraform (IaC)

Networking:
  - Amazon VPC (isolated network)
  - AWS PrivateLink (service endpoints)
  - Route 53 (DNS)
  - CloudFront (CDN + edge)
```

---

### 9. Seguridad y Compliance

#### Seguridad en Tránsito
```yaml
- TLS 1.3 en todos los endpoints
- Certificate Manager para certificados
- API Gateway con custom domains
- CloudFront con HTTPS obligatorio
```

#### Seguridad en Reposo
```yaml
Encryption:
  - RDS: AWS KMS encryption
  - S3: SSE-KMS
  - EBS volumes: encrypted
  - ElastiCache: encryption at rest
  - DynamoDB: KMS encryption
  - Secrets Manager: automatic rotation
```

#### IAM Policies (Least Privilege)
```yaml
Roles por servicio:
  - ReservationServiceRole
    - RDS: read/write reservations table
    - Redis: read/write
    - EventBridge: PutEvents
    - Secrets Manager: GetSecretValue
  
  - NotificationServiceRole
    - SES: SendEmail
    - SNS: Publish
    - SQS: ReceiveMessage/DeleteMessage
  
  - QRServiceRole
    - S3: PutObject saveit-qr-codes/*
    - CloudFront: SignUrl
    - Secrets Manager: GetSecretValue (HMAC key)
```

#### QR Security
```typescript
// QR Payload Structure
interface QRPayload {
  reservationId: string;
  restaurantId: string;
  timestamp: number; // Unix timestamp
  expiresAt: number;
  nonce: string; // prevent replay attacks
  signature: string; // HMAC-SHA256
}

// Signature Generation
const secret = await getSecretFromSecretsManager('qr-hmac-secret');
const payload = {reservationId, restaurantId, timestamp, expiresAt, nonce};
const signature = crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

#### Rate Limiting & DDoS Protection
```yaml
API Gateway:
  - Throttling: 10,000 req/s por cuenta
  - Burst: 5,000
  - Per API Key: 1,000 req/s

WAF Rules:
  - Rate-based rule: 100 req/5min por IP
  - Geo-blocking (si aplicable)
  - SQL injection protection
  - XSS protection

CloudFront:
  - AWS Shield Standard (gratis)
  - Opcional: Shield Advanced para DDoS L7
```

#### PII Protection
```yaml
Data Classification:
  - PII: name, email, phone (encrypted en DB)
  - Sensitive: credit card (tokenized via Stripe/PaymentProvider)
  - Audit: all access logged to CloudWatch

Encryption Functions (Lambda Layer):
  - encrypt(data, kmsKeyId)
  - decrypt(encryptedData, kmsKeyId)
  
PostgreSQL:
  - pgcrypto extension
  - Column-level encryption para PII
```

#### Compliance
```yaml
- GDPR: Right to deletion (Lambda: gdpr-delete-user)
- Data retention policies (S3 Lifecycle, RDS snapshots)
- Audit trail completo (CloudTrail + CloudWatch Logs)
- Privacy policy acceptance tracking
```

---

### 10. Escalabilidad y Performance

#### Auto-Scaling Configuration

**ECS Fargate Services**
```yaml
reservation-service:
  min_tasks: 2
  max_tasks: 20
  target_cpu: 70%
  target_memory: 80%
  scale_in_cooldown: 300s
  scale_out_cooldown: 60s

availability-service:
  min_tasks: 2
  max_tasks: 50 # alta demanda en horarios pico
  target_cpu: 60%
  target_requests: 1000 per target
```

**Lambda Concurrency**
```yaml
Reserved Concurrency:
  - webhook-handlers: 100
  - notification-service: 200
  - qr-validator: 50

Provisioned Concurrency (latency-sensitive):
  - availability-check: 10 instances warm
```

**Database Scaling**
```yaml
RDS PostgreSQL:
  - Vertical: hasta db.r6g.8xlarge si needed
  - Horizontal: 2-5 read replicas
  - Connection pooling: RDS Proxy (max 1000 connections)
  - Autoscaling storage: 100GB → 1TB

ElastiCache Redis:
  - Cluster mode: 3-10 shards
  - Replicas: 2 per shard
  - Auto-discovery enabled
```

#### Caching Strategy (3 niveles)

```yaml
Level 1 - CloudFront (Edge):
  - Static assets: 1 año
  - QR images: 48 horas
  - API responses (GET): 1 minuto

Level 2 - Application (ElastiCache Redis):
  - Availability cache: 30 segundos
  - Restaurant config: 5 minutos
  - User session: 1 hora
  - Rate limit counters: rolling window

Level 3 - Database:
  - PostgreSQL query cache
  - Materialized views para analytics
  - Read replicas para queries pesadas
```

#### Performance Optimization

```yaml
Database:
  - Índices compuestos:
    - (restaurant_id, date, time) para availability queries
    - (user_id, status, date) para user reservations
    - (qr_code) unique index para validación
  - Partitioning: reservations table por mes
  - VACUUM and ANALYZE scheduled jobs

API Gateway:
  - Caching habilitado: 1 minuto para GET endpoints
  - Compression: Gzip enabled

Lambda:
  - Memory: 512MB-1024MB (optimal para Node.js)
  - Timeout: 30s max
  - VPC: solo si necesario (cold start penalty)
  - Lambda layers: shared dependencies

Network:
  - VPC Endpoints: S3, DynamoDB, Secrets Manager (no internet)
  - PrivateLink: para servicios AWS
  - NAT Gateway: Multi-AZ para HA
```

#### Monitoring & Alerting

```yaml
CloudWatch Alarms:
  - High CPU (ECS): > 80% for 5 min
  - High Memory: > 85% for 5 min
  - Lambda Errors: > 1% error rate
  - API Latency: P99 > 2 segundos
  - Database Connections: > 80% pool
  - Redis Memory: > 75% used
  - SQS Queue Depth: > 1000 messages

CloudWatch Dashboards:
  - Real-time metrics por servicio
  - Reservation funnel conversion
  - Error rates y latencies
  - Cost tracking

X-Ray:
  - Distributed tracing habilitado
  - Service map visualization
  - Analyze bottlenecks
```

---

### 11. Disaster Recovery & Business Continuity

#### Backup Strategy

```yaml
RDS PostgreSQL:
  - Automated backups: 7 días retention
  - Manual snapshots: pre-deployment
  - Point-in-time recovery: enabled
  - Cross-region backup: replicar a región secundaria

DynamoDB:
  - Point-in-time recovery: 35 días
  - On-demand backups: pre-cambios críticos
  - Cross-region replication: opcional

S3:
  - Versioning: enabled en buckets críticos
  - Cross-region replication: buckets de QR
  - Lifecycle: Glacier para archival

ElastiCache:
  - Snapshots diarios: 5 días retention
  - Multi-AZ automatic failover
```

#### Multi-Region Strategy (Futuro)

```yaml
Primary Region: us-east-1 (N. Virginia)
Secondary Region: us-west-2 (Oregon)

Active-Passive:
  - RDS: Cross-region read replica (promote si failover)
  - S3: Cross-region replication automática
  - DynamoDB Global Tables: Active-Active
  - Route 53: Health checks + failover routing
  - Lambda: deploy en ambas regiones

RTO (Recovery Time Objective): 15 minutos
RPO (Recovery Point Objective): 5 minutos
```

#### Disaster Recovery Procedures

```markdown
1. Database Failure:
   - RDS Multi-AZ failover: automático (1-2 min)
   - Si región completa falla: promote read replica en us-west-2

2. Service Outage:
   - ECS: Auto-healing automático
   - Lambda: retry con exponential backoff
   - Health checks: ALB marca unhealthy → reemplaza task

3. Data Corruption:
   - Point-in-time recovery de RDS
   - S3 versioning para recuperar objetos

4. Complete Region Failure:
   - Route 53 failover a us-west-2
   - Ejecutar CloudFormation stack en región secundaria
   - Promote RDS replica
   - Tiempo estimado: 15-30 minutos
```

---

### 12. Estimación de Costos AWS (Producción)

**Compute**
```yaml
Lambda:
  - 10M invocations/mes: $20
  - Compute time: $50
  Total: ~$70/mes

ECS Fargate:
  - 4 servicios × 2 tasks × 0.5 vCPU × 1GB
  - 24/7 uptime: $150/mes
  - Auto-scaling peaks: +$50/mes
  Total: ~$200/mes
```

**Databases**
```yaml
RDS PostgreSQL (db.r6g.xlarge Multi-AZ):
  - Instancia: $500/mes
  - Storage 200GB: $50/mes
  - Read Replicas (2): $500/mes
  Total: ~$1,050/mes

ElastiCache Redis (cache.r6g.large × 3):
  - Cluster: $350/mes
  Total: ~$350/mes

DynamoDB (on-demand):
  - Low traffic: $50/mes
  Total: ~$50/mes
```

**Networking & Storage**
```yaml
S3:
  - 100GB storage: $2.30/mes
  - 1M PUT requests: $5/mes
  - 10M GET requests: $0.40/mes
  Total: ~$10/mes

CloudFront:
  - 100GB transfer: $8.50/mes
  - 10M requests: $10/mes
  Total: ~$20/mes

Data Transfer:
  - NAT Gateway: $45/mes
  - Inter-AZ: $20/mes
  Total: ~$65/mes
```

**Messaging & Events**
```yaml
SQS: $5/mes
SNS: $5/mes
EventBridge: $10/mes
Kinesis: $80/mes (4 shards)
Total: ~$100/mes
```

**Monitoring & Security**
```yaml
CloudWatch: $30/mes
X-Ray: $15/mes
Secrets Manager: $5/mes
WAF: $20/mes
Total: ~$70/mes
```

**Third-Party APIs**
```yaml
Twilio (WhatsApp): $50/mes
SendGrid/SES: $10/mes
Stripe: por transacción
Total: ~$60/mes
```

**Total Estimado Mensual: ~$2,000 - $2,500/mes**

*Para escala inicial (1,000-5,000 reservas/día). Costos escalan linealmente con uso.*

---

### 13. Roadmap de Implementación

#### Fase 1: MVP (8 semanas)

**Semanas 1-2: Infraestructura Base**
- [ ] Setup AWS Organization y cuentas (dev, staging, prod)
- [ ] VPC, subnets, security groups
- [ ] RDS PostgreSQL + ElastiCache Redis
- [ ] S3 buckets + CloudFront
- [ ] CI/CD pipeline (CodePipeline)

**Semanas 3-4: Servicios Core**
- [ ] Restaurant Config Service (DynamoDB + Lambda)
- [ ] Availability Service (ECS + Redis)
- [ ] Reservation Service (ECS + PostgreSQL)
- [ ] API Gateway + WAF setup

**Semanas 5-6: Integraciones**
- [ ] WhatsApp Business API (Twilio)
- [ ] Amazon Lex chatbot
- [ ] QR Service (Lambda + S3)
- [ ] Notification Service (SES + SNS)

**Semanas 7-8: Testing & Launch**
- [ ] Load testing (Locust/k6)
- [ ] Security audit
- [ ] Monitoring dashboards
- [ ] Soft launch con 1 restaurante piloto

#### Fase 2: Expansión (4 semanas)

**Semanas 9-10**
- [ ] Instagram integration
- [ ] WebChat widget
- [ ] Email booking
- [ ] Multi-restaurante dashboard

**Semanas 11-12**
- [ ] Analytics & BI (QuickSight)
- [ ] A/B testing framework
- [ ] Performance optimization
- [ ] Scale testing (10K+ reservas/día)

#### Fase 3: Features Avanzadas (8 semanas)

**Semanas 13-16**
- [ ] Payment integration (Stripe)
- [ ] Loyalty program
- [ ] Smart recommendations (ML)
- [ ] Multi-idioma avanzado

**Semanas 17-20**
- [ ] Mobile apps (iOS/Android)
- [ ] Table management optimization (AI)
- [ ] Predictive no-show detection
- [ ] Multi-region deployment

---

### 14. Métricas de Éxito

```yaml
Technical KPIs:
  - API Latency P99: < 500ms
  - System Uptime: 99.9%
  - Error Rate: < 0.1%
  - Reservation Success Rate: > 95%
  - QR Validation Time: < 200ms
  - Database Query Time P95: < 100ms

Business KPIs:
  - Reservations per Day: tracking
  - No-Show Rate: < 10%
  - Customer Satisfaction: > 4.5/5
  - Average Response Time (chatbot): < 5s
  - Conversion Rate (inquiry → booking): > 60%
  - Restaurant Onboarding Time: < 2 hours
```

---

## Diagramas de Arquitectura

### Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIOS / CANALES                        │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  WhatsApp    │  Instagram   │   WebChat    │      Email         │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
       └──────────────┴──────────────┴────────────────┘
                          │
                ┌─────────▼──────────┐
                │   API Gateway       │
                │  (REST + WebSocket) │
                │   + AWS WAF         │
                └─────────┬───────────┘
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
┌──────▼──────┐   ┌───────▼───────┐   ┌─────▼──────┐
│  Amazon Lex │   │  Lambda       │   │ WebSocket  │
│  (Chatbot)  │   │  Webhooks     │   │ Manager    │
└──────┬──────┘   └───────┬───────┘   └─────┬──────┘
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
              ┌───────────▼────────────┐
              │  Application Layer      │
              │  (ECS Fargate/Lambda)   │
              ├─────────────────────────┤
              │ • Reservation Service   │
              │ • Availability Service  │
              │ • Restaurant Config     │
              │ • QR Service            │
              │ • Notification Service  │
              │ • Analytics Service     │
              └───────────┬─────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
┌──────▼──────┐   ┌───────▼───────┐   ┌─────▼──────┐
│ PostgreSQL  │   │  ElastiCache  │   │ DynamoDB   │
│  (RDS)      │   │   (Redis)     │   │            │
│ Multi-AZ    │   │  Cluster Mode │   │            │
└─────────────┘   └───────────────┘   └────────────┘
                          │
              ┌───────────▼────────────┐
              │   Event Bus Layer      │
              ├────────────────────────┤
              │ • EventBridge          │
              │ • SQS (FIFO)           │
              │ • SNS                  │
              │ • Kinesis Streams      │
              └────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │  Monitoring & Logs     │
              ├────────────────────────┤
              │ • CloudWatch           │
              │ • X-Ray                │
              │ • OpenSearch           │
              │ • QuickSight           │
              └────────────────────────┘
```

---

## Conclusiones

Esta arquitectura proporciona:

✅ **Alta disponibilidad** con Multi-AZ y auto-scaling  
✅ **Sincronización en tiempo real** con Redis locks y EventBridge  
✅ **Escalabilidad horizontal** de todos los componentes  
✅ **Seguridad robusta** con IAM, KMS, WAF y cifrado end-to-end  
✅ **Observabilidad completa** con CloudWatch, X-Ray y dashboards  
✅ **Disaster recovery** con backups automáticos y failover  
✅ **Flexibilidad** para agregar nuevos canales y features  

## Próximos Pasos Recomendados

1. **Validar requisitos** con stakeholders
2. **Definir esquema de base de datos** detallado
3. **Crear POC** de reserva con lock distribuido
4. **Setup de ambiente AWS** (dev + staging)
5. **Implementar CI/CD pipeline**
6. **Desarrollar MVP** (Fase 1 del roadmap)

---

**Documento creado:** 2025-12-19  
**Versión:** 1.0  
**Autor:** SaveIt Architecture Team  
**AWS Well-Architected Review:** Pending
