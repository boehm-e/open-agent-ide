#!/bin/bash

set -e

echo "🚀 Open Web Agent - Setup Script"
echo "================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed (try both commands)
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Use 'docker compose' if available, fallback to 'docker-compose'
if docker compose version &> /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Ask about deployment type
echo "🌍 Deployment Configuration"
echo "   1) Local development (uses lvh.me for wildcard DNS)"
echo "   2) Production server (requires custom domain + nginx)"
echo ""
read -p "Select deployment type [1/2]: " DEPLOYMENT_TYPE

if [ "$DEPLOYMENT_TYPE" = "2" ]; then
    # Production setup
    read -p "Enter your domain (e.g., open-agent-ide.example.com): " CUSTOM_DOMAIN
    read -p "Enter the port for the web app [4004]: " WEB_PORT
    WEB_PORT=${WEB_PORT:-4004}
    read -p "Enter the port for Traefik [4006]: " TRAEFIK_PORT
    TRAEFIK_PORT=${TRAEFIK_PORT:-4006}
    
    DOMAIN=$CUSTOM_DOMAIN
    NEXTAUTH_URL="https://${CUSTOM_DOMAIN}"
    IS_PRODUCTION=true
else
    # Local development
    DOMAIN="lvh.me"
    WEB_PORT=3000
    TRAEFIK_PORT=3000
    NEXTAUTH_URL="http://lvh.me:3000"
    IS_PRODUCTION=false
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    
    # Generate a random secret
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    cat > .env << EOF
# Deployment type: $([ "$IS_PRODUCTION" = true ] && echo "Production" || echo "Local Development")
COMPOSE_PROJECT_NAME=open-agent-ide

# Ports
WEB_PORT=${WEB_PORT}
TRAEFIK_HTTP_PORT=${TRAEFIK_PORT}
TRAEFIK_HTTPS_PORT=443
TRAEFIK_DASHBOARD_PORT=8080

# App Configuration
NEXTAUTH_URL=${NEXTAUTH_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# GitHub OAuth
# Create a GitHub OAuth App at https://github.com/settings/developers
# Callback URL: ${NEXTAUTH_URL}/api/auth/callback/github
GITHUB_ID=your-github-client-id
GITHUB_SECRET=your-github-client-secret

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/open_web_agent

# Docker Configuration
DOCKER_SOCKET_PROXY=docker-socket-proxy:2375
DOCKER_HOST=unix:///var/run/docker.sock

# Domain for workspace routing
# Workspaces will be accessible at: opencode-{id}.${DOMAIN}, vscode-{id}.${DOMAIN}
DOMAIN=${DOMAIN}

# Workspace Configuration
WORKSPACE_BASE_PORT=4000
VSCODE_BASE_PORT=5000
EOF

    echo "✅ .env file created"
    echo ""
    echo "⚠️  Please edit .env file and add your GitHub OAuth credentials:"
    echo "   - GITHUB_ID"
    echo "   - GITHUB_SECRET"
    echo "   - Callback URL should be: ${NEXTAUTH_URL}/api/auth/callback/github"
    echo ""
    read -p "Press Enter when you've updated the .env file..."
else
    echo "✅ .env file already exists"
    # Load existing env for later use
    source .env
fi

echo ""

# Production nginx setup
if [ "$IS_PRODUCTION" = true ]; then
    echo "🌐 Production Server Setup"
    echo ""
    
    # Check if nginx is installed
    if command -v nginx &> /dev/null; then
        echo "✅ Nginx is installed"
        
        read -p "Would you like to generate nginx configuration? [y/N]: " GENERATE_NGINX
        if [ "$GENERATE_NGINX" = "y" ] || [ "$GENERATE_NGINX" = "Y" ]; then
            NGINX_CONF="/tmp/${DOMAIN}.nginx.conf"
            
            cat > "$NGINX_CONF" << EOF
# Main domain - Next.js app on port ${WEB_PORT}
server {
    server_name ${DOMAIN};
    
    location / {
        proxy_pass http://localhost:${WEB_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
    }

    listen 80;
}

# Wildcard subdomains - Traefik on port ${TRAEFIK_PORT}
# Requires wildcard SSL certificate for *.${DOMAIN}
server {
    server_name *.${DOMAIN};

    location / {
        proxy_pass http://localhost:${TRAEFIK_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_http_version 1.1;
    }

    listen 80;
}
EOF
            
            echo ""
            echo "📄 Nginx configuration generated at: $NGINX_CONF"
            echo ""
            echo "To install it:"
            echo "   sudo cp $NGINX_CONF /etc/nginx/sites-available/${DOMAIN}"
            echo "   sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/"
            echo "   sudo nginx -t && sudo systemctl reload nginx"
            echo ""
            echo "Then get SSL certificates:"
            echo "   # Main domain"
            echo "   sudo certbot --nginx -d ${DOMAIN}"
            echo ""
            echo "   # Wildcard (requires DNS challenge)"
            echo "   sudo certbot certonly --manual --preferred-challenges dns \\"
            echo "     --cert-name ${DOMAIN}-wildcard \\"
            echo "     -d \"*.${DOMAIN}\""
            echo ""
            echo "After getting wildcard cert, update the wildcard server block's ssl_certificate paths."
            echo ""
            read -p "Press Enter to continue..."
        fi
    else
        echo "⚠️  Nginx is not installed. You'll need to set up reverse proxy manually."
        echo ""
        echo "Required routing:"
        echo "   - ${DOMAIN} → localhost:${WEB_PORT} (Next.js app)"
        echo "   - *.${DOMAIN} → localhost:${TRAEFIK_PORT} (Traefik for workspaces)"
        echo ""
        echo "DNS requirements:"
        echo "   - A record: ${DOMAIN} → your-server-ip"
        echo "   - A record: *.${DOMAIN} → your-server-ip (wildcard)"
        echo ""
        read -p "Press Enter to continue..."
    fi
fi

echo ""

# Set permissions for Traefik acme.json
echo "🔒 Setting permissions for Traefik SSL certificates..."
mkdir -p traefik
touch traefik/acme.json
chmod 600 traefik/acme.json
echo "✅ Traefik permissions set"
echo ""

# Pull Docker images
echo "📦 Pulling Docker images..."
$COMPOSE_CMD pull
echo "✅ Docker images pulled"
echo ""

# Start infrastructure services
echo "🐳 Starting Docker services..."
$COMPOSE_CMD up -d postgres docker-socket-proxy traefik
echo "✅ Infrastructure services started"
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if $COMPOSE_CMD exec -T postgres pg_isready -U postgres -q 2>/dev/null; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 2
done
echo ""

# Build and start the web application
echo "🔨 Building web application..."
$COMPOSE_CMD build --no-cache web
echo "✅ Web application built"
echo ""

# Start the web application
echo "🌐 Starting web application..."
$COMPOSE_CMD up -d web
echo "✅ Web application started"
echo ""

# Wait for web to be ready
echo "⏳ Waiting for web container to be ready..."
sleep 10
echo ""

# Push database schema inside the web container
echo "📊 Setting up database schema..."
$COMPOSE_CMD exec -T -e HOME=/home/nextjs web npx --package=prisma@5.22.0 prisma db push --accept-data-loss --skip-generate
echo "✅ Database schema created"
echo ""

echo "✨ Setup complete!"
echo ""
if [ "$IS_PRODUCTION" = true ]; then
    echo "🎉 Your application is configured for production at:"
    echo "   - Application: https://${DOMAIN}"
    echo "   - Workspaces: https://opencode-{id}.${DOMAIN}, https://vscode-{id}.${DOMAIN}"
    echo ""
    echo "⚠️  Don't forget to:"
    echo "   1. Set up nginx configuration (see above)"
    echo "   2. Get SSL certificates (certbot)"
    echo "   3. Add DNS records for ${DOMAIN} and *.${DOMAIN}"
else
    echo "🎉 Your application is now running at:"
    echo "   - Application: http://lvh.me:${TRAEFIK_PORT}"
    echo "   - Traefik Dashboard: http://localhost:8080"
    echo ""
    echo "   Workspaces will be accessible at:"
    echo "   - http://opencode-{id}.lvh.me:${TRAEFIK_PORT}"
    echo "   - http://vscode-{id}.lvh.me:${TRAEFIK_PORT}"
fi
echo ""
echo "📝 Next steps:"
echo "   1. Make sure you've configured your GitHub OAuth app"
echo "   2. Visit ${NEXTAUTH_URL} and sign in with GitHub"
echo "   3. Create your first workspace!"
echo ""
echo "📚 For more information, see README.md"
