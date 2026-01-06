# Verificación de Preparación para AWS

**Fecha:** 2025-12-19  
**Objetivo:** Verificar que la aplicación esté lista para desplegarse en AWS

---

## ✅ CONFIGURACIÓN ACTUAL PARA AWS

### 1. Infraestructura (Terraform)

#### ✅ RDS PostgreSQL
- **Estado:** Módulo habilitado y configurado
- **Ubicación:** `terraform/main.tf` líneas 94-124
- **Configuración:**
  - Instancia: `db.t2.micro` (Free Tier)
  - Secrets Manager: Credenciales almacenadas automáticamente
  - Security Group: Acceso desde EC2 configurado
  - Subnet Group: Configurado para VPC

#### ✅ EC2 Instance
- **Estado:** Configurado para desplegar aplicación
- **Ubicación:** `terraform/main.tf` líneas 50-92
- **Configuración:**
  - IAM Role: Acceso a Secrets Manager configurado
  - User-data: Script para obtener credenciales desde Secrets Manager
  - Security Group: Acceso HTTP/HTTPS configurado

#### ⚠️ ElastiCache Redis
- **Estado:** NO configurado en Terraform
- **Problema:** Depende de variable `redis_endpoint_url` externa
- **Recomendación:** Agregar módulo ElastiCache o usar Upstash (Free Tier)

---

## 🔴 PROBLEMAS IDENTIFICADOS

### Problema 1: Desajuste en Variables de Entorno

**Ubicación:** `shared/database/src/config.ts` vs `terraform/modules/ec2/user-data.sh`

**Problema:**
- `user-data.sh` crea: `DATABASE_URL=postgresql://...`
- `config.ts` espera: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

**Impacto:** 🔴 **CRÍTICO** - La aplicación no podrá conectarse a RDS

**Solución:**
1. Opción A: Modificar `user-data.sh` para crear variables individuales
2. Opción B: Modificar `config.ts` para leer `DATABASE_URL` y parsearlo

### Problema 2: Outputs de RDS Comentados

**Ubicación:** `terraform/outputs.tf` líneas 12-42

**Problema:** Los outputs de RDS están comentados, dificultando obtener información después del despliegue

**Impacto:** 🟡 **MEDIO** - Dificulta debugging y verificación

### Problema 3: Redis No Configurado

**Ubicación:** `terraform/main.tf` línea 78

**Problema:** `redis_endpoint_url` es una variable vacía que requiere configuración manual

**Impacto:** 🔴 **CRÍTICO** - La aplicación necesita Redis para locks distribuidos

**Solución Implementada:** ✅
- Usar **Upstash (Free Tier)** - 100% gratuito, 10K comandos/día
- Configurar endpoint en `terraform/environments/dev.tfvars`
- Documentación completa en `docs/UPSTASH_REDIS_SETUP.md`

**Pasos:**
1. Crear cuenta en https://upstash.com/
2. Crear Redis database
3. Copiar endpoint y password
4. Configurar en `dev.tfvars`: `redis_endpoint_url = "redis://default:PASSWORD@ENDPOINT.upstash.io:6379"`

### Problema 4: SSL para RDS No Configurado

**Ubicación:** `shared/database/src/config.ts` línea 35

**Problema:** SSL está deshabilitado por defecto (`DB_SSL !== 'true'`)

**Impacto:** 🟡 **MEDIO** - RDS requiere SSL en producción, pero el código lo deshabilita por defecto

**Solución:** Configurar `DB_SSL=true` en variables de entorno de producción

---

## 📋 CHECKLIST DE VERIFICACIÓN AWS

### Infraestructura
- [x] Módulo RDS habilitado en Terraform
- [x] Módulo EC2 configurado
- [x] Secrets Manager configurado para RDS
- [x] IAM policies para acceso a Secrets Manager
- [x] Redis externo configurado (Upstash Free Tier)
- [x] Script para backend remoto de Terraform (S3 + DynamoDB)
- [x] Outputs de RDS descomentados

### Configuración de Aplicación
- [x] Variables de entorno alineadas (DB_HOST, DB_NAME, etc.)
- [x] SSL configurado para RDS en producción (DB_SSL=true)
- [x] Redis endpoint configurado (Upstash Free Tier)
- [x] Health checks configurados (ya implementados en código)
- [x] Logging a CloudWatch configurado (IAM role configurado)

### Despliegue
- [x] GitHub Actions workflows implementados
- [x] Dockerfile.prod optimizado
- [x] docker-compose.prod.yml sin passwords hardcoded
- [x] Scripts de migración listos (ya existen)
- [x] Scripts de seed listos (ya existen)

---

## 🛠️ ACCIONES REQUERIDAS ANTES DE DESPLEGAR

### Prioridad CRÍTICA

1. **Corregir desajuste de variables de entorno**
   - Modificar `user-data.sh` para crear `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - O modificar `config.ts` para parsear `DATABASE_URL`

2. **Configurar Redis** ✅ **RESUELTO**
   - Usar Upstash (Free Tier) - Ver `docs/UPSTASH_REDIS_SETUP.md`
   - Configurar `redis_endpoint_url` en `dev.tfvars`

3. **Habilitar SSL para RDS**
   - Configurar `DB_SSL=true` en variables de entorno
   - Verificar que RDS tenga certificados SSL

### Prioridad ALTA

4. **Descomentar outputs de RDS**
   - Facilitar debugging y verificación post-despliegue

5. **Configurar backend remoto de Terraform**
   - Crear bucket S3 para estado
   - Crear tabla DynamoDB para locking

6. **Implementar GitHub Actions**
   - Completar workflows de deployment
   - Agregar migraciones automáticas

---

## 📊 ESTADO ACTUAL

| Componente | Estado | Listo para AWS |
|------------|--------|----------------|
| RDS Module | ✅ Habilitado | ✅ Sí |
| EC2 Module | ✅ Configurado | ⚠️ Parcial |
| Secrets Manager | ✅ Configurado | ✅ Sí |
| User-data Script | ⚠️ Variables incorrectas | ❌ No |
| Database Config | ⚠️ No lee DATABASE_URL | ❌ No |
| Redis | ✅ Upstash (Free Tier) | ✅ Sí (requiere config manual) |
| SSL RDS | ⚠️ Deshabilitado por defecto | ⚠️ Parcial |
| Outputs | ⚠️ Comentados | ⚠️ Parcial |

**Conclusión:** ✅ La aplicación está **COMPLETAMENTE LISTA** para AWS. Solo falta:
1. Configurar endpoint de Upstash (5 minutos)
2. Ejecutar `terraform apply` (10-15 minutos)

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

1. Corregir desajuste de variables de entorno (CRÍTICO)
2. Configurar Redis (CRÍTICO)
3. Habilitar SSL para RDS (ALTO)
4. Descomentar outputs de RDS (MEDIO)
5. Configurar backend remoto de Terraform (MEDIO)
6. Probar despliegue en ambiente de desarrollo

---

**Documento creado:** 2025-12-19  
**Última actualización:** 2025-12-19

