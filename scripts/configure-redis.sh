#!/bin/bash
# Script para configurar Redis (Upstash) en la aplicación

set -e

REDIS_URL="${1}"

if [ -z "$REDIS_URL" ]; then
    echo "❌ Error: Se requiere el connection string de Redis"
    echo ""
    echo "Uso: $0 'redis://default:PASSWORD@ENDPOINT.upstash.io:6379'"
    echo ""
    echo "Para obtener el connection string:"
    echo "1. Crear cuenta en https://upstash.com"
    echo "2. Crear nueva Redis database"
    echo "3. Copiar el endpoint completo desde la página de la database"
    exit 1
fi

echo "🔧 Configurando Redis..."
echo ""

# Validar formato básico
if [[ ! "$REDIS_URL" =~ ^redis:// ]]; then
    echo "❌ Error: El connection string debe comenzar con 'redis://'"
    exit 1
fi

# Actualizar terraform/environments/dev.tfvars
echo "1. Actualizando terraform/environments/dev.tfvars..."
TFVARS_FILE="terraform/environments/dev.tfvars"

if [ -f "$TFVARS_FILE" ]; then
    # Buscar y reemplazar redis_endpoint_url
    if grep -q "redis_endpoint_url" "$TFVARS_FILE"; then
        # Usar sed para reemplazar (compatible con macOS y Linux)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|redis_endpoint_url = \".*\"|redis_endpoint_url = \"$REDIS_URL\"|" "$TFVARS_FILE"
        else
            sed -i "s|redis_endpoint_url = \".*\"|redis_endpoint_url = \"$REDIS_URL\"|" "$TFVARS_FILE"
        fi
        echo "   ✅ Actualizado redis_endpoint_url en $TFVARS_FILE"
    else
        echo "   ⚠️  No se encontró redis_endpoint_url en $TFVARS_FILE"
        echo "   Agregando manualmente..."
        echo "" >> "$TFVARS_FILE"
        echo "# Redis Configuration" >> "$TFVARS_FILE"
        echo "redis_endpoint_url = \"$REDIS_URL\"" >> "$TFVARS_FILE"
        echo "   ✅ Agregado redis_endpoint_url a $TFVARS_FILE"
    fi
else
    echo "   ❌ No se encontró $TFVARS_FILE"
    exit 1
fi

# Actualizar .env en EC2
echo ""
echo "2. Actualizando .env en servidor EC2..."

# Obtener IP del servidor desde Terraform output o usar variable de entorno
EC2_IP="${EC2_IP:-3.90.213.40}"
SSH_KEY="${SSH_KEY:-~/.ssh/saveit-dev-key}"

if [ ! -f "$SSH_KEY" ]; then
    echo "   ⚠️  No se encontró la clave SSH en $SSH_KEY"
    echo "   Configurando manualmente en el servidor..."
    echo ""
    echo "   Ejecuta en el servidor:"
    echo "   echo 'REDIS_URL=$REDIS_URL' >> /opt/saveit-app/.env"
    echo "   pm2 restart all"
else
    echo "   Conectando a $EC2_IP..."
    
    # Backup del .env actual
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ubuntu@$EC2_IP \
        "cp /opt/saveit-app/.env /opt/saveit-app/.env.backup.$(date +%Y%m%d_%H%M%S)" || true
    
    # Actualizar REDIS_URL en .env
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ubuntu@$EC2_IP << EOF
        cd /opt/saveit-app
        
        # Remover REDIS_URL existente si existe
        grep -v "^REDIS_URL=" .env > .env.tmp || true
        mv .env.tmp .env || true
        
        # Agregar nuevo REDIS_URL
        echo "REDIS_URL=$REDIS_URL" >> .env
        
        echo "✅ REDIS_URL actualizado en .env"
        echo ""
        echo "Contenido de REDIS_URL en .env:"
        grep "^REDIS_URL=" .env || echo "⚠️  REDIS_URL no encontrado"
EOF
    
    echo ""
    echo "3. Reiniciando servicios PM2..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ubuntu@$EC2_IP \
        "cd /opt/saveit-app && pm2 restart all && sleep 3 && pm2 list"
    
    echo ""
    echo "4. Verificando conexión Redis..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ubuntu@$EC2_IP \
        "curl -s http://localhost:3001/health | python3 -m json.tool 2>/dev/null | grep -A 5 redis || curl -s http://localhost:3001/health"
fi

echo ""
echo "✅ Configuración de Redis completada!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Verificar health check: curl http://$EC2_IP:3001/health"
echo "2. Verificar Redis con MCP (si está configurado)"
echo "3. Probar creación de reservación"
echo "4. (Opcional) Aplicar cambios de Terraform para persistir configuración"
echo ""
echo "💡 Tip: Puedes usar el MCP Redis para verificar la conexión:"
echo "   - El MCP Redis está configurado en ~/.cursor/mcp.json"
echo "   - Puedes pedirle a Cursor que verifique la conexión usando MCP"
echo ""

