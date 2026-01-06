# Configuración del Backend Remoto de Terraform

Este documento explica cómo configurar el backend remoto de Terraform usando S3 y DynamoDB.

## ¿Por qué Backend Remoto?

- ✅ **Estado compartido**: Múltiples desarrolladores pueden trabajar en el mismo proyecto
- ✅ **Locking**: Previene conflictos cuando múltiples personas aplican cambios
- ✅ **Historial**: Versionado del estado de infraestructura
- ✅ **Seguridad**: Estado encriptado en S3
- ✅ **Backup**: Estado respaldado automáticamente

## Pasos para Configurar

### 1. Ejecutar Script de Setup

```bash
cd terraform/scripts
./setup-backend.sh saveit dev us-east-1
```

Este script crea:
- Bucket S3: `saveit-terraform-state-dev`
- Tabla DynamoDB: `saveit-terraform-locks`

### 2. Actualizar terraform/main.tf

Descomentar y actualizar la sección de backend:

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket         = "saveit-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "saveit-terraform-locks"
  }
}
```

### 3. Migrar Estado Local (si existe)

Si ya tienes un estado local:

```bash
cd terraform
terraform init -migrate-state
```

Terraform te preguntará si quieres migrar el estado existente. Responde `yes`.

### 4. Verificar

```bash
terraform init
terraform plan
```

Si todo está bien, verás que Terraform usa el backend remoto.

## Costos

### S3 (Free Tier)
- **Primeros 5 GB**: Gratis
- **Después**: $0.023 por GB/mes
- **Requests**: Gratis (primeros 2,000 PUT/mes)

### DynamoDB (Free Tier)
- **25 GB almacenamiento**: Gratis
- **25 unidades de capacidad**: Gratis
- **Duración**: Permanente (no expira)

**Total estimado**: $0/mes para proyectos pequeños

## Seguridad

El script configura:
- ✅ Encriptación en S3 (AES256)
- ✅ Versionado habilitado
- ✅ Bloqueo de acceso público
- ✅ Tabla DynamoDB para locking

## Troubleshooting

### Error: Bucket already exists
El bucket ya existe, probablemente de una ejecución anterior. El script continúa normalmente.

### Error: Access Denied
Verifica que tu usuario AWS tenga permisos para:
- `s3:CreateBucket`
- `s3:PutBucketVersioning`
- `s3:PutBucketEncryption`
- `dynamodb:CreateTable`

### Error: State locked
Alguien más está ejecutando Terraform. Espera o contacta al equipo.

---

**Documento creado:** 2025-12-19

