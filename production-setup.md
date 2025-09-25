# Setup de Produção - jsmyadmin.kobbo.com.br

## Problema atual

O servidor estava rodando apenas em HTTP na porta 3001, mas estava sendo acessado via HTTPS, causando erro de certificado.

## ✅ Solução implementada

O sistema agora suporta:
1. **Detecção automática de porta** baseada na URL atual
2. **Configuração via variável de ambiente** no frontend
3. **Suporte a HTTP e HTTPS simultâneo** no backend

## Configurações

### Opção 1: Configurar HTTPS no servidor Node.js (Recomendado)

1. **Obter certificados SSL** (ex: Let's Encrypt):
```bash
# Instalar certbot
sudo apt update
sudo apt install certbot

# Obter certificado para seu domínio
sudo certbot certonly --standalone -d jsmyadmin.kobbo.com.br
```

2. **Configurar variáveis de ambiente do backend** no `.env`:
```bash
PORT=3001
HTTPS_PORT=443
SSL_KEY_PATH=/etc/letsencrypt/live/jsmyadmin.kobbo.com.br/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/jsmyadmin.kobbo.com.br/fullchain.pem
```

3. **Configurar variável de ambiente do frontend** no `.env.local`:
```bash
# Para produção com HTTPS na porta 443
VITE_API_URL=https://jsmyadmin.kobbo.com.br/api

# OU para HTTPS em porta customizada
VITE_API_URL=https://jsmyadmin.kobbo.com.br:3443/api
```

4. **Reiniciar o servidor e rebuild do frontend**

### Opção 2: Usar proxy reverso (Nginx/Apache)

Configure um proxy reverso que gerencia SSL e redireciona para o servidor Node.js:

**Nginx config:**
```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name jsmyadmin.kobbo.com.br;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Frontend config** no `.env.local`:
```bash
# Para proxy reverso (sem porta específica)
VITE_API_URL=https://jsmyadmin.kobbo.com.br/api
```

### Opção 3: Usar apenas HTTP (desenvolvimento apenas)

Se for apenas para desenvolvimento, mude as URLs para usar HTTP:
```bash
# .env.local
VITE_API_URL=http://jsmyadmin.kobbo.com.br:3001/api
```

## Detecção automática

Se você não configurar `VITE_API_URL`, o sistema automaticamente detecta:

- **Frontend em http://localhost:8080** → API em `http://localhost:3001`
- **Frontend em https://localhost:8080** → API em `https://localhost:3443`
- **Frontend em https://jsmyadmin.kobbo.com.br** → API em `https://jsmyadmin.kobbo.com.br:443`
- **Frontend em https://jsmyadmin.kobbo.com.br:8080** → API em `https://jsmyadmin.kobbo.com.br:8080`

## Recomendação para produção

Para produção, recomendo usar **Let's Encrypt** com configuração explícita:

```bash
# 1. Instalar certbot
sudo apt install certbot

# 2. Obter certificado
sudo certbot certonly --standalone -d jsmyadmin.kobbo.com.br

# 3. Configurar renovação automática
sudo crontab -e
# Adicionar linha:
0 12 * * * /usr/bin/certbot renew --quiet

# 4. Configurar backend (.env)
echo "SSL_KEY_PATH=/etc/letsencrypt/live/jsmyadmin.kobbo.com.br/privkey.pem" >> .env
echo "SSL_CERT_PATH=/etc/letsencrypt/live/jsmyadmin.kobbo.com.br/fullchain.pem" >> .env
echo "HTTPS_PORT=443" >> .env

# 5. Configurar frontend (.env.local)
echo "VITE_API_URL=https://jsmyadmin.kobbo.com.br/api" > .env.local

# 6. Rebuild frontend
npm run build

# 7. Reiniciar servidor
npm run server
```

## Verificação

Depois da configuração, você deve conseguir acessar:
- HTTP: `http://jsmyadmin.kobbo.com.br:3001`
- HTTPS: `https://jsmyadmin.kobbo.com.br` (porta 443)

E o console do navegador deve mostrar:
```
API Service initialized with baseUrl: https://jsmyadmin.kobbo.com.br/api
```