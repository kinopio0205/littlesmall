# Firestore 安全規則：LINE 綁定子集合

LINE 綁定用到兩個子集合：

- `ledgers/{code}/lineBindings/{memberId}`：每位成員的綁定（`lineKey` 是 LINE 帳號的雜湊）。
- `ledgers/{code}/lineKeys/{lineKey}`：反向索引（這個 LINE 帳號綁在哪位成員），用來保證同一個 LINE 帳號在兩台裝置同時綁定時只會留下一筆。

Firestore 的規則**不會自動套用到子集合**。如果目前的規則只有 `match /ledgers/{code}`，綁定的讀寫會被拒絕（app 會照常運作，只是不會記住 LINE 綁定）。

請到 Firebase Console → Firestore Database → 規則，在**現有的 `match /ledgers/{code} { ... }` 裡面**加入下面這段，然後按「發布」。

```
    match /lineBindings/{memberId} {
      allow read: if true;

      // 新增：欄位格式正確，且反向索引在同一次寫入中指向這位成員
      allow create: if validBinding(request.resource.data)
                    && pairedWithIndex(request.resource.data.lineKey, memberId);

      // 更新：只能由同一個 LINE 帳號更新（lineKey 不可變）——別人無法透過 app 改綁
      allow update: if validBinding(request.resource.data)
                    && request.resource.data.lineKey == resource.data.lineKey
                    && pairedWithIndex(request.resource.data.lineKey, memberId);

      // 刪除：解除綁定
      allow delete: if true;

      function validBinding(d) {
        return d.keys().hasOnly(['lineKey', 'memberName', 'boundAt', 'v'])
          && d.lineKey is string && d.lineKey.matches('^[0-9a-f]{64}$')
          && d.memberName is string && d.memberName.size() <= 50
          && d.boundAt is string && d.boundAt.size() <= 40
          && d.v == 1;
      }

      function pairedWithIndex(lineKey, memberId) {
        return getAfter(/databases/$(database)/documents/ledgers/$(code)/lineKeys/$(lineKey)).data.memberId == memberId;
      }
    }

    match /lineKeys/{lineKey} {
      allow read: if true;

      allow create, update: if lineKey.matches('^[0-9a-f]{64}$')
                            && request.resource.data.keys().hasOnly(['memberId', 'v'])
                            && request.resource.data.memberId is string
                            && request.resource.data.memberId.size() <= 128
                            && request.resource.data.v == 1;

      allow delete: if true;
    }
```

完整位置示意（只是示意，請保留你原本 `ledgers` 的規則內容）：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /ledgers/{code} {
      // ……你原本的規則……

      match /lineBindings/{memberId} {
        // ……上面那段……
      }

      match /lineKeys/{lineKey} {
        // ……上面那段……
      }
    }
  }
}
```

## 限制（請知悉）

- 目前沒有登入驗證（決策 13：可信身分先不做），所以規則**無法確認是誰在刪除**。知道同步碼又會寫程式的人，仍可直接呼叫 Firestore 刪除別人的綁定。這和現有帳本資料的保護程度相同：綁定是「免選名字」的便利功能，不是安全機制。
- 如果某位成員的 LINE 帳號換掉了、又無法用舊帳號解除（決策 7 不允許替別人解除），可以在 Firebase Console 的 Firestore 資料頁刪除 `ledgers/{同步碼}/lineBindings/{memberId}`（以及 `lineKeys` 裡指向這位成員的那一筆）。
