# SaveIt App - Sistema de Reservas Multi-Canal

## 🎯 Resumen Ejecutivo

SaveIt es un sistema de gestión de reservas de restaurantes en tiempo real con soporte multi-canal (WhatsApp, Instagram, WebChat, Email) construido en AWS con garantías de:

- ✅ **CERO dobles reservas** - Locks distribuidos + Transacciones ACID
- ✅ **Sincronización en tiempo real** - < 1 segundo entre todos los canales
- ✅ **Alta disponibilidad** - 99.9% uptime con Multi-AZ
- ✅ **Escalabilidad horizontal** - Soporta > 10,000 reservas concurrentes
- ✅ **Seguridad end-to-end** - Cifrado, QR firmados, Rate limiting

---

## 📚 Documentación Completa

### 1. [ARQUITECTURA.md](./ARQUITECTURA.md)
**Arquitectura AWS completa del sistema**

Contenido:
- Servicios AWS utilizados (Lambda, ECS, RDS, ElastiCache, EventBridge, etc.)
- Diagrama de arquitectura de alto nivel
- Flujo detallado de reservas desde chatbot hasta check-in
- Stack tecnológico completo
- Estrategias de escalabilidad y performance
- Disaster recovery y alta disponibilidad
- Estimación de costos (~ $2,000-2,500/mes inicial)
- Roadmap de implementación (20 semanas, 3 fases)

**Cuándo leer**: Para entender la arquitectura general del sistema y servicios AWS.

---

### 2. [GARANTIAS_SINCRONIZACION.md](./GARANTIAS_SINCRONIZACION.md)
**Mecanismos críticos que garantizan sincronización atómica**

Contenido:
- Sistema de locks distribuidos con Redis (SETNX atómico)
- Transacciones ACID con aislamiento SERIALIZABLE
- Validaciones estrictas multi-nivel
- Manejo de errores y rollback automático
- Circuit breakers para resiliencia
- Monitoreo en tiempo real y alertas
- Tests de concurrencia (100+ threads simultáneos)
- SLA y compensaciones

**Cuándo leer**: Para entender cómo se previenen dobles reservas y se garantiza consistencia.

**Principio fundamental**: 
> Solo UNA operación puede adquirir el lock por mesa/horario. Si falla después del lock, rollback automático. CERO tolerancia a inconsistencias.

---

### 3. [SINCRONIZACION_MULTICANAL.md](./SINCRONIZACION_MULTICANAL.md)
**Arquitectura unificada de canales de comunicación**

Contenido:
- Capa de abstracción `UnifiedMessage` para todos los canales
- Channel Gateway Service (punto único de entrada)
- Adaptadores por canal (WhatsApp, Instagram, WebChat, Email)
- Identidad unificada del usuario entre canales
- Estado de conversación compartido (Redis + PostgreSQL)
- Broadcast multi-canal de notificaciones
- Sincronización de disponibilidad en tiempo real
- Tests cross-channel

**Cuándo leer**: Para entender cómo diferentes canales convergen en una sola fuente de verdad.

**Garantía clave**:
> Usuario puede reservar por WhatsApp, consultar por Instagram y cancelar por WebChat. Todo sincronizado en < 1 segundo.

---

### 4. [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
**Esquema completo de PostgreSQL 15**

Contenido:
- 10 tablas principales con relaciones
- ERD (diagrama entidad-relación)
- Índices compuestos optimizados
- Particionamiento de reservas por mes
- Triggers y funciones PL/pgSQL
- Vistas útiles para disponibilidad y analytics
- Row Level Security (RLS)
- Queries de ejemplo
- Scripts de mantenimiento y backup

**Cuándo leer**: Para entender el modelo de datos y optimizaciones de base de datos.

**Índice crítico**:
```sql
CREATE UNIQUE INDEX idx_reservations_unique_slot 
ON reservations(table_id, date, time_slot)
WHERE status IN ('confirmed', 'checked_in', 'pending');
```
> Previene dobles reservas a nivel de base de datos.

---

### 5. [TERRAFORM_STRUCTURE.md](./TERRAFORM_STRUCTURE.md)
**Infraestructura como código (IaC)**

Contenido:
- Estructura de directorios de Terraform
- Módulos reutilizables (VPC, RDS, ElastiCache, ECS, Lambda, etc.)
- Configuración de backend (S3 + DynamoDB)
- Ejemplos completos de módulos VPC, RDS y ElastiCache
- Scripts de automatización (init, plan, apply)
- Mejores prácticas de IaC
- Configuración por ambiente (dev, staging, prod)

**Cuándo leer**: Para deployar y gestionar la infraestructura AWS.

**Ventaja**:
> Infraestructura versionada, reproducible y auditable. Un comando para levantar todo el stack.

---

### 6. [TESTING_STRATEGY.md](./TESTING_STRATEGY.md)
**Estrategia completa de testing**

Contenido:
- Pirámide de testing (50% unit, 30% component, 15% integration, 5% E2E)
- Tests de locks distribuidos
- Tests de concurrencia (prevención de dobles reservas)
- Tests multi-canal E2E
- Tests de QR code flow completo
- Performance tests (load, stress)
- Chaos engineering (resiliencia ante fallos)
- Security tests (SQL injection, rate limiting, QR tampering)
- CI/CD pipeline con GitHub Actions

**Cuándo leer**: Para entender cómo se valida que el sistema funciona correctamente.

**Métricas objetivo**:
- 85% code coverage general
- 100% critical path coverage
- < 1% flaky tests
- P95 latency < 500ms

---

## 🏗️ Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────┐
│                    CANALES DE ENTRADA                        │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ WhatsApp │Instagram │ WebChat  │  Email   │      SMS        │
└─────┬────┴─────┬────┴─────┬────┴─────┬────┴────┬────────────┘
      │          │          │          │         │
      └──────────┴──────────┴──────────┴─────────┘
                          │
            ┌─────────────▼──────────────┐
            │   CHANNEL GATEWAY          │
            │  (Normalización unificada) │
            └─────────────┬──────────────┘
                          │
            ┌─────────────▼──────────────┐
            │  RESERVATION PROCESSOR     │
            │  (Canal-agnóstico)         │
            └─────────────┬──────────────┘
                          │
            ┌─────────────┼──────────────┐
            │             │              │
      ┌─────▼──────┐ ┌───▼────┐  ┌─────▼──────┐
      │Redis Locks │ │   RDS  │  │   Redis    │
      │(SETNX)     │ │(Postgres)│ │   Cache    │
      └────────────┘ └────────┘  └────────────┘
                          │
            ┌─────────────▼──────────────┐
            │    EventBridge Events      │
            └─────────────┬──────────────┘
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
┌─────▼──────┐  ┌─────────▼──────┐  ┌───────▼────────┐
│QR Generator│  │   Notifier     │  │   Analytics    │
└────────────┘  └────────────────┘  └────────────────┘
```

---

## 🔒 Garantías del Sistema

### 1. Sincronización Atómica

```typescript
// Flujo garantizado:
1. Lock en Redis (SETNX) → Solo UNO puede adquirirlo
2. Validaciones (reglas, disponibilidad, usuario)
3. Transacción ACID en PostgreSQL (SERIALIZABLE)
4. Commit exitoso
5. Publicar evento
6. Invalidar cache
7. Liberar lock

// Si falla en CUALQUIER paso → Rollback automático
```

**Resultado**: CERO posibilidad de doble reserva.

### 2. Multi-Canal

- Mismo lock para WhatsApp, Instagram, WebChat, Email
- Misma base de datos para todos
- Cache compartido
- Broadcast universal de cambios

**Resultado**: Sincronización perfecta entre canales.

### 3. Performance

- P95 latency: < 500ms
- P99 latency: < 1000ms
- Throughput: > 10,000 req/s
- Cache TTL: 30 segundos

**Resultado**: Experiencia rápida para usuarios.

### 4. Disponibilidad

- Multi-AZ deployment (RDS, ElastiCache, ECS)
- Auto-scaling horizontal
- Circuit breakers
- Graceful degradation

**Resultado**: 99.9% uptime.

---

## 🚀 Quick Start

### Prerequisitos

- AWS Account con permisos de administrador
- Terraform >= 1.6.0
- Node.js 20.x
- PostgreSQL 15
- Redis 7

### Setup Infraestructura

```bash
# 1. Clonar repositorio
cd saveit-app/terraform

# 2. Inicializar Terraform
./scripts/init.sh prod

# 3. Revisar plan
./scripts/plan.sh prod

# 4. Aplicar infraestructura
./scripts/apply.sh prod

# 5. Aplicar migraciones de base de datos
npm run migrate:prod
```

### Setup Aplicación

```bash
# 1. Instalar dependencias
npm ci

# 2. Configurar variables de entorno
cp .env.example .env.prod
# Editar .env.prod con valores de AWS

# 3. Build
npm run build

# 4. Deploy servicios
npm run deploy:prod

# 5. Verificar health checks
npm run health-check:prod
```

### Verificación

```bash
# Test E2E básico
npm run test:e2e:smoke

# Verificar métricas en CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace SaveIt/Reservations \
  --metric-name reservation.created \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

---

## 📊 Métricas Clave

### Métricas Técnicas

| Métrica | Objetivo | Crítico |
|---------|----------|---------|
| API Latency P95 | < 500ms | < 1000ms |
| API Latency P99 | < 1000ms | < 2000ms |
| System Uptime | 99.9% | 99.5% |
| Error Rate | < 0.1% | < 1% |
| Lock Acquisition Time | < 10ms | < 50ms |
| DB Transaction Time P95 | < 100ms | < 500ms |

### Métricas de Negocio

| Métrica | Objetivo |
|---------|----------|
| Reservation Success Rate | > 95% |
| No-Show Rate | < 10% |
| Customer Satisfaction | > 4.5/5 |
| Average Response Time (Chatbot) | < 5s |
| Conversion Rate (inquiry → booking) | > 60% |

---

## 🧪 Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
npm run test:performance

# Todos los tests
npm test

# Coverage report
npm run test:coverage
```

**Target**: 85% coverage | 100% critical paths

---

## 🔐 Seguridad

### Implementado

- ✅ Encryption at rest (RDS, S3, ElastiCache)
- ✅ Encryption in transit (TLS 1.3)
- ✅ IAM roles con least privilege
- ✅ Secrets Manager para credenciales
- ✅ WAF para protección DDoS
- ✅ Rate limiting (Redis)
- ✅ QR codes firmados con HMAC-SHA256
- ✅ Input validation estricta
- ✅ SQL injection prevention
- ✅ Row Level Security (RLS) en PostgreSQL

### Auditoría

- Todos los cambios en `reservation_logs`
- CloudTrail para acciones AWS
- CloudWatch Logs centralizados
- X-Ray para tracing distribuido

---

## 📈 Escalabilidad

### Horizontal

- **ECS Fargate**: Auto-scaling basado en CPU/Memory
- **Lambda**: Concurrency automática
- **RDS**: Read replicas + RDS Proxy
- **ElastiCache**: Cluster mode con sharding
- **API Gateway**: Throttling configurable

### Vertical

- RDS: Hasta `db.r6g.8xlarge` (256 GB RAM)
- ElastiCache: Hasta `cache.r6g.4xlarge` (128 GB RAM)

### Costos Estimados

| Escala | Reservas/día | Costo/mes |
|--------|--------------|-----------|
| Inicial | 1,000-5,000 | $2,000-2,500 |
| Mediano | 10,000-50,000 | $5,000-8,000 |
| Grande | 100,000+ | $15,000-25,000 |

---

## 🔧 Troubleshooting

### Issue: Doble reserva detectada

```bash
# 1. Verificar alarma en CloudWatch
aws cloudwatch describe-alarms --alarm-names DoubleBookingDetected

# 2. Revisar logs
aws logs filter-log-events \
  --log-group-name /aws/ecs/reservation-service \
  --filter-pattern "DoubleBookingError"

# 3. Verificar lock en Redis
redis-cli GET "lock:reservation:{restaurantId}:{date}:{time}:{table}"

# 4. Verificar constraint en DB
psql -d saveit -c "SELECT * FROM reservations WHERE table_id = '...' AND date = '...' AND time_slot = '...'"
```

### Issue: Alta latencia

```bash
# 1. Verificar métricas
aws cloudwatch get-metric-statistics \
  --namespace SaveIt/Reservations \
  --metric-name reservation.db.transaction.duration_ms \
  --statistics Average,p99

# 2. Analizar queries lentas
psql -d saveit -c "SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10"

# 3. Verificar cache hit rate
redis-cli INFO stats | grep keyspace_hits
```

### Issue: Redis failure

Sistema debe degradar gracefully:
- Requests fallan con `503 Service Unavailable`
- Circuit breaker abre
- Logs indican `REDIS_UNAVAILABLE`
- Recuperación automática cuando Redis vuelve

---

## 🤝 Contribución

### Workflow

1. Fork del repositorio
2. Crear branch: `git checkout -b feature/mi-feature`
3. Escribir tests PRIMERO (TDD)
4. Implementar feature
5. Todos los tests deben pasar: `npm test`
6. Coverage > 85%: `npm run test:coverage`
7. Commit: `git commit -m "feat: descripción"`
8. Push: `git push origin feature/mi-feature`
9. Crear Pull Request
10. Code review + CI/CD checks
11. Merge

### Commits Convencionales

```
feat: nueva funcionalidad
fix: corrección de bug
refactor: refactorización sin cambio de comportamiento
test: agregar o modificar tests
docs: cambios en documentación
perf: mejoras de performance
chore: tareas de mantenimiento
```

---

## 📞 Soporte

### Canales

- **Documentación**: Este README y documentos vinculados
- **Issues**: GitHub Issues para bugs y features
- **Slack**: Canal #saveit-dev (interno)
- **Email**: engineering@saveit.com
- **PagerDuty**: Para incidentes P0/P1

### SLA de Respuesta

| Prioridad | Descripción | Tiempo de Respuesta |
|-----------|-------------|---------------------|
| P0 - Critical | Sistema caído, doble reserva | < 15 minutos |
| P1 - High | Degradación significativa | < 1 hora |
| P2 - Medium | Bug que afecta algunos usuarios | < 4 horas |
| P3 - Low | Mejoras, features no críticos | < 1 día |

---

## 📝 Licencia

Copyright © 2025 SaveIt App  
All rights reserved.

---

## 🎓 Recursos Adicionales

### AWS Documentation
- [Amazon RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [ElastiCache Redis Best Practices](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/BestPractices.html)
- [ECS Best Practices Guide](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)

### Papers & Articles
- [Distributed Locks with Redis](https://redis.io/docs/manual/patterns/distributed-locks/)
- [ACID Transactions in PostgreSQL](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [Event-Driven Architecture](https://aws.amazon.com/event-driven-architecture/)

### Tutoriales Internos
- `docs/tutorials/adding-new-channel.md`
- `docs/tutorials/database-migration.md`
- `docs/tutorials/monitoring-setup.md`

---

## 🗺️ Roadmap

### Q1 2025
- ✅ MVP con WhatsApp
- ✅ Arquitectura base en AWS
- ✅ Sistema de locks distribuidos
- ⏳ Instagram integration
- ⏳ WebChat widget

### Q2 2025
- Email reservations
- SMS notifications
- Analytics dashboard (QuickSight)
- Mobile apps (iOS/Android)

### Q3 2025
- AI-powered recommendations
- Dynamic pricing
- Multi-region deployment
- Advanced analytics con ML

### Q4 2025
- Voice reservations (Alexa, Google Assistant)
- Loyalty program
- API pública para partners
- Marketplace de restaurants

---

## ✅ Checklist de Producción

Antes de lanzar a producción, verificar:

- [ ] Todos los tests pasan (unit, integration, E2E)
- [ ] Coverage > 85%
- [ ] Load testing completado (10K+ req/s)
- [ ] Chaos engineering tests passed
- [ ] Security audit completado
- [ ] Monitoring y alertas configuradas
- [ ] Runbooks documentados
- [ ] Backups automáticos configurados
- [ ] Disaster recovery plan testeado
- [ ] On-call rotation definida
- [ ] Documentación actualizada
- [ ] SLAs definidos y comunicados
- [ ] Rollback plan preparado

---

**Versión**: 1.0.0  
**Última actualización**: 2025-12-19  
**Mantenedores**: Engineering Team  
**Status**: 🚧 En Desarrollo
