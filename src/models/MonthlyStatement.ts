import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMonthlyStatement extends Document {
  _id: Types.ObjectId;
  carparkId: Types.ObjectId;
  customerId: Types.ObjectId;
  period: string;           // "2026-03"
  sessionIds: Types.ObjectId[];
  previousBalance: number;
  thisMonthTotal: number;
  payments: number;
  closingBalance: number;
  emailAddress: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt: Date | null;
  errorMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

const MonthlyStatementSchema = new Schema<IMonthlyStatement>(
  {
    carparkId: { type: Schema.Types.ObjectId, ref: 'Carpark', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    period: { type: String, required: true },
    sessionIds: [{ type: Schema.Types.ObjectId, ref: 'ParkingSession' }],
    previousBalance: { type: Number, default: 0 },
    thisMonthTotal: { type: Number, default: 0 },
    payments: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },
    emailAddress: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    sentAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

MonthlyStatementSchema.index({ carparkId: 1, period: 1 });
MonthlyStatementSchema.index({ customerId: 1, period: 1 });

const MonthlyStatement: Model<IMonthlyStatement> =
  mongoose.models.MonthlyStatement ||
  mongoose.model<IMonthlyStatement>('MonthlyStatement', MonthlyStatementSchema);

export default MonthlyStatement;
