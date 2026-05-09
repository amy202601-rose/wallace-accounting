# VPS Deployment Guide

This guide is for deploying Wallace Accounting on a VPS such as DigitalOcean Droplet, Hostinger VPS, Vultr, or AWS Lightsail.

The recommended VPS setup is:

- Ubuntu 24.04 LTS
- Docker Compose
- Nginx reverse proxy
- HTTPS via Certbot
- MySQL either in Docker Compose or a managed MySQL service

## 1. Server Size

Recommended starting point:

```text
2 vCPU
2-4 GB RAM
40+ GB SSD
Ubuntu 24.04 LTS
```

If MySQL runs on the same VPS, prefer 4 GB RAM.

## 2. DNS

Point your domain to the VPS public IP:

```text
A      @      <VPS_PUBLIC_IP>
CNAME  www    @
```

Wait until DNS resolves before enabling HTTPS.

## 3. Install System Packages

SSH into the VPS and run:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git nginx ufw
```

Install Docker:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Optional, allow your SSH user to run Docker:

```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 4. Clone The App

```bash
sudo mkdir -p /opt/wallace-accounting
sudo chown -R $USER:$USER /opt/wallace-accounting
git clone https://github.com/amy202601-rose/wallace-accounting.git /opt/wallace-accounting
cd /opt/wallace-accounting/wallace-accounting
```

## 5. Configure Environment

Create `.env.production`:

```bash
cp .env.example .env.production
nano .env.production
```

Required values:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://your-oauth-server
VITE_OAUTH_PORTAL_URL=https://your-oauth-portal
BUILT_IN_FORGE_API_URL=https://your-storage-proxy
BUILT_IN_FORGE_API_KEY=your-storage-api-key
```

### Option A: MySQL In Docker Compose

Use this for a simple single-VPS setup:

```env
MYSQL_DATABASE=wallace_accounting
MYSQL_USER=wallace
MYSQL_PASSWORD=replace-with-a-strong-db-password
MYSQL_ROOT_PASSWORD=replace-with-a-strong-root-password
DATABASE_URL=mysql://wallace:replace-with-a-strong-db-password@mysql:3306/wallace_accounting
```

### Option B: DigitalOcean Managed MySQL

Use this for a more production-grade database:

```env
DATABASE_URL=mysql://doadmin:password@host:25060/defaultdb?ssl={"rejectUnauthorized":true}
```

If using managed MySQL, remove the `mysql` service from `docker-compose.yml`, or leave it stopped and run only the app service with an override. The simplest path for first deployment is Option A.

## 6. OAuth Allowlist

Production authentication uses OAuth and the allowlist in `server/_core/oauth.ts`.

To allow another user, add their email or username:

```ts
const ALLOWED_IDENTIFIERS = new Set([
  "amy202601@gmail.com",
  "wallacefinancialservice@gmail.com",
  "new-user@example.com",
]);
```

The local development fallback user only works when:

- `NODE_ENV !== "production"`
- `OAUTH_SERVER_URL` is empty

It is disabled in production.

## 7. Start With Docker Compose

```bash
docker compose up -d --build
docker compose ps
```

Check health:

```bash
curl http://127.0.0.1:3000/healthz
```

Expected:

```json
{"ok":true}
```

## 8. Run Database Migrations

After the containers are running:

```bash
docker compose exec app pnpm db:push
```

## 9. Configure Nginx

Copy the template:

```bash
sudo cp deploy/nginx/wallace-accounting.conf /etc/nginx/sites-available/wallace-accounting
sudo nano /etc/nginx/sites-available/wallace-accounting
```

Replace:

```text
accounting.example.com
www.accounting.example.com
```

with your real domain.

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/wallace-accounting /etc/nginx/sites-enabled/wallace-accounting
sudo nginx -t
sudo systemctl reload nginx
```

## 10. HTTPS

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Issue certificate:

```bash
sudo certbot --nginx -d accounting.example.com -d www.accounting.example.com
```

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

## 11. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw enable
sudo ufw status
```

The app and MySQL ports are bound to `127.0.0.1` only by default.

## 12. Backups

Create a MySQL backup:

```bash
bash scripts/backup-mysql.sh
```

Backups are written to:

```text
backups/mysql/
```

Restore a backup:

```bash
bash scripts/restore-mysql.sh backups/mysql/wallace_accounting-YYYYMMDD-HHMMSS.sql.gz
```

Recommended cron job:

```bash
crontab -e
```

Add:

```cron
15 3 * * * cd /opt/wallace-accounting/wallace-accounting && bash scripts/backup-mysql.sh >> backups/mysql/backup.log 2>&1
```

Also enable VPS provider snapshots/backups. Database backups should not live only on the same VPS forever; periodically download or sync them elsewhere.

## 13. Update Deployment

```bash
cd /opt/wallace-accounting/wallace-accounting
git pull
docker compose up -d --build
docker compose exec app pnpm db:push
docker compose ps
```

## 14. Troubleshooting

View logs:

```bash
docker compose logs -f app
docker compose logs -f mysql
sudo tail -f /var/log/nginx/error.log
```

Restart:

```bash
docker compose restart app
```

Check production health:

```bash
curl https://your-domain.com/healthz
```
