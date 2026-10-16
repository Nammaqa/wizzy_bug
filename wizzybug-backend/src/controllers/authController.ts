import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User';
import { isRealMailerConfigured, sendInviteViaMail, sendPasswordResetViaMail, sendVerificationEmailViaMail } from '../utils/mailer';
import { isValidUserName, normalizeUserName } from '../utils/userName';

const ALLOWED_ROLES = ['admin', 'developer', 'tester'];

const normalizeEmail = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : '';

const isGmailAddress = (email: string): boolean => {
  const [localPart, domain] = email.split('@');
  return email.length <= 254 && domain === 'gmail.com' && localPart.length <= 64 &&
    !localPart.includes('..') && /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?$/.test(localPart);
};

const findUserByEmail = (email: string) =>
  User.findOne({ email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });

const isStrongPassword = (password: unknown): password is string =>
  typeof password === 'string' && password.length >= 6 && password.length <= 40 &&
  /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

const exceedsUserFieldLimit = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim().length > 40;

const getFrontendUrl = (): string => {
  return process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.VITE_APP_URL || 'http://localhost:5173';
};

const generateToken = (id: string) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret')
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, password, confirmPassword, role } = req.body;
    const normalizedEmail = normalizeEmail(req.body.email);
    const normalizedName = normalizeUserName(name);

    if (!isValidUserName(normalizedName)) {
      res.status(400).json({ message: 'Name must be 2 to 40 characters and contain letters only' });
      return;
    }

    if (!isGmailAddress(normalizedEmail)) {
      res.status(400).json({ message: 'Enter a valid @gmail.com email address' });
      return;
    }

    if (!isStrongPassword(password)) {
      res.status(400).json({ message: 'Password must be 6 to 40 characters and include uppercase, lowercase, number, and special character' });
      return;
    }

    if (confirmPassword !== password) {
      res.status(400).json({ message: 'Confirm password must match password' });
      return;
    }

    if (role && !ALLOWED_ROLES.includes(role)) {
      res.status(400).json({ message: 'Role must be one of: admin, developer, tester' });
      return;
    }

    const userExists = await findUserByEmail(normalizedEmail);
    if (userExists) {
      res.status(409).json({ message: 'An account with this Gmail address already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const verificationToken = uuidv4();
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: role || 'developer',
      status: 'active',
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const verificationLink = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    try {
      await sendVerificationEmailViaMail({
        email: user.email,
        name: user.name,
        verificationLink,
      });
    } catch (mailError) {
      await User.deleteOne({ _id: user._id });
      console.error('[registerUser] Verification email could not be sent:', mailError);
      res.status(502).json({ message: 'Verification email could not be sent. Please try signing up again.' });
      return;
    }

    res.status(201).json({ message: 'Account created. Please check your email to verify your account before signing in.' });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      res.status(409).json({ message: 'An account with this Gmail address already exists' });
      return;
    }
    console.error('[registerUser]', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    if (!isGmailAddress(email) || typeof password !== 'string' || password.length < 6) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    const user = await findUserByEmail(email);

    if (user && user.emailVerified === false) {
      res.status(403).json({ message: 'Please verify your email before signing in.' });
      return;
    }

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user.id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.body.token;
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ message: 'This verification link is invalid or has expired.' });
      return;
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpiresAt: { $gt: new Date() },
      emailVerified: false,
    });
    if (!user) {
      res.status(400).json({ message: 'This verification link is invalid or has expired.' });
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('[verifyEmail]', error);
    res.status(500).json({ message: 'Unable to verify your email. Please try again.' });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = normalizeEmail(req.body.email || '');
    const user = await User.findOne({ email, status: 'active' });

    if (user) {
      const resetToken = uuidv4();
      user.resetToken = resetToken;
      user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const resetLink = `${getFrontendUrl()}/reset-password?token=${resetToken}`;
      await sendPasswordResetViaMail({ email: user.email, name: user.name, resetLink });
    }

    res.json({ message: 'If an active account exists for that email, a reset link has been sent.' });
  } catch (error) {
    console.error('[forgotPassword]', error);
    res.status(502).json({ message: 'Unable to send the password reset email. Check the mail service configuration.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || exceedsUserFieldLimit(password) || password.length < 6) {
      res.status(400).json({ message: 'A valid reset token and a password of 6 to 40 characters are required' });
      return;
    }

    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiresAt: { $gt: new Date() },
      status: 'active',
    });
    if (!user) {
      res.status(400).json({ message: 'Invalid or expired reset token' });
      return;
    }

    user.password = await bcrypt.hash(password, await bcrypt.genSalt(10));
    user.resetToken = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const inviteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, role } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = normalizeUserName(name);

    if (!isValidUserName(normalizedName) || exceedsUserFieldLimit(normalizedEmail)) {
      res.status(400).json({ message: 'Name must contain only letters; email must be 40 characters or fewer' });
      return;
    }

    if (role && !ALLOWED_ROLES.includes(role)) {
      res.status(400).json({ message: 'Role must be one of: admin, developer, tester' });
      return;
    }

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const inviteToken = uuidv4();

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      role: role || 'developer',
      status: 'pending',
      inviteToken
    });

    const frontendUrl = getFrontendUrl();
    const inviteLink = `${frontendUrl}/accept-invite?token=${inviteToken}`;

    try {
      await sendInviteViaMail({
        email: normalizedEmail,
        name: normalizedName,
        inviteLink: inviteLink
      });
    } catch (mailErr) {
      // Roll back the pending user if the email genuinely could not be sent,
      // so an admin doesn't end up with a "ghost" invite the person never received.
      const reason = mailErr instanceof Error ? mailErr.message : 'Unknown mail service error';
      console.error('[inviteUser] ❌ Failed to send invite via Mail Service:', {
        reason,
        email: normalizedEmail,
        mailServiceUrl: process.env.MAIL_SERVICE_URL,
        error: mailErr
      });
      await User.deleteOne({ _id: user._id });
      res.status(502).json({
        message: 'Invite could not be sent to Mail Service.',
        reason,
        debugging: {
          mailServiceUrl: process.env.MAIL_SERVICE_URL || 'NOT SET',
          mailServiceConfigured: Boolean(process.env.MAIL_SERVICE_URL),
        },
        hint: 'Check that MAIL_SERVICE_URL is configured in Render environment variables and the Mail Service is running.'
      });
      return;
    }

    const mailerReady = isRealMailerConfigured();
    res.status(201).json({
      message: mailerReady ? 'Invite sent' : 'Invite created, but Mail Service is not configured.',
      mailMode: mailerReady ? 'mail-service' : 'unconfigured',
      user: { name: user.name, email: user.email, role: user.role, status: user.status }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const acceptInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!isStrongPassword(password)) {
      res.status(400).json({ message: 'Password must be 6 to 40 characters and include uppercase, lowercase, number, and special character' });
      return;
    }

    const user = await User.findOne({ inviteToken: token, status: 'pending' });
    if (!user) {
      res.status(400).json({ message: 'Invalid or expired invite token' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.status = 'active';
    user.emailVerified = true;
    user.inviteToken = undefined;
    await user.save();

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user.id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
