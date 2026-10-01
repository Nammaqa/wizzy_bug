import mongoose, { Schema, Document } from 'mongoose';
import { isValidUserName, normalizeUserName } from '../utils/userName';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'developer' | 'tester';
  status: 'pending' | 'active';
  emailVerified?: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiresAt?: Date;
  inviteToken?: string;
  resetToken?: string;
  resetTokenExpiresAt?: Date;
}

const UserSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 40,
    set: normalizeUserName,
    validate: { validator: isValidUserName, message: 'Name must contain letters only' },
  },
  email: { type: String, required: true, unique: true, maxlength: 254 },
  password: { type: String },
  role: { type: String, enum: ['admin', 'developer', 'tester'], default: 'developer' },
  status: { type: String, enum: ['pending', 'active'], default: 'active' },
  emailVerified: { type: Boolean },
  emailVerificationToken: { type: String },
  emailVerificationExpiresAt: { type: Date },
  inviteToken: { type: String },
  resetToken: { type: String },
  resetTokenExpiresAt: { type: Date }
}, { timestamps: true });

export default mongoose.model<IUser>('User', UserSchema);
