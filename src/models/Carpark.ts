import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICarpark extends Document {
  name: string;
  address: string;
  timezone: string;
  capacity: number;
  dailyRate: number;
  phone: string;
  email: string;
  website: string;
  createdAt: Date;
  updatedAt: Date;
}

const CarparkSchema = new Schema<ICarpark>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    timezone: { type: String, default: 'Pacific/Auckland' },
    capacity: { type: Number, default: 50 },
    dailyRate: { type: Number, default: 18 },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  { timestamps: true }
);

const Carpark: Model<ICarpark> =
  mongoose.models.Carpark || mongoose.model<ICarpark>('Carpark', CarparkSchema);

export default Carpark;
