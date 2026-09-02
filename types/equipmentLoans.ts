export type EquipmentLoanStatus =
  | "out"
  | "late"
  | "returned"
  | "returned_late";

export interface EquipmentLoan {
  id: string;

  department_id: string;
  department_name_snapshot: string;

  borrower_name: string;
  borrower_aims_id: string;

  loan_date: string;

  issued_at: string;
  due_at: string;

  created_at: string;
  updated_at: string;
}

export interface EquipmentLoanItem {
  id: string;

  loan_id: string;

  item_name: string;

  quantity: number;
  quantity_returned: number;

  /*
   * Set only when the full quantity
   * has been returned.
   */
  returned_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface EquipmentLoanItemView
  extends EquipmentLoanItem {
  status: EquipmentLoanStatus;
}

export interface EquipmentLoanView
  extends EquipmentLoan {
  items: EquipmentLoanItemView[];

  status: EquipmentLoanStatus;

  totalQuantity: number;
  outstandingQuantity: number;
  returnedQuantity: number;
}

export interface NewEquipmentLoanItem {
  item_name: string;
  quantity: number;
}

export interface NewEquipmentLoan {
  departmentId: string;

  borrowerName: string;
  borrowerAimsId: string;

  items: NewEquipmentLoanItem[];
}

export interface RecentBorrower {
  departmentId: string;
  departmentName: string;

  borrowerName: string;
  borrowerAimsId: string;

  lastUsedAt: string;
}