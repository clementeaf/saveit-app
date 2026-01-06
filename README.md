# SaveIt App 🍽️

Sistema multi-canal de reservas de restaurantes con garantía de **cero doble reservas** y sincronización en tiempo real.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Docker & Docker Compose
- Git

### Initial Setup

```bash
# 1. Clonar el repositorio (si aplica)
git clone <repository-url>
cd saveit-app

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env

# 4. Levantar servicios de infraestructura (PostgreSQL, Redis, LocalStack)
npm run docker:up

# 5. Esperar a que los servicios estén listos (30 segundos aprox)
# Verificar con:
docker ps

# 6. Cargar datos de prueba
npm run db:seed
```

### Development

```bash
# Ejecutar todos los servicios en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Linting y formateo
npm run lint
npm run format

# TypeCheck
npm run typecheck
```

### Docker Management

```bash
# Iniciar servicios
npm run docker:up

# Ver logs
npm run docker:logs

# Detener servicios
npm run docker:down

# Acceder a servicios:
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - LocalStack: localhost:4566
# - pgAdmin: http://localhost:5050 (con profile --tools)
# - Redis Commander: http://localhost:8081 (con profile --tools)
```

## 📁 Estructura del Proyecto

```
saveit-app/
├── services/               # Microservicios
│   ├── reservation/       # Servicio de reservas (core)
│   ├── channel-gateway/   # Gateway multi-canal
│   ├── notification/      # Servicio de notificaciones
│   ├── qr-code/          # Generación de QR codes
│   └── analytics/        # Métricas y analytics
├── shared/               # Código compartido
│   ├── types/           # TypeScript types
│   ├── utils/           # Utilidades comunes
│   ├── middleware/      # Middleware compartido
│   ├── database/        # Cliente de base de datos
│   └── cache/           # Cliente de Redis
├── database/            # Database management
│   ├── migrations/      # Migraciones SQL
│   └── seeds/          # Datos de prueba
├── terraform/          # Infrastructure as Code
│   ├── modules/       # Módulos reutilizables
│   └── environments/  # Configuración por ambiente
├── tests/             # Tests
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── docs/              # Documentación técnica
└── config/            # Configuraciones
```

## 🏗️ Arquitectura

SaveIt App está construido con una arquitectura de microservicios en AWS:

- **Compute**: AWS Lambda (Node.js 20.x), ECS Fargate
- **Database**: RDS PostgreSQL 15 Multi-AZ con read replicas
- **Cache**: ElastiCache Redis 7.1 (3-node cluster)
- **Events**: EventBridge, SQS FIFO, SNS
- **Storage**: S3 + CloudFront
- **Monitoring**: CloudWatch, X-Ray, OpenSearch

### Canales Soportados

- ✅ WhatsApp (via Twilio)
- ✅ Instagram (via Meta Graph API)
- ✅ WebChat (WebSocket)
- ✅ Email (AWS SES)

## 🔒 Garantías de Sincronización

El sistema garantiza **CERO doble reservas** mediante:

1. **Locks Distribuidos**: Redis SETNX con TTL de 30 segundos
2. **Transacciones ACID**: PostgreSQL con aislamiento SERIALIZABLE
3. **Índice Único**: `(table_id, date, time_slot)` para reservas activas
4. **Validación Multi-Nivel**: Pre-validación → Lock → Validación → Transaction
5. **Cache Invalidation**: Propagación <1 segundo a todos los canales

Ver `docs/GARANTIAS_SINCRONIZACION.md` para detalles completos.

## 📊 Database Schema

El schema incluye:
- Particionamiento mensual de reservas
- 10 tablas principales con integridad referencial
- Triggers automáticos para auditoría
- Funciones para disponibilidad de mesas
- Row Level Security habilitado

Ver `docs/DATABASE_SCHEMA.md` y `database/migrations/001_initial_schema.sql`.

## 🧪 Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests (requiere servicios levantados)
npm run test:performance
```

Estrategia de testing:
- 50% Unit tests
- 30% Component tests
- 15% Integration tests
- 5% E2E tests

Ver `docs/TESTING_STRATEGY.md`.

## 📖 Documentación

- [ARQUITECTURA.md](docs/ARQUITECTURA.md) - Arquitectura completa del sistema
- [GARANTIAS_SINCRONIZACION.md](docs/GARANTIAS_SINCRONIZACION.md) - Mecanismos de sincronización
- [SINCRONIZACION_MULTICANAL.md](docs/SINCRONIZACION_MULTICANAL.md) - Integración multi-canal
- [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) - Esquema de base de datos
- [TERRAFORM_STRUCTURE.md](docs/TERRAFORM_STRUCTURE.md) - Infraestructura como código
- [TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) - Estrategia de testing

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js 20.x
- **Language**: TypeScript 5.x
- **Framework**: Express.js (REST), WebSocket
- **Database**: PostgreSQL 15
- **Cache**: Redis 7.1
- **ORM**: node-postgres (pg)
- **Testing**: Jest, Supertest
- **Build**: Turbo (monorepo)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions

## 🔐 Security

- Row Level Security (RLS) en PostgreSQL
- Rate limiting por IP y usuario
- Validación de webhooks
- Secrets en AWS Secrets Manager
- HTTPS/TLS en todos los endpoints
- Input validation con Zod

## 📈 Monitoring & Observability

- Logs estructurados (JSON)
- Distributed tracing (X-Ray)
- Métricas en CloudWatch
- Alertas en SNS
- Dashboard en OpenSearch

## 🚧 Roadmap

- [ ] Implementación de servicios core
- [ ] Adaptadores de canales
- [ ] Sistema de notificaciones
- [ ] Generación de QR codes
- [ ] Dashboard administrativo
- [ ] Terraform módulos
- [ ] Pipeline CI/CD
- [ ] Chaos engineering tests
- [ ] Performance optimization

## 📝 License

Propietario - SaveIt App

## 👥 Team

Desarrollado con ❤️ para revolucionar las reservas de restaurantes.

---

**Status**: 🏗️ En desarrollo activo
