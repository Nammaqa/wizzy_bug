import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  key: string;
  description: string;
  status: 'active' | 'archived';
  members: mongoose.Types.ObjectId[];
  createdBy?: mongoose.Types.ObjectId;
  issueSequence: number;
}

const ProjectSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  key: { type: String, uppercase: true, trim: true },
  description: { type: String },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  issueSequence: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model<IProject>('Project', ProjectSchema);
