import nodemailer from 'nodemailer';

const getTransporter = () => {
  const host = process.env.EMAIL_HOST;
  console.log(`[EmailService] Attempting to connect to host: "${host}"`);
  return nodemailer.createTransport({
    host: host,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};





export const sendInvitationEmail = async (to: string, storyTitle: string, inviterName: string, storyUrl: string) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured. Skipping email send.');
    return;
  }

  const mailOptions = {
    from: `"VoxNarrative" <${process.env.EMAIL_USER}>`,
    to,
    subject: `You've been invited to collaborate on "${storyTitle}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 12px;">
        <h2 style="color: #10b981; margin-bottom: 16px;">New Story Collaboration!</h2>
        <p style="font-size: 16px; color: #374151; line-height: 1.5;">
          Hi there! <strong>${inviterName}</strong> has invited you to join their storytelling adventure: 
          <br/><br/>
          <span style="font-size: 20px; font-weight: bold; color: #111827;">"${storyTitle}"</span>
        </p>
        <p style="font-size: 16px; color: #374151; line-height: 1.5; margin-top: 24px;">
          Click the button below to start weaving the narrative together:
        </p>
        <a href="${storyUrl}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 16px;">
          Join Story
        </a>
        <p style="font-size: 14px; color: #6b7280; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          If you don't have an account yet, you'll need to register first using this email address.
        </p>
      </div>
    `,
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Invitation email sent to ${to}`);
  } catch (error) {
    console.error('Error sending invitation email:', error);
  }
};

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured. Skipping email send.');
    return;
  }

  const mailOptions = {
    from: `"VoxNarrative" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  try {
    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
