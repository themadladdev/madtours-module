// ==========================================
// EMAIL SERVICE: Tour Email Templates
// server/src/services/tourEmailService.js
// ==========================================

import { config } from '../config/environment.js';
import nodemailer from 'nodemailer';

// Create reusable transporter (use existing emailService if you have one)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const FROM_EMAIL = process.env.FROM_EMAIL || 'bookings@yourdomain.com';
const COMPANY_NAME = process.env.COMPANY_NAME || 'Your Tour Company';

// Email template generator
const generateEmailHTML = (content) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1976d2; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .booking-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .reference { background: #e3f2fd; padding: 15px; text-align: center; font-size: 20px; font-weight: bold; border-radius: 8px; margin: 20px 0; }
        .button { display: inline-block; padding: 15px 30px; background: #1976d2; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        .alert { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .success { background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        ${content}
        <div class="footer">
          <p>${COMPANY_NAME}</p>
          <p>Questions? Contact us at ${FROM_EMAIL}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const sendBookingConfirmation = async (booking, customer, tourInstance, tour) => {
  const subject = `Booking Confirmed - ${tour.name}`;
  
  const content = `
    <div class="header">
      <h1>Booking Confirmed!</h1>
    </div>
    <div class="content">
      <p>Hi ${customer.first_name},</p>
      <p>Thank you for booking with ${COMPANY_NAME}! Your reservation has been confirmed.</p>
      
      <div class="reference">
        Booking Reference: ${booking.booking_reference}
      </div>
      
      <div class="booking-details">
        <h2>Tour Details</h2>
        <div class="detail-row">
          <strong>Tour:</strong>
          <span>${tour.name}</span>
        </div>
        <div class="detail-row">
          <strong>Date:</strong>
          <span>${new Date(tourInstance.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
        <div class="detail-row">
          <strong>Time:</strong>
          <span>${tourInstance.time}</span>
        </div>
        <div class="detail-row">
          <strong>Duration:</strong>
          <span>${tour.duration_minutes} minutes</span>
        </div>
        <div class="detail-row">
          <strong>Guests:</strong>
          <span>${booking.seats}</span>
        </div>
        <div class="detail-row">
          <strong>Total Paid:</strong>
          <span>$${booking.total_amount}</span>
        </div>
      </div>
      
      ${booking.special_requests ? `
        <div class="booking-details">
          <h3>Special Requests</h3>
          <p>${booking.special_requests}</p>
        </div>
      ` : ''}
      
      <div class="alert">
        <strong>Important Information:</strong>
        <ul>
          <li>Please arrive 15 minutes before departure time</li>
          <li>Bring your booking reference: <strong>${booking.booking_reference}</strong></li>
          <li>Check weather conditions before departure</li>
          <li>Wear comfortable clothing and sun protection</li>
        </ul>
      </div>
      
      <p>We look forward to seeing you!</p>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: customer.email,
    subject: subject,
    html: generateEmailHTML(content)
  });

  console.log(`✅ Confirmation email sent to ${customer.email}`);
};

export const sendBookingCancellation = async (booking, customer, tourInstance, tour, reason) => {
  const subject = `Booking Cancelled - ${tour.name}`;
  
  const content = `
    <div class="header" style="background: #d32f2f;">
      <h1>Booking Cancelled</h1>
    </div>
    <div class="content">
      <p>Hi ${customer.first_name},</p>
      <p>Your booking has been cancelled.</p>
      
      <div class="reference">
        Booking Reference: ${booking.booking_reference}
      </div>
      
      <div class="booking-details">
        <h2>Cancelled Booking Details</h2>
        <div class="detail-row">
          <strong>Tour:</strong>
          <span>${tour.name}</span>
        </div>
        <div class="detail-row">
          <strong>Date:</strong>
          <span>${new Date(tourInstance.date).toLocaleDateString()}</span>
        </div>
        <div class="detail-row">
          <strong>Time:</strong>
          <span>${tourInstance.time}</span>
        </div>
        <div class="detail-row">
          <strong>Reason:</strong>
          <span>${reason}</span>
        </div>
      </div>
      
      ${booking.refund_amount ? `
        <div class="success">
          <p><strong>Refund Processed:</strong> $${booking.refund_amount}</p>
          <p>Your refund will appear in your account within 5-10 business days.</p>
        </div>
      ` : ''}
      
      <p>If you have any questions, please don't hesitate to contact us.</p>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: customer.email,
    subject: subject,
    html: generateEmailHTML(content)
  });

  console.log(`✅ Cancellation email sent to ${customer.email}`);
};

export const sendTourCancellationNotice = async (booking, customer, tourInstance, tour, reason) => {
  const subject = `Tour Cancelled - ${tour.name} on ${new Date(tourInstance.date).toLocaleDateString()}`;
  
  const content = `
    <div class="header" style="background: #f57c00;">
      <h1>Tour Cancelled - Important Notice</h1>
    </div>
    <div class="content">
      <p>Hi ${customer.first_name},</p>
      <p>We regret to inform you that your scheduled tour has been cancelled.</p>
      
      <div class="reference">
        Booking Reference: ${booking.booking_reference}
      </div>
      
      <div class="booking-details">
        <h2>Cancelled Tour Details</h2>
        <div class="detail-row">
          <strong>Tour:</strong>
          <span>${tour.name}</span>
        </div>
        <div class="detail-row">
          <strong>Date:</strong>
          <span>${new Date(tourInstance.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
        <div class="detail-row">
          <strong>Time:</strong>
          <span>${tourInstance.time}</span>
        </div>
        <div class="detail-row">
          <strong>Reason:</strong>
          <span>${reason}</span>
        </div>
      </div>
      
      <div class="success">
        <p><strong>Full Refund Issued:</strong> $${booking.total_amount}</p>
        <p>Your refund will appear in your account within 5-10 business days.</p>
      </div>
      
      <div class="alert">
        <p><strong>Would you like to rebook?</strong></p>
        <p>Contact us to find an alternative date that works for you.</p>
      </div>
      
      <p>We sincerely apologize for any inconvenience caused.</p>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: customer.email,
    subject: subject,
    html: generateEmailHTML(content)
  });

  console.log(`✅ Tour cancellation notice sent to ${customer.email}`);
};

export const sendBookingReminder = async (booking, customer, tourInstance, tour) => {
  const subject = `Reminder: Your tour tomorrow - ${tour.name}`;
  
  const content = `
    <div class="header">
      <h1>Tour Reminder</h1>
    </div>
    <div class="content">
      <p>Hi ${customer.first_name},</p>
      <p>This is a friendly reminder about your tour tomorrow!</p>
      
      <div class="reference">
        Booking Reference: ${booking.booking_reference}
      </div>
      
      <div class="booking-details">
        <h2>Tour Details</h2>
        <div class="detail-row">
          <strong>Tour:</strong>
          <span>${tour.name}</span>
        </div>
        <div class="detail-row">
          <strong>Date:</strong>
          <span>${new Date(tourInstance.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
        <div class="detail-row">
          <strong>Time:</strong>
          <span>${tourInstance.time}</span>
        </div>
        <div class="detail-row">
          <strong>Guests:</strong>
          <span>${booking.seats}</span>
        </div>
      </div>
      
      <div class="alert">
        <strong>Pre-Departure Checklist:</strong>
        <ul>
          <li>✓ Arrive 15 minutes early</li>
          <li>✓ Bring your booking reference</li>
          <li>✓ Check weather forecast</li>
          <li>✓ Wear comfortable clothing</li>
          <li>✓ Bring sun protection (hat, sunscreen)</li>
          <li>✓ Bring water and any necessary medications</li>
        </ul>
      </div>
      
      <p>We're excited to see you tomorrow!</p>
    </div>
  `;

  await transporter.sendMail({
    from: FROM_EMAIL,
    to: customer.email,
    subject: subject,
    html: generateEmailHTML(content)
  });

  console.log(`✅ Reminder email sent to ${customer.email}`);
};