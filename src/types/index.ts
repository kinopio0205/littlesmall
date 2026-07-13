export interface Member {
  id: string;
  name: string;
}

export type SplitType = 'equal' | 'percentage' | 'exact' | 'shares';

export interface SplitEntry {
  memberId: string;
  amount: number; // final amount this member owes for the expense
  rawValue?: number; // the raw percentage/shares input, for editing convenience
}

export interface GroupExpense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  payerId: string;
  date: string;
  splitType: SplitType;
  splits: SplitEntry[];
  icon: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  date: string;
  note?: string;
}

export interface Group {
  id: string;
  name: string;
  icon: string;
  memberIds: string[];
  createdAt: string;
}
