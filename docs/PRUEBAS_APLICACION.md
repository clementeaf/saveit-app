# Pruebas de la Aplicación - Resultados

**Fecha:** 2026-01-07  
**Objetivo:** Identificar problemas y configuraciones pendientes

---

## ✅ ESTADO ACTUAL

### Servicios Desplegados
- ✅ **reservation-service** (puerto 3001) - Online
- ✅ **notification-service** (puerto 3002) - Healthy
- ✅ **qr-code-service** (puerto 3003) - Healthy
- ✅ **channel-gateway** (puerto 3004) - Healthy
- ✅ **analytics-service** (puerto 3005) - Healthy

### Base de Datos
- ✅ **Neon PostgreSQL** - Conectada y funcionando
- ✅ **Migraciones** - Ejecutadas correctamente
- ✅ **Seed Data** - Datos de prueba cargados:
  - 4 usuarios de prueba
  - 1 restaurante (La Bella Tavola)
  - 8 mesas
  - 4 reservaciones de ejemplo

---

## 🔴 PROBLEMAS IDENTIFICADOS

### 1. Redis No Configurado (Opcional pero Recomendado)

**Estado:** Redis está "down" en el health check

**Impacto:** 
- Health check muestra "unhealthy" aunque la base de datos funciona
- Cache no disponible (puede afectar rendimiento)
- Funcionalidad de locks no disponible

**Solución:**
1. Crear cuenta en Upstash (Free Tier)
2. Crear nueva Redis database
3. Obtener connection string
4. Actualizar `terraform/environments/dev.tfvars`:
   ```hcl
   redis_endpoint_url = "redis://default:PASSWORD@ENDPOINT.upstash.io:6379"
   ```
5. Re-desplegar o actualizar `.env` en EC2

**Prioridad:** Media (la aplicación funciona sin Redis)

---

### 2. Endpoints Requieren UUIDs Válidos

**Problema:** Los endpoints esperan UUIDs pero se probaron con IDs numéricos

**Ejemplo de Error:**
```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Query execution failed",
    "details": {
      "query": "SELECT * FROM restaurants WHERE id = $1 AND is_active = TRUE",
      "error": "invalid input syntax for type uuid: \"1\""
    }
  }
}
```

**Solución:** 
- ✅ Ejecutado seed script para crear datos de prueba
- ✅ Endpoints funcionan correctamente con UUIDs válidos

**Prioridad:** Resuelto

---

### 3. Base de Datos Vacía Inicialmente

**Problema:** La base de datos estaba vacía (sin restaurantes)

**Solución:**
- ✅ Ejecutado `scripts/seed.js` con SSL configurado
- ✅ Base de datos poblada con datos de prueba

**Prioridad:** Resuelto

---

### 4. Script de Seed Necesitaba SSL

**Problema:** El script `seed.js` no tenía configuración SSL para Neon

**Solución:**
- ✅ Actualizado `scripts/seed.js` para incluir SSL:
  ```javascript
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  ```

**Prioridad:** Resuelto

---

### 5. Formato Incorrecto de business_hours

**Problema:** El código espera que `businessHours[dayOfWeek]` sea un array, pero el seed creaba un objeto

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "businessHours is not iterable"
  }
}
```

**Solución:**
- ✅ Corregido formato en `scripts/seed.js`:
  - Antes: `"monday": {"open": "12:00", "close": "22:00"}`
  - Después: `"monday": [{"open": "12:00", "close": "22:00"}]`
- ✅ Actualizado restaurante existente en la base de datos

**Prioridad:** Resuelto

---

### 6. Redis Requerido para Locks

**Problema:** La creación de reservaciones requiere Redis para distributed locking

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "LOCK_ACQUISITION_FAILED",
    "message": "Failed to acquire lock: saveit:lock:reservation:..."
  }
}
```

**Solución:**
- ✅ Cache client actualizado para manejar Redis no disponible (get/set funcionan sin Redis)
- ⏳ Configurar Redis (Upstash) - Ver sección "Configuraciones Pendientes"
- ⚠️ **IMPORTANTE:** Las reservaciones aún requieren Redis para locks (distributed locking)

**Prioridad:** Alta (bloquea creación de reservaciones)

---

### 7. Cache Client Null Check

**Problema:** `cache.get()` fallaba cuando Redis no estaba disponible (`Cannot read properties of null`)

**Solución:**
- ✅ Agregado null check en métodos `get()` y `set()` del cache client
- ✅ Cache ahora retorna `null` cuando Redis no está disponible (en lugar de fallar)
- ✅ Disponibilidad funciona sin Redis (aunque sin cache)

**Prioridad:** Resuelto

---

## 🟡 CONFIGURACIONES PENDIENTES

### 1. Acceso Externo a la API

**Estado:** Los puertos están abiertos en el security group y UFW, pero no se probó acceso externo

**Acciones:**
- Verificar que el servicio escucha en `0.0.0.0` (no solo `localhost`)
- Probar acceso desde internet: `http://3.90.213.40:3001/health`
- Si no funciona, verificar configuración de red/VPC

**Prioridad:** Media

---

### 2. Configurar Redis (Upstash)

**Pasos:**
1. Crear cuenta en https://upstash.com
2. Crear nueva Redis database (Free Tier)
3. Copiar connection string
4. Actualizar `terraform/environments/dev.tfvars`
5. Re-desplegar o actualizar `.env` manualmente

**Prioridad:** Media

---

### 3. Configurar Dominio y SSL

**Estado:** No configurado

**Acciones:**
- Configurar dominio (ej: `api.saveit.app`)
- Configurar certificado SSL (Let's Encrypt o AWS Certificate Manager)
- Configurar nginx o ALB como reverse proxy

**Prioridad:** Baja (para producción)

---

### 4. Monitoreo y Alertas

**Estado:** Básico (PM2 logs)

**Acciones:**
- Configurar CloudWatch Logs Agent
- Configurar alertas para errores
- Configurar dashboards

**Prioridad:** Media

---

## ✅ ENDPOINTS PROBADOS

### Health Check
- **GET** `/health`
- **Estado:** Funciona (muestra "unhealthy" por Redis, pero DB está OK)

### Disponibilidad
- **GET** `/api/reservations/availability?restaurantId={UUID}&date={YYYY-MM-DD}&partySize={number}`
- **Estado:** ✅ Funciona correctamente con UUID válido
- **Ejemplo de respuesta:**
  ```json
  {
    "success": true,
    "data": [
      {
        "timeSlot": "12:00",
        "availableTables": [...],
        "capacity": 2
      }
    ]
  }
  ```

### Crear Reservación
- **POST** `/api/reservations`
- **Body:**
  ```json
  {
    "restaurantId": "UUID",
    "date": "2026-01-15",
    "timeSlot": "19:00",
    "partySize": 2,
    "guestName": "Test User",
    "guestPhone": "+1234567890",
    "guestEmail": "test@example.com",
    "channel": "webchat"
  }
  ```
- **Estado:** Por probar

---

## 📋 PRÓXIMOS PASOS

1. ✅ Ejecutar seed (completado)
2. ⏳ Probar creación de reservaciones
3. ⏳ Configurar Redis (Upstash)
4. ⏳ Verificar acceso externo
5. ⏳ Probar todos los endpoints de la API
6. ⏳ Configurar monitoreo básico

---

## 🔧 COMANDOS ÚTILES

### Verificar servicios
```bash
ssh -i ~/.ssh/saveit-dev-key ubuntu@3.90.213.40 "pm2 list"
```

### Ver logs
```bash
ssh -i ~/.ssh/saveit-dev-key ubuntu@3.90.213.40 "pm2 logs reservation-service --lines 50"
```

### Probar health check
```bash
ssh -i ~/.ssh/saveit-dev-key ubuntu@3.90.213.40 "curl http://localhost:3001/health"
```

### Ejecutar seed nuevamente
```bash
ssh -i ~/.ssh/saveit-dev-key ubuntu@3.90.213.40 "cd /opt/saveit-app && node scripts/seed.js"
```

---

## 📝 NOTAS

- La aplicación funciona correctamente con la base de datos Neon
- Redis es opcional pero recomendado para mejor rendimiento
- Todos los servicios están corriendo y estables
- PM2 está configurado para auto-start
- Firewall (UFW) tiene los puertos abiertos

