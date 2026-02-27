# Deployment Guide - WhatsApp Web Clone (GOWA)

Panduan lengkap untuk deploy aplikasi WhatsApp Web Clone dengan GOWA integration di server Ubuntu yang baru/fresh.

## Prerequisites

Server Ubuntu 20.04/22.04/24.04 dengan:
- Minimal 2GB RAM
- 10GB free disk space
- Akses root/sudo

## Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

## Step 2: Install Node.js 20+

```bash
# Install NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify
node -v
npm -v
```

## Step 3: Install Bun

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Reload shell atau source .bashrc
source ~/.bashrc

# Verify
bun -v
```

## Step 4: Install Docker & Docker Compose

```bash
# Install Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt update
sudo apt install -y docker-ce

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker -v
docker-compose -v
```

**Logout dan login kembali** agar group docker aktif:
```bash
exit
# Login kembali via SSH
```

## Step 5: Clone Repository

```bash
# Install git jika belum ada
sudo apt install -y git

# Clone project
git clone https://github.com/your-username/whatsapp-web-clone.git
cd whatsapp-web-clone
```

## Step 6: Install Dependencies

```bash
bun install
```

## Step 7: Build Application

```bash
bun run build
```

## Step 8: Setup Environment Variables (Optional)

```bash
# Buat file .env.local jika perlu konfigurasi khusus
touch .env.local
```

Isi `.env.local` jika perlu:
```bash
# Contoh konfigurasi
NEXT_PUBLIC_APP_URL=http://your-server-ip:3001
```

## Step 9: Setup GOWA (WhatsApp Engine)

```bash
# Buat directory untuk GOWA data
mkdir -p ~/gowa-data

# Run GOWA container
docker run -d \
  --name gowa \
  -p 3000:3000 \
  -v ~/gowa-data:/app/storages \
  -e WEBHOOK_URL=http://your-server-ip:3001/api/webhook \
  --restart unless-stopped \
  aldinokemal2104/go-whatsapp-web-multidevice:latest

# Check logs
docker logs -f gowa
```

**Catatan:** Ganti `your-server-ip` dengan IP public server Anda.

## Step 10: Jalankan Aplikasi

### Option A: Development Mode
```bash
bun dev
```

### Option B: Production dengan PM2 (Recommended)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start dengan PM2
pm2 start "bun start" --name whatsapp-web

# Save PM2 config
pm2 save
pm2 startup
```

## Step 11: Setup Firewall (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (jika pakai SSL)
sudo ufw allow 443/tcp

# Allow aplikasi ports
sudo ufw allow 3000/tcp  # GOWA
sudo ufw allow 3001/tcp  # Next.js app

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Step 12: Setup Reverse Proxy dengan Nginx (Recommended)

```bash
# Install Nginx
sudo apt install -y nginx

# Buat config
sudo nano /etc/nginx/sites-available/whatsapp-web
```

Isi dengan:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Ganti dengan domain Anda

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support untuk SSE
    location /api/webhook {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

Enable config:
```bash
sudo ln -s /etc/nginx/sites-available/whatsapp-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Step 13: Setup SSL dengan Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

## Step 14: Konfigurasi GOWA Webhook

Setelah aplikasi running, akses GOWA:
```
http://your-server-ip:3000
```

1. Scan QR code untuk connect WhatsApp
2. Masuk ke menu **Settings** di aplikasi Next.js Anda
3. Set GOWA URL: `http://your-server-ip:3000` atau `http://localhost:3000` jika same server
4. Webhook akan otomatis aktif

## Maintenance Commands

### Restart Services
```bash
# Restart Next.js app
pm2 restart whatsapp-web

# Restart GOWA
docker restart gowa

# Restart Nginx
sudo systemctl restart nginx
```

### Check Logs
```bash
# Next.js logs
pm2 logs whatsapp-web

# GOWA logs
docker logs -f gowa

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Update Aplikasi
```bash
# Pull latest changes
git pull origin main

# Install new dependencies
bun install

# Rebuild
bun run build

# Restart
pm2 restart whatsapp-web
```

### Backup
```bash
# Backup GOWA data
tar -czf gowa-backup-$(date +%Y%m%d).tar.gz ~/gowa-data

# Backup ke cloud (contoh: rclone ke Google Drive)
rclone copy gowa-backup-*.tar.gz gdrive:backups/
```

## Troubleshooting

### Port sudah digunakan
```bash
# Cek port
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001

# Kill process
sudo kill -9 <PID>
```

### GOWA tidak bisa connect
```bash
# Check container status
docker ps
docker logs gowa

# Rebuild container
docker rm -f gowa
docker run -d \
  --name gowa \
  -p 3000:3000 \
  -v ~/gowa-data:/app/storages \
  -e WEBHOOK_URL=http://your-server-ip:3001/api/webhook \
  --restart unless-stopped \
  aldinokemal2104/go-whatsapp-web-multidevice:latest
```

### Permission denied
```bash
# Fix permissions
sudo chown -R $USER:$USER ~/whatsapp-web-clone
sudo chown -R $USER:$USER ~/gowa-data
```

## Port Summary

| Port | Service | Description |
|------|---------|-------------|
| 22 | SSH | Remote access |
| 80 | HTTP | Nginx (redirect ke HTTPS) |
| 443 | HTTPS | Nginx SSL |
| 3000 | GOWA | WhatsApp engine API |
| 3001 | Next.js | Aplikasi WhatsApp Web |

## Support

Jika ada masalah:
1. Check logs: `pm2 logs` dan `docker logs gowa`
2. Pastikan semua service running: `pm2 status`, `docker ps`
3. Check firewall: `sudo ufw status`
4. Test GOWA API: `curl http://localhost:3000/app/about`
