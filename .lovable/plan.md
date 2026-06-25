

## Plano: Migrar envio de e-mails para Gmail SMTP

### Resumo
Substituir o Resend pelo Gmail SMTP usando `nodemailer` na Edge Function `send-report`. Isso elimina restrições de sandbox e permite enviar para qualquer destinatário.

### Etapas

1. **Salvar credenciais SMTP como secrets**
   - `SMTP_USER` = `capacidade.leao@gmail.com`
   - `SMTP_PASS` = senha de app fornecida (`tfca kcpf euwa wlux`)

2. **Reescrever `supabase/functions/send-report/index.ts`**
   - Remover integração Resend
   - Usar `npm:nodemailer` (disponível no Deno sem instalação)
   - Configurar transporter: `smtp.gmail.com`, porta 587, `secure: false`, `requireTLS: true`
   - Manter mesma interface (recebe `emails`, `screenshot`, `month`)
   - Manter template HTML com print embutido no corpo

3. **Deploy e teste**
   - Fazer deploy da função
   - Enviar e-mail de teste para `abesilva@leaoalimentosebebidas.com.br`

### Detalhes técnicos
- **Arquivo alterado:** `supabase/functions/send-report/index.ts`
- **Secrets adicionados:** `SMTP_USER`, `SMTP_PASS`
- **Nenhuma alteração no frontend** — a chamada existente permanece idêntica

