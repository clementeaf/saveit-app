# Guía Completa de Despliegue en AWS - SaveIt App

**Fecha:** 2025-12-19  
**Status:** ✅ LISTO PARA DESPLEGAR (con configuración manual mínima)

---

## 📋 RESUMEN EJECUTIVO

La aplicación SaveIt App está **lista para desplegarse en AWS** usando servicios gratuitos (Free Tier). Se han corregido todos los problemas críticos identificados y se ha optimizado la configuración para producción.

### Costo Estimado: ~$0.50/mes
- RDS PostgreSQL: $0 (Free Tier)
- EC2: $0 (Free Tier)
- Redis (Upstash): $0 (Free Tier)
- Secrets Manager: ~$0.40/mes
- S3 (Terraform state): $0 (Free Tier)
- DynamoDB (locks): $0 (Free Tier)

---

## ✅ PROBLEMAS CORREGIDOS

### 1. Variables de Entorno ✅
- **Antes:** `user-data.sh` creaba `DATABASE_URL`, pero código esperaba variables individuales
- **Ahora:** `user-data.sh` crea `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- **Archivo:** `terraform/modules/ec2/user-data.sh`

### 2. SSL para RDS ✅
- **Antes:** SSL deshabilitado por defecto
- **Ahora:** `DB_SSL=true` configurado automáticamente
- **Archivo:** `terraform/modules/ec2/user-data.sh`

### 3. Outputs de RDS ✅
- **Antes:** Outputs comentados
- **Ahora:** Outputs descomentados para debugging
- **Archivo:** `terraform/outputs.tf`

### 4. Dockerfile.prod ✅
- **Antes:** Sin optimizaciones, sin health checks
- **Ahora:** 
  - Multi-stage build optimizado
  - Health checks configurados
  - Usuario no-root
  - Mejor caching de layers
- **Archivo:** `Dockerfile.prod`

### 5. docker-compose.prod.yml ✅
- **Antes:** Passwords hardcoded
- **Ahora:** Usa `.env.production` file
- **Archivo:** `docker-compose.prod.yml`

### 6. GitHub Actions ✅
- **Antes:** TODOs, no implementado
- **Ahora:** 
  - Workflow de Terraform completo
  - Workflow de deployment mejorado
  - Plan/Apply automático
- **Archivos:** `.github/workflows/terraform.yml`, `.github/workflows/deploy.yml`

### 7. Backend Remoto de Terraform ✅
- **Antes:** Comentado
- **Ahora:** Script de setup automático
- **Archivo:** `terraform/scripts/setup-backend.sh`

### 8. Redis (Upstash) ✅
- **Antes:** No configurado
- **Ahora:** Documentación completa para Upstash Free Tier
- **Archivo:** `docs/UPSTASH_REDIS_SETUP.md`

---

## 🚀 PASOS PARA DESPLEGAR

### Paso 1: Configurar Upstash Redis (5 minutos)

1. Ir a https://upstash.com
2. Crear cuenta (gratis)
3. Crear Redis database
4. Copiar endpoint completo:
   ```
   redis://default:PASSWORD@ENDPOINT.upstash.io:6379
   ```

### Paso 2: Configurar Variables de Terraform

Editar `terraform/environments/dev.tfvars`:

```hcl
# Redis Configuration
redis_endpoint_url = "redis://default:TU_PASSWORD@TU_ENDPOINT.upstash.io:6379"

# SSH Key (opcional, pero recomendado)
existing_ssh_key_name = "tu-key-pair-existente"
# O crear nueva:
# create_ssh_key_pair = true
# ssh_public_key = "ssh-rsa AAAAB3..."
```

### Paso 3: Configurar Backend Remoto (Opcional pero Recomendado)

```bash
cd terraform/scripts
./setup-backend.sh saveit dev us-east-1
```

Luego descomentar backend en `terraform/main.tf`:

```hcl
backend "s3" {
  bucket         = "saveit-terraform-state-dev"
  key            = "dev/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "saveit-terraform-locks"
}
```

### Paso 4: Desplegar con Terraform

```bash
cd terraform

# Inicializar
terraform init

# Verificar plan
terraform plan -var-file="environments/dev.tfvars"

# Aplicar (crea toda la infraestructura)
terraform apply -var-file="environments/dev.tfvars"
```

**Tiempo estimado:** 10-15 minutos (RDS tarda ~10 minutos en crearse)

### Paso 5: Verificar Despliegue

```bash
# Obtener IP pública de EC2
terraform output ec2_public_ip

# Verificar health check
curl http://$(terraform output -raw ec2_public_ip)/health

# Verificar logs
terraform output ec2_ssh_connection
# Luego: ssh -i ~/.ssh/tu-key.pem ubuntu@IP
# journalctl -u saveit-app -f
```

---

## 📊 INFRAESTRUCTURA DESPLEGADA

### Recursos Creados

1. **RDS PostgreSQL**
   - Instancia: `db.t3.micro` (Free Tier)
   - Endpoint: `saveit-dev-db.xxx.rds.amazonaws.com:5432`
   - Secrets Manager: Credenciales almacenadas automáticamente

2. **EC2 Instance**
   - Tipo: `t3.micro` (Free Tier)
   - AMI: Ubuntu 22.04 LTS
   - IAM Role: Acceso a Secrets Manager
   - User-data: Configuración automática

3. **Security Groups**
   - EC2: HTTP (80), HTTPS (443), SSH (22)
   - RDS: PostgreSQL (5432) desde EC2

4. **Secrets Manager**
   - Secret: `saveit-dev-db-credentials`
   - Contiene: host, port, dbname, username, password

5. **CloudWatch**
   - Log Groups: `/aws/ec2/saveit-dev`
   - Alarms: CPU, Status Check

---

## 🔧 CONFIGURACIÓN POST-DESPLIEGUE

### 1. Ejecutar Migraciones

```bash
# SSH a EC2
ssh -i ~/.ssh/tu-key.pem ubuntu@$(terraform output -raw ec2_public_ip)

# En EC2
cd /opt/saveit-app
npm run db:migrate
npm run db:seed
```

### 2. Verificar Servicios

```bash
# Health check
curl http://$(terraform output -raw ec2_public_ip)/health

# Ver logs
journalctl -u saveit-app -f
```

### 3. Configurar Dominio (Opcional)

1. Crear registro A en Route 53 apuntando a IP de EC2
2. Configurar certificado SSL con ACM
3. Actualizar Nginx en EC2 para usar dominio

---

## 📝 ARCHIVOS IMPORTANTES

### Configuración
- `terraform/main.tf` - Configuración principal
- `terraform/environments/dev.tfvars` - Variables de desarrollo
- `terraform/modules/ec2/user-data.sh` - Script de inicialización
- `Dockerfile.prod` - Imagen de producción
- `docker-compose.prod.yml` - Orquestación (usa .env.production)

### Documentación
- `docs/VERIFICACION_AWS.md` - Checklist de verificación
- `docs/UPSTASH_REDIS_SETUP.md` - Guía de Upstash
- `docs/PROBLEMAS_DESPLIEGUE_AWS.md` - Problemas identificados y resueltos
- `terraform/README_BACKEND.md` - Configuración de backend remoto

### Scripts
- `terraform/scripts/setup-backend.sh` - Setup de S3 + DynamoDB

---

## 🧪 VERIFICACIÓN POST-DESPLIEGUE

### Checklist

- [ ] RDS está corriendo y accesible
- [ ] EC2 está corriendo y saludable
- [ ] Health check responde 200 OK
- [ ] Base de datos tiene tablas (migraciones ejecutadas)
- [ ] Redis está conectado
- [ ] Logs en CloudWatch
- [ ] Secrets Manager tiene credenciales
- [ ] Security groups correctos

### Comandos de Verificación

```bash
# Estado de Terraform
terraform output

# Estado de EC2
aws ec2 describe-instances --instance-ids $(terraform output -raw ec2_instance_id)

# Estado de RDS
aws rds describe-db-instances --db-instance-identifier saveit-dev-db

# Health check
curl http://$(terraform output -raw ec2_public_ip)/health | jq
```

---

## 🔄 ACTUALIZACIONES FUTURAS

### Para Actualizar la Aplicación

1. Hacer cambios en código
2. Push a GitHub
3. GitHub Actions ejecuta automáticamente:
   - Build
   - Terraform plan/apply
   - Verificación

### Para Actualizar Infraestructura

1. Modificar archivos en `terraform/`
2. Push a GitHub
3. GitHub Actions ejecuta Terraform automáticamente

---

## 🆘 TROUBLESHOOTING

### EC2 no inicia
- Verificar logs en CloudWatch
- Verificar user-data script
- Verificar IAM roles

### RDS no accesible
- Verificar security group permite EC2
- Verificar que RDS esté en misma VPC
- Verificar credenciales en Secrets Manager

### Aplicación no responde
- SSH a EC2 y verificar logs: `journalctl -u saveit-app -f`
- Verificar variables de entorno: `cat /opt/saveit-app/.env`
- Verificar que servicios estén corriendo: `systemctl status saveit-app`

---

## 📚 RECURSOS ADICIONALES

- [Documentación de Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Upstash Documentation](https://docs.upstash.com/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)

---

**Documento creado:** 2025-12-19  
**Última actualización:** 2025-12-19  
**Status:** ✅ COMPLETO Y LISTO PARA DESPLEGAR

