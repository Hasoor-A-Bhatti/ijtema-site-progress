export type EquipmentBookingGroup =
  | "admin"
  | "ansar"
  | "khuddam";

export type EquipmentLoanStatus =
  | "out"
  | "late"
  | "returned"
  | "returned_late";

export interface EquipmentLoanDepartment {
  id: string;
  name: string;
}

export interface EquipmentLoanItem {
  id: string;
  loan_id: string;
  item_name: string;
  quantity: number;
  quantity_returned: number;
  returned_at: string | null;
  created_at?: string | null;

  status: EquipmentLoanStatus;
  outstandingQuantity: number;
}

export interface EquipmentLoan {
  id: string;
  loan_date: string;
  booking_group: EquipmentBookingGroup | null;

  department_id: string;
  department_name_snapshot: string;

  borrower_name: string;
  borrower_aims_id: string;

  issued_at: string;
  due_at: string;

  created_at?: string | null;

  items: EquipmentLoanItem[];
  status: EquipmentLoanStatus;
  outstandingQuantity: number;
}

export interface RecentBorrower {
  departmentId: string;
  departmentName: string;
  borrowerName: string;
  borrowerAimsId: string;
}

export interface EquipmentLoanSummary {
  outstanding: number;
  late: number;
  activeLoans: number;
  returned: number;
}

export interface EquipmentLoansResponse {
  success: true;
  loanDate: string;
  bookingGroup: EquipmentBookingGroup;

  departments: EquipmentLoanDepartment[];
  loans: EquipmentLoan[];
  recentBorrowers: RecentBorrower[];

  summary: EquipmentLoanSummary;
}

export interface NewEquipmentLoanItem {
  item_name: string;
  quantity: number;
}

export interface CreateEquipmentLoanInput {
  bookingGroup: EquipmentBookingGroup;
  departmentId: string;
  borrowerName: string;
  borrowerAimsId: string;
  items: NewEquipmentLoanItem[];
}

export interface EquipmentLoanMutationResult {
  success: boolean;
  error?: string;
}
