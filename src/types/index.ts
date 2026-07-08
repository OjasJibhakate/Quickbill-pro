export type Role = 'owner' | 'employee';
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'credit';

export interface User {
  id: string;
  name: string;
  pin: string;
  role: Role;
  maxDiscount: number; // Percentage an employee is allowed to apply
  // Owner-granted permissions for employees (0/1). Owners implicitly have all.
  canStockIn?: number;
  canSuppliers?: number;
  canEditBills?: number;
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
  /** Per-product max discount % for employees; null = use the employee's global limit. */
  maxDiscount?: number | null;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  creditLimit: number;
  currentDue: number;
  discountPct: number;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  notes?: string | null;
  currentPayable: number;
  createdAt?: string | null;
}

export interface Purchase {
  id: string;
  supplierId?: string | null;
  userId: string;
  date: string;
  totalAmount: number;
  paid: number; // 1 = paid, 0 = on credit (adds to supplier payable)
  note?: string | null;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  quantity: number;
  buyPrice: number;
  batchNo?: string | null;
  expiryDate?: string | null;
}

export interface ProductBatch {
  id: string;
  productId: string;
  purchaseId?: string | null;
  supplierId?: string | null;
  batchNo?: string | null;
  expiryDate?: string | null;
  quantityRemaining: number;
  buyPrice: number;
  receivedAt?: string | null;
}

export type CreditTxnType = 'charge' | 'payment';

export interface CreditTransaction {
  id: string;
  customerId: string;
  saleId?: string | null;
  amount: number;
  type: CreditTxnType;
  note?: string | null;
  userId?: string | null;
  timestamp: string;
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

/** Restaurant mode: a dining table an order can be opened against. */
export interface DiningTable {
  id: string;
  name: string;
  sortOrder: number;
}

/** Restaurant mode: a saved line on a table's open (unsettled) order. */
export interface TableOrderLine {
  id: string;
  tableId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

/** A dining table plus a summary of its open order (for the tables grid). */
export interface TableWithOrder extends DiningTable {
  itemCount: number;
  orderTotal: number;
}

/** Aggregated numbers shown on the Home dashboard. */
export interface HomeStats {
  todaySales: number;
  todayOrders: number;
  lowStock: number;
  totalProducts: number;
}
