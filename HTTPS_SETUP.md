# Configuração HTTPS para jsMyAdmin

O jsMyAdmin suporta HTTPS quando certificados SSL são fornecidos. O servidor pode rodar simultaneamente em HTTP e HTTPS.

## Configuração

Adicione as seguintes variáveis ao seu arquivo `.env`:

```bash
# Portas do servidor
PORT=3001                    # Porta HTTP (padrão: 3001)
HTTPS_PORT=3443             # Porta HTTPS (padrão: 3443)

# Certificados SSL
SSL_KEY_PATH=/path/to/private.key     # Caminho para chave privada
SSL_CERT_PATH=/path/to/certificate.crt   # Caminho para certificado
SSL_CA_PATH=/path/to/ca-bundle.crt    # Opcional: certificados intermediários
```

## Exemplo de configuração com Let's Encrypt

```bash
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
```

## Exemplo de configuração com certificados personalizados

```bash
SSL_KEY_PATH=./ssl/server.key
SSL_CERT_PATH=./ssl/server.crt
SSL_CA_PATH=./ssl/ca-bundle.crt
```

## Comportamento

- **Sem certificados SSL**: Servidor roda apenas em HTTP na porta configurada
- **Com certificados SSL válidos**: Servidor roda em HTTP E HTTPS simultaneamente
- **Com certificados SSL inválidos**: Servidor roda apenas em HTTP com aviso no log

## Testando a configuração

Após configurar os certificados, reinicie o servidor e você deve ver mensagens como:

```
HTTP Server running on port 3001
HTTP API available at http://localhost:3001/api
HTTPS Server running on port 3443
HTTPS API available at https://localhost:3443/api
```

## Resolução de problemas

### "HTTPS server failed to start"
- Verifique se os arquivos de certificado existem nos caminhos especificados
- Verifique as permissões de leitura dos arquivos
- Verifique se os certificados são válidos

### "Certificate is not trusted"
- Use certificados de uma CA confiável (como Let's Encrypt)
- Para desenvolvimento, você pode gerar certificados auto-assinados (não recomendado para produção)

### "Connection refused on HTTPS port"
- Verifique se a porta HTTPS não está sendo usada por outro serviço
- Certifique-se de que o firewall permite conexões na porta HTTPS configurada