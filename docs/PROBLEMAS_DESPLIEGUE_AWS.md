# Problemas Críticos de Despliegue en AWS - Análisis y Soluciones

**Fecha:** 2025-12-19  
**Status:** 🔴 CRÍTICO - Múltiples problemas bloquean despliegue

---

## 📋 RESUMEN EJECUTIVO

Se han identificado **8 problemas críticos** que impiden el despliegue exitoso del backend en AWS:

1. ❌ Módulo RDS comentado en Terraform (no se despliega base de datos)
2. ❌ Backend remoto de Terraform deshabilitado (sin gestión de estado)
3. ❌ Rutas incorrectas en `ecosystem.config.js` (servicios no inician)
4. ❌ User-data.sh instala PostgreSQL local en lugar de usar RDS
5. ❌ Configuración de secrets vacía (db_secret_arn = "")
6. ❌ Dockerfile.prod sin optimizaciones y manejo de errores
7. ❌ docker-compose.prod.yml con passwords hardcoded
8. ❌ GitHub Actions con TODOs (deployment no implementado)

---

## 🔴 PROBLEMA 1: Módulo RDS Comentado en Terraform

### Ubicación
`terraform/main.tf` líneas 51-77

### Problema
El módulo RDS está completamente comentado, lo que significa que:
- ❌ No se crea la base de datos PostgreSQL en AWS
- ❌ El servicio de reservas no puede conectarse a la base de datos
- ❌ La infraestructura está incompleta

### Código Problemático
```terraform
# RDS PostgreSQL Module (Free Tier: db.t2.micro)
# module "rds" {
#   source = "./modules/rds"
#   ...
# }
```

### Solución
1. Descomentar el módulo RDS
2. Crear el secret de RDS en Secrets Manager
3. Configurar las variables necesarias
4. Habilitar el módulo con configuración adecuada

### Impacto
🔴 **CRÍTICO** - Sin base de datos, la aplicación no puede funcionar

---

## 🔴 PROBLEMA 2: Backend Remoto de Terraform Deshabilitado

### Ubicación
`terraform/main.tf` líneas 15-22

### Problema
El backend remoto está comentado, causando:
- ❌ Sin gestión de estado compartido
- ❌ Imposible trabajar en equipo
- ❌ Riesgo de pérdida de estado
- ❌ Sin locking de estado (conflictos en cambios simultáneos)

### Código Problemático
```terraform
# Uncomment for remote state management
# backend "s3" {
#   bucket         = "saveit-terraform-state"
#   key            = "prod/terraform.tfstate"
#   region         = "us-east-1"
#   encrypt        = true
#   dynamodb_table = "saveit-terraform-locks"
# }
```

### Solución
1. Crear bucket S3 para estado
2. Crear tabla DynamoDB para locking
3. Descomentar y configurar backend
4. Migrar estado local a remoto

### Impacto
🟡 **ALTO** - Bloquea trabajo colaborativo y producción

---

## 🔴 PROBLEMA 3: Rutas Incorrectas en ecosystem.config.js

### Ubicación
`ecosystem.config.js` líneas 5, 13, 21, 29, 37

### Problema
Las rutas de los scripts están incorrectas:
- ❌ `./services/channel-gateway/dist/services/channel-gateway/src/index.js` (incorrecto)
- ✅ Debería ser: `./services/channel-gateway/dist/index.js`

### Código Problemático
```javascript
{
  name: "channel-gateway",
  script: "./services/channel-gateway/dist/services/channel-gateway/src/index.js", // ❌ INCORRECTO
  ...
}
```

### Solución
Corregir todas las rutas según la estructura real de `dist/`:
```javascript
{
  name: "channel-gateway",
  script: "./services/channel-gateway/dist/index.js", // ✅ CORRECTO
  ...
}
```

### Impacto
🔴 **CRÍTICO** - Los servicios no pueden iniciar con PM2

---

## 🔴 PROBLEMA 4: User-data.sh Instala PostgreSQL Local

### Ubicación
`terraform/modules/ec2/user-data.sh` líneas 30-47

### Problema
El script instala PostgreSQL localmente en EC2:
- ❌ Contradice la arquitectura (debe usar RDS)
- ❌ Passwords hardcoded inseguros
- ❌ No escala (una sola instancia)
- ❌ Sin backups automáticos
- ❌ Sin alta disponibilidad

### Código Problemático
```bash
# Install PostgreSQL
echo "Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE saveit_db;"
sudo -u postgres psql -c "CREATE USER saveit_admin WITH PASSWORD 'saveit_dev_2026';" # ❌ HARDCODED
```

### Solución
1. Eliminar instalación de PostgreSQL local
2. Usar RDS desde Terraform
3. Obtener credenciales desde Secrets Manager
4. Configurar DATABASE_URL desde secret

### Impacto
🔴 **CRÍTICO** - Arquitectura incorrecta, insegura y no escalable

---

## 🔴 PROBLEMA 5: Configuración de Secrets Vacía

### Ubicación
`terraform/main.tf` línea 104

### Problema
El `db_secret_arn` está vacío:
- ❌ EC2 no puede obtener credenciales de RDS
- ❌ User-data.sh no puede configurar DATABASE_URL
- ❌ Aplicación no puede conectarse a base de datos

### Código Problemático
```terraform
module "ec2" {
  ...
  db_secret_arn = ""  # ❌ VACÍO
  ...
}
```

### Solución
1. Crear secret en Secrets Manager con credenciales de RDS
2. Pasar ARN del secret al módulo EC2
3. Actualizar IAM policy para acceso al secret
4. Verificar que user-data.sh lo use correctamente

### Impacto
🔴 **CRÍTICO** - Sin conexión a base de datos

---

## 🟡 PROBLEMA 6: Dockerfile.prod Sin Optimizaciones

### Ubicación
`Dockerfile.prod`

### Problemas Identificados
1. ❌ No usa `--legacy-peer-deps` (puede fallar en instalación)
2. ❌ No tiene healthcheck
3. ❌ No maneja variables de entorno correctamente
4. ❌ No optimiza layers de Docker
5. ❌ Copia todo el código antes de instalar (ineficiente)

### Solución
1. Agregar healthcheck
2. Optimizar orden de COPY para cache de layers
3. Usar multi-stage build más eficiente
4. Agregar validación de variables de entorno

### Impacto
🟡 **MEDIO** - Afecta eficiencia y confiabilidad

---

## 🟡 PROBLEMA 7: docker-compose.prod.yml con Passwords Hardcoded

### Ubicación
`docker-compose.prod.yml` líneas 19-20

### Problema
Passwords hardcoded en el archivo:
- ❌ Inseguro
- ❌ No usa Secrets Manager
- ❌ Expuesto en repositorio

### Código Problemático
```yaml
environment:
  - DB_PASSWORD=saveit123  # ❌ HARDCODED
```

### Solución
1. Usar variables de entorno desde Secrets Manager
2. Usar docker secrets
3. Nunca hardcodear credenciales

### Impacto
🟡 **ALTO** - Riesgo de seguridad

---

## 🟡 PROBLEMA 8: GitHub Actions con TODOs

### Ubicación
`.github/workflows/deploy.yml` líneas 76-86, 155-159

### Problema
Los workflows tienen TODOs y no están implementados:
- ❌ No hay deployment real a ECS
- ❌ No hay migraciones de base de datos
- ❌ No hay verificación de health
- ❌ No hay rollback automático

### Código Problemático
```yaml
- name: Deploy to ECS (placeholder)
  run: |
    echo "Deploying reservation service to ECS..."
    echo "TODO: Implement ECS deployment"  # ❌ NO IMPLEMENTADO
```

### Solución
1. Implementar deployment real a ECS
2. Agregar migraciones de base de datos
3. Implementar health checks
4. Agregar rollback automático en caso de fallo

### Impacto
🟡 **MEDIO** - Bloquea CI/CD automatizado

---

## 📊 PRIORIZACIÓN DE FIXES

### Prioridad CRÍTICA (Bloquean despliegue)
1. ✅ **Problema 1**: Descomentar módulo RDS
2. ✅ **Problema 3**: Corregir rutas en ecosystem.config.js
3. ✅ **Problema 4**: Eliminar PostgreSQL local, usar RDS
4. ✅ **Problema 5**: Configurar db_secret_arn

### Prioridad ALTA (Afectan producción)
5. ✅ **Problema 2**: Habilitar backend remoto de Terraform
6. ✅ **Problema 7**: Eliminar passwords hardcoded

### Prioridad MEDIA (Mejoras)
7. ✅ **Problema 6**: Optimizar Dockerfile.prod
8. ✅ **Problema 8**: Implementar GitHub Actions

---

## 🛠️ PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Fixes Críticos (Día 1)
1. Descomentar y configurar módulo RDS
2. Crear secret en Secrets Manager
3. Corregir rutas en ecosystem.config.js
4. Actualizar user-data.sh para usar RDS

### Fase 2: Configuración de Infraestructura (Día 2)
1. Crear bucket S3 para estado de Terraform
2. Crear tabla DynamoDB para locking
3. Habilitar backend remoto
4. Migrar estado local

### Fase 3: Seguridad y Optimización (Día 3)
1. Eliminar passwords hardcoded
2. Optimizar Dockerfile.prod
3. Implementar healthchecks
4. Configurar variables de entorno correctamente

### Fase 4: CI/CD (Día 4)
1. Implementar deployment a ECS
2. Agregar migraciones automáticas
3. Implementar health checks
4. Agregar rollback automático

---

## 📝 NOTAS ADICIONALES

### Arquitectura Esperada vs Actual

**Esperada (según ARQUITECTURA.md):**
- ✅ RDS PostgreSQL Multi-AZ
- ✅ ElastiCache Redis
- ✅ ECS Fargate o Lambda
- ✅ Secrets Manager para credenciales

**Actual (según código):**
- ❌ PostgreSQL local en EC2
- ❌ Redis endpoint vacío
- ❌ EC2 con Docker Compose
- ❌ Passwords hardcoded

### Recomendaciones

1. **Migrar a ECS Fargate** en lugar de EC2 + Docker Compose
   - Mejor escalabilidad
   - Gestión automática de contenedores
   - Integración nativa con ALB

2. **Usar ElastiCache Redis** en lugar de endpoint externo
   - Mejor rendimiento
   - Alta disponibilidad
   - Integración con VPC

3. **Implementar ALB** para balanceo de carga
   - Health checks automáticos
   - SSL/TLS termination
   - Routing inteligente

4. **Usar CodePipeline** para CI/CD completo
   - Integración con GitHub
   - Deployment automático
   - Rollback fácil

---

## ✅ CHECKLIST DE VERIFICACIÓN

Antes de considerar el despliegue listo, verificar:

- [ ] Módulo RDS descomentado y configurado
- [ ] Secret de RDS creado en Secrets Manager
- [ ] db_secret_arn configurado en Terraform
- [ ] Rutas en ecosystem.config.js corregidas
- [ ] User-data.sh actualizado (sin PostgreSQL local)
- [ ] Backend remoto de Terraform habilitado
- [ ] Passwords hardcoded eliminados
- [ ] Dockerfile.prod optimizado
- [ ] GitHub Actions implementado
- [ ] Health checks configurados
- [ ] Variables de entorno documentadas
- [ ] Tests de despliegue ejecutados

---

**Documento creado:** 2025-12-19  
**Próxima revisión:** Después de aplicar fixes críticos

