import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  carparkId: Types.ObjectId;
  customerId: Types.ObjectId;
  sessionId: Types.ObjectId | null;
  statementId: Types.ObjectId | null;
  amount: number;
  method: 'cash' | 'eftpos' | 'bank-transfer' | 'credit-card' | 'other';
  reference: string;
  notes: string;
  staffId: Types.ObjectId | null;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    carparkId: { type: Schema.Types.ObjectId, ref: 'Carpark', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'ParkingSession', default: null },
    statementId: { type: Schema.Types.ObjectId, ref: 'MonthlyStatement', default: null },
    amount: { type: Number, required: true },
    method: {
      type: String,
      enum: ['cash', 'eftpos', 'bank-transfer', 'credit-card', 'other'],
      default: 'eftpos',
    },
    reference: { type: String, default: '' },
    notes: { type: String, default: '' },
    staffId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

PaymentSchema.index({ carparkId: 1, customerId: 1 });
PaymentSchema.index({ carparkId: 1, paidAt: -1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);

export default Payment;
