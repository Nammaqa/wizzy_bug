import mongoose, { Schema, Document } from 'mongoose';

export interface ITicketHistoryEntry {
  type: 'created' | 'status' | 'assignment' | 'priority' | 'update';
  message: string;
  actor?: mongoose.Types.ObjectId;
  actorName?: string;
  createdAt: Date;
}

export interface ITicketComment {
  author: mongoose.Types.ObjectId;
  authorName: string;
  text: string;
  createdAt: Date;
}

export interface ITicketAttachment {
  _id?: mongoose.Types.ObjectId;
  fileName: string;
  contentType: string;
  secureUrl: string;
  publicId: string;
  resourceType: string;
}

export interface ITicket extends Document {
  defectId: string;
  title: string;
  description: string;
  severity: 'Blocker(System Crash/Data Loss)' | 'Critical' | 'Major' | 'Minor' | 'Cosmetic';
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected' | 'deferred' | 'not_reproducible';
  priority: 'low' | 'medium' | 'high' | 'critical';
  project: mongoose.Types.ObjectId;
  creator: mongoose.Types.ObjectId;
  assignees?: mongoose.Types.ObjectId[];
  assignee?: mongoose.Types.ObjectId;
  screenshot?: { data: Buffer, contentType: String };
  imageUrl?: string;
  imagePublicId?: string;
  attachments: ITicketAttachment[];
  fixDescription?: string;
  environment?: string;
  moduleFeatureName?: string;
  buildAppVersion?: string;
  releaseVersion?: string;
  reproductionRate?: string;
  expectedResult?: string;
  actualResult?: string;
  defectType?: string;
  typeOfApplication?: string;
  browser?: string;
  browserVersion?: string;
  history: ITicketHistoryEntry[];
  comments: ITicketComment[];
}

const HistorySchema = new Schema<ITicketHistoryEntry>({
  type: { type: String, enum: ['created', 'status', 'assignment', 'priority', 'update'], required: true },
  message: { type: String, required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  actorName: { type: String },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const CommentSchema = new Schema<ITicketComment>({
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const AttachmentSchema = new Schema<ITicketAttachment>({
  fileName: { type: String, required: true },
  contentType: { type: String, required: true },
  secureUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  resourceType: { type: String, required: true },
});

const TicketSchema: Schema = new Schema({
  defectId: { type: String, unique: true, sparse: true, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: ['Blocker(System Crash/Data Loss)', 'Critical', 'Major', 'Minor', 'Cosmetic'], default: 'Minor' },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed', 'rejected', 'deferred', 'not_reproducible'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  assignees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  assignee: { type: Schema.Types.ObjectId, ref: 'User' },
  screenshot: { data: Buffer, contentType: String },
  imageUrl: { type: String },
  imagePublicId: { type: String },
  attachments: { type: [AttachmentSchema], default: [] },
  fixDescription: { type: String },
  environment: { type: String },
  moduleFeatureName: { type: String },
  buildAppVersion: { type: String },
  releaseVersion: { type: String },
  reproductionRate: { type: String },
  expectedResult: { type: String },
  actualResult: { type: String },
  defectType: { type: String },
  typeOfApplication: { type: String },
  browser: { type: String },
  browserVersion: { type: String },
  history: { type: [HistorySchema], default: [] },
  comments: { type: [CommentSchema], default: [] }
}, { timestamps: true });

export default mongoose.model<ITicket>('Ticket', TicketSchema);
