export type Role = 'owner' | 'employee';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit';

export interface User {
  id: string;
  name: string;
  pin: string;
  role: Role;
  maxDiscount: number; // Percentage an employee is allowed to apply
}

export interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  unit: string;
  expiryDate?: string | null;
  category?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  creditLimit: number;
  currentDue: number;
}

export interface Sale {
  id: string;
  customerId?: string | null;
  userId: string;
  shiftId?: string | null;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  paymentMethod: PaymentMethod;
  date: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  priceAtSale: number;
}

export interface Shift {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string | null;
  openingBalance: number;
  closingBalance?: number | null;
  status: 'open' | 'closed';
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: string;
}

/** A line in the active billing cart (in-memory, not persisted until checkout). */
export interface CartItem {
  product: Product;
  quantity: number;
}

/** Aggregated numbers shown on the Home dashboard. */
export interface HomeStats {
  todaySales: number;
  todayOrders: number;
  lowStock: number;
  totalProducts: number;
}
