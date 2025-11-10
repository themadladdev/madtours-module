// server/src/services/emailService.js
// this a Vanilla Project file
// Load config first
import { config } from '../config/environment.js';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

// Fail-fast validation for Nodemailer SMTP config
const requiredEnvVars = {
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  FROM_EMAIL: process.env.FROM_EMAIL,
  APP_URL: process.env.APP_URL,
  // === NEW: Add new var to validation ===
  API_BASE_URL: process.env.API_BASE_URL, 
};

const missingVars = Object.keys(requiredEnvVars).filter(key => !requiredEnvVars[key]);

if (missingVars.length > 0) {
  throw new Error(`Missing required email environment variables: ${missingVars.join(', ')}`);
}

// Create a reusable Nodemailer transporter
// This transporter is configured once when the module loads
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends an email using the Nodemailer transporter.
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The email subject line.
 * @param {string} html - The HTML content of the email.
 */
export const sendEmail = async (to, subject, html) => {
  if (config.nodeEnv === 'test') {
    console.log(`[EmailService TEST]: Email suppressed. To: ${to}, Subject: ${subject}`);
    return;
  }

  const mailOptions = {
    from: `"Your Site Name" <${process.env.FROM_EMAIL}>`, // Customize 'Your Site Name'
    to: to,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    
    if (config.isDevelopment) {
      console.log(`[EmailService DEBUG]: Email sent to ${to}, Subject: ${subject}. Message ID: ${info.messageId}`);
    }
  } catch (error) {
    console.error('[EmailService Fatal]: Error sending email via Nodemailer:', error.message);
    // This will now throw a generic error that the controller will catch
    throw new Error(`Email service failed: ${error.message}`);
  }
};

/**
 * Sends the double opt-in verification email.
 * @param {string} email - Recipient email.
 * @param {string} token - The verification token.
 */
export const sendVerificationEmail = async (email, token) => {
  const subject = 'Please confirm your subscription';
  
  // === MODIFIED: Use API_BASE_URL to build the link ===
  // This link now points directly to the backend server
  const verificationLink = `${process.env.API_BASE_URL}/api/subscribers/verify?token=${token}`;
  
  // Plain B&W Vanilla template style
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
      <h2 style="font-size: 24px; color: #000; margin-top: 0;">Confirm Your Subscription</h2>
      <p style="font-size: 16px; color: #333;">Thank you for subscribing. Please click the link below to confirm your email address and activate your subscription:</p>
      <p style="margin: 25px 0;">
        <a 
          href="${verificationLink}" 
          style="display: inline-block; padding: 12px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; font-weight: 500;"
        >
          Confirm Subscription
        </a>
      </p>
      <p style="font-size: 14px; color: #555;">If you did not sign up for this, please ignore this email.</p>
      <p style="font-size: 12px; color: #888;">This link will
 expire in 24 hours.</p>
    </div>
  `;
  
  await sendEmail(email, subject, html);
};