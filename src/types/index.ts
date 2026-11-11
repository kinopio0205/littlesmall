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

/**
 * LINE 綁定：存在 ledgers/{code}/lineBindings/{memberId}。以 memberId 當文件 id，
 * 一個成員最多只能有一個 LINE 帳號（transaction 檢查後寫入）。
 * lineKey 是 SHA-256(`${code}:${LINE userId}`)，不存 userId 原文與 LINE 顯示名稱。
 */
export interface LineBinding {
  lineKey: string;
  /** 綁定當下的成員名稱；只用來在成員被整份覆寫弄丟時補回，平常以名單為準。 */
  memberName: string;
  boundAt: string;
  v: 1;
}
