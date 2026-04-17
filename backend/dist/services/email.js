"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = void 0;
const resend_1 = require("resend");
const resend = process.env.RESEND_API_KEY ? new resend_1.Resend(process.env.RESEND_API_KEY) : null;
const sendWelcomeEmail = async (email, name) => {
    if (!resend) {
        console.log('Email service not configured (RESEND_API_KEY not set). Skipping welcome email.');
        return;
    }
    try {
        await resend.emails.send({
            from: 'AI Stock Assistant <onboarding@resend.dev>',
            to: email,
            subject: 'Welcome to AI Stock Assistant!',
            html: `
        <h1>Welcome, ${name}!</h1>
        <p>Thank you for joining AI Stock Assistant.</p>
        <p>You can now:</p>
        <ul>
          <li>Track your inventory with AI-powered image search</li>
          <li>Manage stock levels and locations</li>
          <li>Get low-stock alerts</li>
        </ul>
        <p>Get started at: <a href="https://jhcodequest.github.io/Stock-Assistant-Web/">AI Stock Assistant</a></p>
        <br>
        <p>Best regards,<br>The AI Stock Assistant Team</p>
      `,
        });
        console.log(`Welcome email sent to ${email}`);
    }
    catch (error) {
        console.error('Failed to send welcome email:', error);
    }
};
exports.sendWelcomeEmail = sendWelcomeEmail;
//# sourceMappingURL=email.js.map