# Configurar Redis con MCP

**Fecha:** 2026-01-07  
**Objetivo:** Configurar Redis (Upstash) y agregar MCP Redis para verificación

---

## 1. Configurar MCP Redis (Opcional pero Recomendado)

El MCP Redis permite verificar la conexión y ejecutar comandos Redis directamente desde Cursor.

### Agregar a `~/.cursor/mcp.json`

Agrega la siguiente configuración al archivo `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    // ... tus otros servidores MCP ...
    "redis": {
      "command": "uvx",
      "args": [
        "--from",
        "redis-mcp-server@latest",
        "redis-mcp-server",
        "--url",
        "${REDIS_URL}"
      ],
      "env": {
        "REDIS_URL": "${REDIS_URL}"
      }
    }
  }
}
```

**Nota:** Necesitarás establecer la variable de entorno `REDIS_URL` antes de usar MCP Redis, o puedes usar el connection string directamente en `--url`.

### Alternativa: Usar connection string directo

Si prefieres no usar variables de entorno, puedes poner el connection string directamente:

```json
{
  "mcpServers": {
    "redis": {
      "command": "uvx",
      "args": [
        "--from",
        "redis-mcp-server@latest",
        "redis-mcp-server",
        "--url",
        "redis://default:PASSWORD@ENDPOINT.upstash.io:6379"
      ]
    }
  }
}
```

**⚠️ Seguridad:** No commitees el `mcp.json` con passwords en texto plano. Usa variables de entorno o un gestor de secretos.

---

## 2. Obtener Connection String de Upstash

### Pasos:

1. **Crear cuenta en Upstash:**
   - Ir a https://upstash.com
   - Crear cuenta (gratis)

2. **Crear Redis Database:**
   - Dashboard > Create Database
   - Nombre: `saveit-dev` (o el que prefieras)
   - Región: `us-east-1` (o la más cercana a tu región de AWS)
   - Tipo: `Regional` (Free Tier)
   - Click "Create"

3. **Obtener Connection String:**
   - En la página de la database, buscar sección "REST API" o "Redis Endpoint"
   - Copiar el endpoint completo
   - Formato: `redis://default:PASSWORD@ENDPOINT.upstash.io:6379`

### Ejemplo de Connection String:

```
redis://default:AbCdEf123456@redis-12345.upstash.io:6379
```

---

## 3. Configurar en la Aplicación

Una vez tengas el connection string, ejecuta:

```bash
./scripts/configure-redis.sh 'redis://default:PASSWORD@ENDPOINT.upstash.io:6379'
```

Este script:
- ✅ Actualiza `terraform/environments/dev.tfvars`
- ✅ Actualiza `.env` en el servidor EC2
- ✅ Reinicia los servicios PM2
- ✅ Verifica la conexión

---

## 4. Verificar con MCP Redis

Una vez configurado, puedes usar MCP Redis para verificar:

1. **Ping Redis:**
   - Pedirle a Cursor: "Verifica la conexión Redis usando MCP"
   - O: "Ejecuta PING en Redis usando MCP"

2. **Verificar keys:**
   - "Lista todas las keys en Redis usando MCP"
   - "Busca keys que empiecen con 'saveit:' usando MCP"

3. **Verificar locks:**
   - "Verifica si hay locks activos en Redis usando MCP"

---

## 5. Verificar en la Aplicación

### Health Check:

```bash
curl http://3.90.213.40:3001/health
```

Debería mostrar:
```json
{
  "status": "healthy",
  "dependencies": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"  // ✅ Ahora debería estar "up"
    }
  }
}
```

### Probar Creación de Reservación:

```bash
curl -X POST http://3.90.213.40:3001/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "UUID_DEL_RESTAURANTE",
    "date": "2026-01-15",
    "timeSlot": "19:00",
    "partySize": 2,
    "guestName": "Test User",
    "guestPhone": "+1234567890",
    "guestEmail": "test@example.com",
    "channel": "webchat"
  }'
```

---

## Referencias

- [Upstash Redis](https://upstash.com)
- [MCP Redis Server](https://github.com/redis/mcp-redis)
- [Documentación MCP Redis](https://redis.io/docs/latest/integrate/redis-mcp/)

---

**Documento creado:** 2026-01-07

