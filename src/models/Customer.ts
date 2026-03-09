import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type CustomerType = 'casual' | 'short-term' | 'long-term' | 'annual';
export type AccountType = 'cash' | 'eftpos' | 'on-account';

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  carparkId: Types.ObjectId;
  type: CustomerType;
  accountType: AccountType;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  rego1: string;
  rego2: string;
  make: string;
  // Long-term fields
  ltNumber: string;       // e.g. "LT1"
  // Pricing
  dailyRate: number;      // 0 = use carpark default
  creditPercent: number;  // discount %, e.g. 10
  // Annual / long-term expiry
  expiryDate: Date | null;
  maxVehicles: number;
  // On-account balance
  balance: number;
  // Public pay link
  slug: string;
  notes: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    carparkId: { type: Schema.Types.ObjectId, ref: 'Carpark', required: true },
    type: { type: String, enum: ['casual', 'short-term', 'long-term', 'annual'], required: true },
    accountType: { type: String, enum: ['cash', 'eftpos', 'on-account'], default: 'cash' },
    name: { type: String, required: true, trim: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true },
    phone: { type: String, default: '' },
    company: { type: String, default: '' },
    rego1: { type: String, default: '', uppercase: true },
    rego2: { type: String, default: '', uppercase: true },
    make: { type: String, default: '' },
    ltNumber: { type: String, default: '' },
    dailyRate: { type: Number, default: 0 },
    creditPercent: { type: Number, default: 0 },
    expiryDate: { type: Date, default: null },
    maxVehicles: { type: Number, default: 1 },
    balance: { type: Number, default: 0 },
    slug: { type: String, default: '', unique: true, sparse: true },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ carparkId: 1, type: 1 });
CustomerSchema.index({ carparkId: 1, rego1: 1 });

const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;
