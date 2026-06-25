import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { emails, screenshot, month } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: "emails is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!screenshot) {
      return new Response(JSON.stringify({ error: "screenshot is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    if (!SMTP_USER || !SMTP_PASS) throw new Error("SMTP credentials not configured");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    const logoUrl = "https://tumudeavgnkpwzhcxpev.supabase.co/storage/v1/object/public/email-assets/logo-capacidade.png";

    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#eceff1;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:800px;margin:0 auto;padding:32px 24px;">
    <div style="background:#ffffff;padding:24px 32px;border-radius:12px 12px 0 0;border:1px solid #cfd4d8;border-bottom:none;text-align:center;">
      <img src="${logoUrl}" alt="Capacidade de Produção" style="height:60px;width:auto;max-width:100%;object-fit:contain;display:inline-block;" />
    </div>
    <div style="background:#0a5d5a;padding:22px 32px;border-left:1px solid #0a5d5a;border-right:1px solid #0a5d5a;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.2px;">TPM - Relatório Diário de Capacidades</h1>
      <p style="margin:8px 0 0;color:#ffffff;font-size:15px;font-weight:500;opacity:0.95;">${month}</p>
    </div>
    <div style="background:#ffffff;padding:16px;border-radius:0 0 12px 12px;border:1px solid #cfd4d8;border-top:none;">
      <img src="cid:report-screenshot" alt="Relatório Gerencial - ${month}" style="width:100%;border-radius:8px;display:block;" />
    </div>
    <p style="text-align:center;color:#37474f;font-size:12px;margin-top:20px;font-weight:500;">
      Relatório gerado automaticamente pelo Sistema de Capacidade Industrial
    </p>
  </div>
</body></html>`;

    console.log(`Sending Gmail SMTP report for ${month} to ${emails.length} recipients`);

    const info = await transporter.sendMail({
      from: SMTP_USER,
      to: emails.join(", "),
      subject: `TPM - Relatório Diário de Capacidades — ${month}`,
      html: htmlBody,
      attachments: [
        {
          filename: "relatorio.png",
          content: screenshot,
          encoding: "base64",
          cid: "report-screenshot",
        },
      ],
    });

    console.log("Gmail SMTP success:", info.messageId);
    return new Response(JSON.stringify({
      success: true,
      message: `Relatório de ${month} enviado para ${emails.length} destinatário(s)`,
      recipients: emails,
      messageId: info.messageId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("send-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
