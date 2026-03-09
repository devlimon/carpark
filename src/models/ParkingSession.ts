import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type SessionStatus = 'active' | 'returned' | 'overdue' | 'void';
export type PaymentStatus = 'unpaid' | 'eftpos' | 'on-account' | 'to-pay' | 'paid' | 'void';
export type PickedUpStatus = 'car-in-yard' | 'picked-up';

export interface IParkingSession extends Document {
  _id: Types.ObjectId;
  carparkId: Types.ObjectId;
  invoiceNo: number;
  keyNo: number;
  noKey: boolean;

  // Customer
  customerId: Types.ObjectId | null;
  customerType: string;
  customerName: string;
  customerPhone: string;

  // Vehicle
  rego: string;
  make: string;

  // Dates
  dateIn: Date;
  timeIn: string;       // "14:37"
  returnDate: Date;
  returnTime: string;   // "2030" = 20:30
  returnFlight: string;
  stay: number;         // calculated days

  // Pricing
  dailyRate: number;
  creditPercent: number;
  amount: number;       // gross
  creditAmount: number; // discount value
  totalPrice: number;   // net

  // Payment
  paymentStatus: PaymentStatus;
  paidAmount: number;
  payment2Status: string;
  payment2Amount: number;
  splitPayment: boolean;

  // Status
  pickedUp: PickedUpStatus;
  doNotMove: boolean;
  status: SessionStatus;

  // Staff
  staffIn: string;
  staffOut: string;

  // Notes
  notes: string;
  invoiceNote: string;

  // Metadata
  receiptPrinted: boolean;
  receiptEmailed: boolean;
  returnedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ParkingSessionSchema = new Schema<IParkingSession>(
  {
    carparkId: { type: Schema.Types.ObjectId, ref: 'Carpark', required: true },
    invoiceNo: { type: Number, required: true },
    keyNo: { type: Number, default: 0 },
    noKey: { type: Boolean, default: false },

    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerType: { type: String, default: 'casual' },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, default: '' },

    rego: { type: String, default: '', uppercase: true },
    make: { type: String, default: '' },

    dateIn: { type: Date, required: true },
    timeIn: { type: String, default: '' },
    returnDate: { type: Date, required: true },
    returnTime: { type: String, default: '' },
    returnFlight: { type: String, default: '' },
    stay: { type: Number, default: 1 },

    dailyRate: { type: Number, default: 18 },
    creditPercent: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    creditAmount: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'eftpos', 'on-account', 'to-pay', 'paid', 'void'],
      default: 'unpaid',
    },
    paidAmount: { type: Number, default: 0 },
    payment2Status: { type: String, default: '' },
    payment2Amount: { type: Number, default: 0 },
    splitPayment: { type: Boolean, default: false },

    pickedUp: { type: String, enum: ['car-in-yard', 'picked-up'], default: 'car-in-yard' },
    doNotMove: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'returned', 'overdue', 'void'], default: 'active' },

    staffIn: { type: String, default: '' },
    staffOut: { type: String, default: '' },

    notes: { type: String, default: '' },
    invoiceNote: { type: String, default: '' },

    receiptPrinted: { type: Boolean, default: false },
    receiptEmailed: { type: Boolean, default: false },
    returnedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ParkingSessionSchema.index({ carparkId: 1, returnDate: 1 });
ParkingSessionSchema.index({ carparkId: 1, status: 1 });
ParkingSessionSchema.index({ carparkId: 1, invoiceNo: 1 }, { unique: true });
ParkingSessionSchema.index({ carparkId: 1, customerId: 1 });

const ParkingSession: Model<IParkingSession> =
  mongoose.models.ParkingSession ||
  mongoose.model<IParkingSession>('ParkingSession', ParkingSessionSchema);

export default ParkingSession;
