import mongoose, { Schema, Document, Model, Types } from 'mongoose';

/**
 * Auto-increment counter for invoice numbers etc.
 */
export interface ICounter extends Document {
  _id: string;        // e.g. "invoiceNo_<carparkId>"
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>('Counter', CounterSchema);

export async function getNextInvoiceNo(carparkId: Types.ObjectId | string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    `invoiceNo_${carparkId}`,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}

export default Counter;
