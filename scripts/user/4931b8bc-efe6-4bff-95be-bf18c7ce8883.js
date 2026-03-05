#!/usr/bin/env node
/**
 * Script de exemplo: Enviar Email
 * 
 * Envia um email usando SMTP (Gmail, Outlook, etc.)
 * 
 * Variáveis de ambiente necessárias:
 * - SMTP_HOST: servidor SMTP (ex: smtp.gmail.com)
 * - SMTP_PORT: porta (ex: 587)
 * - SMTP_USER: usuário do email
 * - SMTP_PASS: senha ou app password
 * - EMAIL_FROM: remetente
 * - EMAIL_TO: destinatário
 */

const nodemailer = require('nodemailer');

// Configuração do transportador SMTP
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true para porta 465, false para outras portas
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Parâmetros do email
const mailOptions = {
  from: process.env.EMAIL_FROM || process.env.SMTP_USER,
  to: process.env.EMAIL_TO || process.env.SMTP_USER,
  subject: process.env.EMAIL_SUBJECT || 'Notificação automática - Fatia Rápida',
  text: process.env.EMAIL_BODY || 'Este é um email automático enviado pelo sistema Fatia Rápida.',
  html: process.env.EMAIL_HTML || '<p>Este é um email automático enviado pelo sistema <strong>Fatia Rápida</strong>.</p>',
};

// Enviar email
async function enviarEmail() {
  try {
    console.log('��� Enviando email...');
    console.log(`Para: ${mailOptions.to}`);
    console.log(`Assunto: ${mailOptions.subject}`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado com sucesso!');
    console.log(`ID da mensagem: ${info.messageId}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error.message);
    process.exit(1);
  }
}

// Validar configuração
if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.error('❌ Erro: Configure as variáveis SMTP_USER e SMTP_PASS');
  process.exit(1);
}

enviarEmail();
