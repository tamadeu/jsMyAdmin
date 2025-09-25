# Configuração Inicial do jsMyAdmin

## Primeiro Acesso

Quando você executar o jsMyAdmin pela primeira vez, será apresentado um **Wizard de Configuração Inicial** que irá guiá-lo através do processo de setup do sistema.

## Pré-requisitos

Antes de iniciar a configuração, certifique-se de que:

1. **MySQL Server está rodando** e acessível
2. Você tem acesso a um **usuário administrativo** (normalmente `root`) com as seguintes permissões:
   - `CREATE DATABASE`
   - `CREATE USER` 
   - `GRANT OPTION`
   - Privilégios administrativos globais

## Processo de Configuração

O wizard irá guiá-lo através de 4 etapas:

### 1. Conexão Administrativa
- Configure a conexão com o MySQL usando um usuário com privilégios administrativos
- Normalmente será o usuário `root`
- O sistema verificará se o usuário tem as permissões necessárias

### 2. Banco de Sistema
- Criação automática do banco `javascriptmyadmin_meta`
- Criação das tabelas necessárias para o funcionamento do sistema:
  - `_jsma_query_history` - Histórico de consultas
  - `_jsma_favorite_queries` - Consultas favoritas
  - `_jsma_favorite_tables` - Tabelas favoritas  
  - `_jsma_sessions` - Sessões de usuário

### 3. Usuário do Sistema
- Criação do usuário `jsmyadmin_system` (ou personalizado)
- Definição de senha segura para este usuário
- Atribuição automática dos privilégios necessários para operação do sistema

### 4. Configuração de Ambiente
- Geração automática da `SESSION_SECRET_KEY` para criptografia
- Atualização do arquivo `.env` com as configurações
- Finalização da configuração inicial

## Após a Configuração

Uma vez concluída a configuração inicial:

1. O sistema será automaticamente reiniciado
2. Você será redirecionado para a tela de login normal
3. Use suas credenciais MySQL habituais para fazer login
4. O jsMyAdmin estará pronto para uso completo

## Segurança

- O usuário `jsmyadmin_system` é usado apenas para operações internas do sistema
- Todas as senhas são criptografadas antes de serem armazenadas
- A `SESSION_SECRET_KEY` é única para cada instalação
- Recomenda-se fazer backup do arquivo `.env` após a configuração

## Solução de Problemas

### "Erro de conexão"
- Verifique se o MySQL está rodando
- Confirme host, porta, usuário e senha
- Certifique-se de que não há firewall bloqueando a conexão

### "Privilégios insuficientes"  
- O usuário deve ter privilégios administrativos
- Tente usar o usuário `root` ou outro com `ALL PRIVILEGES`
- Verifique com `SHOW GRANTS FOR 'usuario'@'host'`

### "Erro ao criar banco/usuário"
- Verifique os logs do MySQL para detalhes específicos
- Certifique-se de que o usuário administrativo tem `CREATE DATABASE` e `CREATE USER`
- Verifique se não há conflitos de nomes com bancos/usuários existentes

## Reconfiguração

Para reconfigurar o sistema:
1. Apague ou renomeie o arquivo `.env`
2. Remova o banco `javascriptmyadmin_meta` (se desejado)
3. Reinicie o servidor
4. O wizard será apresentado novamente no próximo acesso