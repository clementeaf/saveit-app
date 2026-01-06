# Configuración de Upstash Redis (Free Tier)

**Fecha:** 2025-12-19  
**Objetivo:** Configurar Redis gratuito usando Upstash para el despliegue en AWS

---

## ¿Por qué Upstash?

- ✅ **100% Gratuito** para desarrollo y pequeñas aplicaciones
- ✅ **10,000 comandos/día** en Free Tier
- ✅ **256 MB de memoria**
- ✅ **Sin límite de tiempo** (no expira)
- ✅ **Alta disponibilidad** incluida
- ✅ **SSL/TLS** habilitado por defecto
- ✅ **Sin configuración de infraestructura** (managed service)

---

## Pasos para Configurar

### 1. Crear cuenta en Upstash

1. Ir a https://upstash.com/
2. Crear cuenta (gratis)
3. Crear un nuevo Redis database
4. Seleccionar región cercana a tu región de AWS (ej: `us-east-1`)
5. Copiar el endpoint y password

### 2. Obtener Endpoint de Upstash

En el dashboard de Upstash, después de crear la base de datos:

1. Ve a tu Redis database
2. Haz clic en "Details" o "Connect"
3. Busca la sección "Redis REST API" o "Redis Endpoint"
4. Copia el endpoint completo que incluye:
   - Protocolo: `redis://`
   - Usuario: `default`
   - Password: (tu password)
   - Host: `xxx.upstash.io`
   - Puerto: `6379`

**Formato completo:**
```
redis://default:TU_PASSWORD@TU_ENDPOINT.upstash.io:6379
```

### 3. Configurar en Terraform

Edita `terraform/environments/dev.tfvars`:

```hcl
redis_endpoint_url = "redis://default:TU_PASSWORD@TU_ENDPOINT.upstash.io:6379"
```

### 3. Configurar en user-data.sh

El script `user-data.sh` ya está configurado para usar `REDIS_URL` desde la variable `redis_endpoint`.

---

## Configuración Actual

### Variables de Terraform

El módulo EC2 ya acepta `redis_endpoint_url` como variable:

```terraform
# terraform/main.tf
module "ec2" {
  ...
  redis_endpoint = var.redis_endpoint_url
  ...
}
```

### User-data Script

El script ya configura `REDIS_URL` en el archivo `.env`:

```bash
# terraform/modules/ec2/user-data.sh
echo "REDIS_URL=${redis_endpoint}" >> /opt/saveit-app/.env
```

### Código de la Aplicación

El código ya está preparado para usar `REDIS_URL`:

```typescript
// shared/utils/src/config.ts
redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
```

---

## Ejemplo de Configuración

### 1. Obtener credenciales de Upstash

Después de crear la base de datos en Upstash, obtendrás:
- **Endpoint:** `redis-12345.upstash.io:6379`
- **Password:** `AbCdEf123456...`

### 2. Configurar en dev.tfvars

```hcl
# terraform/environments/dev.tfvars
redis_endpoint_url = "redis://default:AbCdEf123456@redis-12345.upstash.io:6379"
```

### 3. Aplicar con Terraform

```bash
cd terraform
terraform plan -var-file="environments/dev.tfvars"
terraform apply -var-file="environments/dev.tfvars"
```

---

## Límites del Free Tier

| Recurso | Límite Free Tier |
|---------|------------------|
| Comandos/día | 10,000 |
| Memoria | 256 MB |
| Bases de datos | 1 |
| Duración | Ilimitada |
| SSL/TLS | ✅ Incluido |
| Backup | ✅ Incluido |

**Nota:** Para producción con más tráfico, considerar plan de pago o migrar a ElastiCache.

---

## Verificación

Después del despliegue, verificar conexión a Redis:

```bash
# SSH a la instancia EC2
ssh ubuntu@<ec2-ip>

# Verificar variables de entorno
cat /opt/saveit-app/.env | grep REDIS

# Probar conexión (si redis-cli está instalado)
redis-cli -u $REDIS_URL ping
```

---

## Alternativa: Redis Local en EC2 (No Recomendado)

Si prefieres Redis local en EC2 (gratis pero menos confiable):

1. Modificar `user-data.sh` para instalar Redis
2. Configurar Redis local en lugar de endpoint externo
3. **Desventajas:**
   - No es persistente (se pierde al reiniciar)
   - No es escalable
   - Requiere mantenimiento manual
   - No es alta disponibilidad

**Recomendación:** Usar Upstash para desarrollo y staging, considerar ElastiCache para producción.

---

## Migración Futura a ElastiCache

Cuando necesites más capacidad, puedes migrar a ElastiCache:

1. Crear módulo ElastiCache en Terraform
2. Actualizar security groups
3. Actualizar `redis_endpoint_url` en variables
4. Aplicar cambios con Terraform

El código de la aplicación no necesita cambios, solo la configuración de infraestructura.

---

**Documento creado:** 2025-12-19

