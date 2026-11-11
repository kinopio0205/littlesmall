# 小呆記帳：LIFF 身分綁定規劃（最終版）

> 整理日期：2026-11-11。只做規劃，沒有改任何程式碼。
> 標記說明：
> - 【官方】：已讀過 LINE 或 Firebase 官方頁確認。
> - 【程式碼】：已對照本 repo 的檔案和行號確認。
> - 【待驗證】：查證時判定「無法證實」，或只是推論，需要實機、Emulator 或再查文件。
> - 查證判定「不成立」的主張已全部剔除，例如「台灣要 LINE 子公司核准才能建 MINI App」「HashRouter 會自動補 #/」。

---

## 1. 目標與非目標

### 目標
1. 在 LINE 裡開 app 時，用 LINE 帳號自動對應到 roster 成員，不用再手動選名字。
2. 第一次使用時，讓使用者用一個步驟選「我是誰」，或「以新成員加入」，然後完成綁定。
3. 一般瀏覽器、不用 LINE 的人、LIFF 初始化失敗時，都退回現在的手動選名流程，功能不退化。
4. 之後可以用 `shareTargetPicker` 把邀請連結分享到 LINE。
5. 資料結構要預留升級路線，之後能改成「可信身分」（Firebase Auth 加 Firestore rules），不必搬資料。

### 非目標（這次 MVP 不做）
- 不做防偽。沒有後端、沒有 Firebase Auth，綁定只是「自動選名的便利功能」，不是安全身分。UI 不可以寫「已驗證」。
- 不改主文件 `ledgers/{code}` 的結構，也不解決既有的整份 `setDoc` last-writer-wins 問題。只避免讓綁定受它影響。
- 不做支出逐筆權限，例如「只能改自己的帳」。
- 不使用 LINE Notify（已於 2025/3 停止）。

---

## 2. 建議方案總覽

主幹採 MVP 取向，也就是純前端、可升級。再加入 UX 案和安全案中查證後站得住的部分。

| 面向 | 決定 | 來源 |
|---|---|---|
| Channel | **優先 LINE MINI App channel（unverified）**；如果個人不符合 MINI App Policy 的 "permitted customer"，改用 LINE Login channel + LIFF app | 查證第 1 點：2026/03/11 起台灣開放【官方】；個人是否符合資格【待驗證】 |
| LIFF 入口 | Endpoint = `https://<user>.github.io/littlesmall/?src=liff`。只在 LIFF 入口動態載入 SDK | MVP 案；Endpoint 可以帶 query【官方】 |
| 啟動順序 | 先 `await liff.init()` resolve，再讀 URL、`replaceState`、render `<HashRouter>` | 【官方】init 前不可改 URL，router 要在 init 後初始化 |
| 邀請參數 | `?code=` 改成 `?space=`。過渡期一般連結兩個參數都帶 | 避免和 OAuth `code` 撞名；舊 bundle 相容（完整性第 7 點） |
| 本機身分 | 從「全域名字字串」改成 `byCode: {[syncCode]: memberId}` | UX 案、安全案；完整性第 9、10 點 |
| 綁定儲存 | 子集合 `ledgers/{code}/lineBindings/{lineKey}`，一人一份文件 | 主文件 toLedgerDoc 會丟掉頂層欄位，也會被 last-writer-wins 覆蓋【程式碼】 |
| 綁定 key | `lineKey = hex(SHA-256(syncCode + ":" + lineUserId))`，不存明文 userId | UX 案；完整性第 13 點 |
| 可信身分 | 列為之後的選做階段：Anonymous Auth，再用 Cloudflare Worker 驗 ID token 並簽 custom token | trust 研究；B 案（Identity Platform OIDC）不採用 |

---

## 3. LINE Developers Console 設定步驟

### 3.1 Channel 類型建議與理由

**建議：先確認資格，再優先建 LINE MINI App channel。不符合資格時，改用 LINE Login channel + LIFF app。**

選 MINI App 的理由：
- 官方建議新的 LIFF app 建成 LINE MINI App，LIFF 會整併進 MINI App 品牌【官方】。
- 2026/03/11 官方新聞寫明，台灣、泰國的 "permitted customer" 都可以建立 MINI App channel，舊的「需子公司核准」說法已經過時【官方】。
- 新建的 channel 預設就是 unverified，可以直接使用。channel 內部分成 Developing、Review、Published 三個 channel【官方】。Developing 可以拿來當開發環境，不必另外建 channel【待驗證：Developing 的 Endpoint 能否另外指定】。
- MINI App 的限制：一個 channel 只能有一個 web app、畫面只有 Full、不能隱藏 action button【官方】。這些對本 app 都不是問題。
- 只有 certified provider 底下的 channel 才能在台灣申請 verification review【官方】。unverified 已經夠用。

改用 LINE Login channel 的情況：
- MINI App Policy 的 "permitted customer" 不包含個人【待驗證】。
- LINE Login channel 加 LIFF 仍受官方支援，只是不推薦【官方】。
- 一個 Login channel 最多可以放 30 個 LIFF app，可以分正式和開發兩個【官方】。

不論選哪一種：
- **Provider 要現在就定下來，之後不能更換。** 同一 provider 底下所有 channel 的 userId 相同；channel 不能搬到別的 provider【官方】。這樣日後從 Login channel 轉成 MINI App，綁定才不會失效。

### 3.2 步驟

1. **選定 Provider**：建立一個專屬「小呆記帳」的 provider，之後所有 channel 都放在這裡。
2. **確認資格**：讀 LINE MINI App Policy，確認個人是否算 permitted customer【待驗證】。不確定時可以問 LINE 台灣。
3. **建立 channel**：
   - MINI App：Region 選 Taiwan，填名稱、icon、說明。台灣使用者會看到同意畫面，所以文案要清楚。Region 建立後能不能改【待驗證】，當作不能改來處理。
   - LINE Login：Region 選 Taiwan，App type 勾 Web app，記下 Channel ID（之後 P5 驗 ID token 時當 `client_id` 用）。
4. **LIFF 設定**（MINI App 是 channel 本身的 web app 設定；Login channel 是在 LIFF 分頁按 Add）：
   - Size：Full。
   - Endpoint URL：`https://<user>.github.io/littlesmall/?src=liff`。必須是 HTTPS、不能有 `#fragment`【官方】；結尾斜線和 base `/littlesmall/` 要和實際部署一致。
   - Scopes：`openid` 和 `profile`。先開 `openid` 是為了 P5，到時不必讓使用者重新同意。不開 email。
   - Add friend option（Bot link）：Off。Scan QR：Off。
   - 記下 LIFF ID。這個值是公開的，不是祕密。
5. **開發環境**：
   - Login channel：另外建一個 dev LIFF app，Endpoint 指向**具名** HTTPS tunnel。
   - MINI App：使用 Developing channel。
   - **GitHub Pages 沒有預覽部署**，研究裡「指向 Pages 預覽路徑」的做法不存在，已經剔除。
6. **Roles**：開發期把測試者加成 Tester。Developing 狀態只有 Admin 和 Tester 能登入（來自搜尋摘要，【待驗證】逐字確認）。
7. **上線**：把 channel 切到 Published。忘記切的話，一般使用者會登入失敗。
8. **分享（P4）**：
   - Login channel：在 LIFF 分頁的 shareTargetPicker 同意 "Agreement Regarding Use of Information" 後按 Enable【官方】。
   - MINI App channel：這個開關在哪裡【待驗證】。
9. **隱私權政策頁**：在 GitHub Pages 放一頁，說明只用 LINE userId 的雜湊來對應成員。Console 是否強制要求這頁【待驗證】。

---

## 4. 資料模型與遷移

### 4.1 Firestore

- **主文件 `ledgers/{code}` 不變**，仍是 `{members, groups, expenses, settlements}`。`Member` 也不加 `lineUserId`，理由：
  1. `toLedgerDoc`（firestoreSync.ts:22-29）和新版遷移路徑（:41-50）只保留四個欄位，頂層新增的欄位會被丟掉【程式碼】。
  2. 主文件每次變動都整份 `setDoc` 覆寫（:131-134），沒有 merge 或 transaction【程式碼】，兩人同時綁定時會互相蓋掉。
  3. 舊版遷移路徑會把成員重建成 `{id,name}`（:57-63），額外欄位會掉【程式碼】。
- **新子集合 `ledgers/{code}/lineBindings/{lineKey}`**：
  - `lineKey` = hex(SHA-256(`{syncCode}:{lineUserId}`))，在前端用 WebCrypto 計算。
  - 欄位：
    - `memberId`
    - `memberName`：只當自我修復的後備值，以 roster 的現值為準。
    - `boundAt`、`updatedAt`
    - `previousMemberId?`：改綁時保留，供稽核和通知。
    - `v: 1`
  - **不存**明文 userId、pictureUrl。displayName 預設也不存，見決策問題第 3 題。
  - 對主文件整份 `setDoc` 不會刪到子集合。這是 Firestore 一般行為，查證判定成立，但官方頁本輪沒有 fetch。
- **Firestore rules**：
  - repo 裡沒有 rules【程式碼】，Console 上實際的規則【待驗證】。
  - rules 不會自動套用到子集合。如果現行規則只寫了 `match /ledgers/{code}`，lineBindings 的讀寫會被拒絕。
  - 做法：先匯出現行規則成 `firestore.rules` 納入 repo，再補上子集合的規則，至少驗證欄位型別和長度。

### 4.2 本機 store

- `identityStore`（key `ledger-identity`，目前是 v0、全域名字字串【程式碼】）：
  - 升級成 `{ byCode: Record<code, memberId>, legacyName?: string }`，persist version 改成 1，migrate 要能處理 v0。
  - 連線後，用 `legacyName` 在**目前空間**的 roster 找成員，找到就轉成 memberId，然後清掉 legacyName。
  - 提供 `useMyMember()`，以及相容用的 `useMyName()`。第一階段頁面可以先不動。
- `lastSpaceStore`（目前是 `{code, identity}`【程式碼】）：改成 `recentSpaces: {code, lastUsedAt}[]`，最多 5 筆，移除 identity 欄位。`SyncGate.tsx:35` 要跟著修改。
- 新增 `liffStore`（不 persist）：
  - `mode: off | client | external-guest | external-loggedin`
  - `lineUserId`、`displayName`、`pictureUrl`：只存在記憶體，不落地。
  - `canShare`
- 新增 `bindingStore`（不 persist）：`Record<lineKey, LineBinding>`，加一個 `ready` 旗標。

### 4.3 遷移

- 既有空間不需要遷移資料。沒有 lineBindings 子集合就視為未綁定。
- 本機身分：依上面的 legacyName 規則轉換。找不到對應成員就清空，讓使用者重選。
- 邀請參數：
  - 新的一般連結在過渡期同時帶 `?space=X&code=X`，讓還在跑舊 bundle 的人也讀得到（完整性第 7 點）。
  - LIFF 連結只帶 `?space=`。
  - 舊的 `?code=` 只在網址**沒有** `state`、`liffClientId`、`liffRedirectUri`、`liff.*` 參數時才接受。
  - 過渡期結束後，連結只帶 `space`。
- `buildInviteUrl` 目前用 `window.location.pathname` 組網址【程式碼 syncCode.ts:15-17】，要改成固定根路徑。

---

## 5. 啟動與綁定流程

### 5.1 啟動（main.tsx 的 bootstrap，在 createRoot().render 之前）

1. **判斷是不是 LIFF 入口**。init 之前只能讀 URL，不能改。符合任一條件就算：
   - 有 `src=liff`（Endpoint 的 query 在兩段 redirect 都會保留【官方範例】）。
   - 有 `liff.state` 或 `liffClientId` 這類參數。
   - sessionStorage 有 `liff-login-pending` 旗標。
   - 「回呼網址實際帶哪些參數名」【待驗證】，判斷條件要保守。
2. **不是 LIFF 入口**：不載入 SDK，解析 `?space=` 或相容的 `?code=`，用 `replaceState` 刪掉參數後 render。行為和現在一樣。
3. **是 LIFF 入口**：
   - 動態 `import('@line/liff')`，版本固定 2.32.0。v2.20.0–2.31.0 有 XSS 漏洞，v2.31.2 修了 query 裡的 `?` 被換成 `&` 的問題【官方】。
   - 用模組層級的單一 Promise 呼叫 `liff.init({ liffId, withLoginOnExternalBrowser: false })`，避免 StrictMode 重複 init。
   - **init resolve 之前**：不讀、不改 location，不 render HashRouter，不初始化任何 analytics。
     - 理由：官方規定 init 前不可改 URL【官方】。react-router 的 hash history 在 idx 為 null 時會呼叫 `history.replaceState`（只改 state）【程式碼：react-router 7.18.1】。另外 LIFF URL 的 fragment 可能含 access token【官方】，不能被 router 當成路由解析。
   - **init 卡住時**：不要用硬逾時直接降級。超過約 5 秒就顯示「LINE 連線中…」，並給一顆「略過，手動進入」按鈕。
     - 按下略過後：自行嘗試從 `liff.state` 解析出 `space`（編碼格式【待驗證】），晚到的 init 結果一律丟棄，避免 secondary redirect 在 router 掛載後才發生（完整性第 6 點）。
4. **init 完成後**：
   - `mode` 依 `liff.isInClient()` 和 `liff.isLoggedIn()` 決定。
   - 已登入時呼叫 `liff.getProfile()`（需要 profile scope【官方】），結果只放在記憶體。
   - 設定 `canShare = liff.isApiAvailable('shareTargetPicker')`。
5. **解析邀請**：
   - 用 `replaceState` **只刪 `space`、`code` 這兩個自己的參數**。不碰 `liff.*`【官方】，也**不重排參數順序**。
   - 理由：`redirectUri` 必須以 Endpoint URL 開頭【官方】；如果 `src=liff` 被移到後面，前綴比對就會失敗（查證第 9 點）。
6. 最後才 render `<StrictMode><HashRouter><App/>`。

### 5.2 加入空間（App 內）

- 目前沒有 code：直接 `setCode(X)`。
- X 等於目前 code：什麼都不做。
- X 不等於目前 code：
  - 在 LIFF 內（使用者明確從 LINE 點了連結）：直接切換，舊 code 推進 `recentSpaces`，Layout 顯示「已切換 · 回到上一個」。因為身分依 code 記在 byCode，切換不會遺失。
  - 一般瀏覽器：沿用現在的 pendingInvite 橫幅。

### 5.3 身分決定（新的 useResolveIdentity，插在 App.tsx:92 連線完成之後、:100 身分檢查之前）

1. **在 LIFF 已登入時，主文件和 bindings 的第一個 snapshot 都到了才判斷**，避免閃爍和誤綁（完整性第 8 點）。
2. 依序判斷：
   - a. `bindings[lineKey]` 存在，而且 memberId 在 roster 裡：設定 `byCode[code]`，顯示 toast「已用 LINE 自動辨識：X」，不跳任何畫面。
   - b. 綁定存在，但 memberId 不在 roster（被 last-writer-wins 蓋掉）：用新的 `ensureRosterMember(id, name)` 以**指定 id** 補回成員。名字以 roster 現值為準，memberName 只當後備。然後同 a。
   - c. `byCode[code]` 有值，但沒有綁定：直接進入，總覽頁顯示一次可關閉的提示「綁定這個 LINE 帳號到『X』？」。
   - d. 有 lineUserId、沒有綁定、本機也沒有身分：顯示 **BindConfirm**（見 5.4）。
   - e. 沒有 LINE 身分：顯示 IdentitySelect（現行流程，加兩項改進：「LINE 自動辨識」徽章；新暱稱真的寫進 roster）。
3. **LINE 內的手動切換**：
   - Layout 的「切換身分」改成設一個「本次工作階段覆寫」旗標，gate 在這個工作階段內不再自動設回綁定身分。
   - 切換時詢問「要一併改綁嗎？」。
   - 不採用 MVP 案「切換就等於解除綁定」的做法（完整性第 12 點）。

### 5.4 BindConfirm 頁

- 頂部顯示 LINE 頭像、displayName，以及「在這個空間裡你是哪一位？」
- **建議成員**：名字和 displayName 正規化後相同、而且還沒被綁定的成員，顯示大按鈕「我是 X」。一律要點擊確認，不自動綁定。
- **其他未綁定成員**：用 chip 列出。
- **已綁定的成員**：灰色顯示。點下去會出現確認視窗「這會取代原本的綁定」。確認後寫入新綁定，並在舊綁定記錄 `previousMemberId`。被取代的那個人下次開啟時，提示「你的綁定已被另一個 LINE 帳號取代」。
- **「我是新成員」**：輸入框預填 displayName。
  - **名字已存在時必須擋下，要求改名。**
  - 改用新的 `addRosterMemberStrict`，不能沿用 `addRosterMember`。後者以名字去重，同名時會直接回傳既有的 id，等於繞過「已綁定」檢查【程式碼 groupStore.ts:35-38】（完整性第 5 點）。
  - 送出順序：寫 roster、寫綁定、設定 byCode。
- **「這次先不綁定」**：退回 IdentitySelect。可以勾「此空間不再詢問」，記在本機。
- **綁定寫入失敗**（rules 拒絕、離線）：仍用本機 byCode 讓使用者進入，並提示「綁定未儲存」。

### 5.5 解除與改綁

- Layout 身分選單：顯示「此 LINE 帳號已綁定為 X」，提供改綁、解除綁定。
- 成員頁：任何人都可以「解除此成員的 LINE 自動辨識」，需要確認。這是為了處理換 LINE 帳號、手機遺失、被冒用的情況，確保綁定不會卡死（完整性第 3 點）。
- 這些都是社交層級的防呆，不是安全機制。

### 5.6 降級情境

| 情境 | 行為 |
|---|---|
| 一般瀏覽器、一般連結 | 不載入 SDK，維持現況 |
| LINE 聊天室裡點一般網址（LINE 內建瀏覽器，不是 LIFF） | 維持現況，另外顯示提示「用 LINE 連結開啟可自動辨識」。分享時優先給 LIFF 連結 |
| 外部瀏覽器開 LIFF 連結、沒登入 | `external-guest`，手動選名。提供選用的「以 LINE 登入自動辨識」：設定 sessionStorage 旗標後呼叫 `liff.login({ redirectUri: 目前網址 })`，網址要保留 `?src=liff` 在最前面。桌機需要 email、密碼或 QR 登入，畫面要有「取消、改手動」的路徑 |
| 外部瀏覽器 MINI App 支援（2025/10 起） | 台灣是否適用【待驗證】 |
| init 失敗或使用者按略過 | 手動模式，邀請碼依 5.1 第 3 點補救 |
| LIFF 內沒有同步碼（LINE 選單、釘選連結、換手機） | 進 SyncGate，提示「回到 LINE 群組點邀請連結」。**這是主要情境，不是邊角情境**，因為 LIFF browser 的 localStorage 和使用者平常的瀏覽器是分開的（完整性第 1 點）；它會保留多久【待驗證】 |
| LINE PC 版 | 行為和 shareTargetPicker 能不能用【待驗證】，列入測試 |

### 5.7 分享（P4）

- 條件：`canShare` 為 true，而且使用者已登入。
- 呼叫 `liff.shareTargetPicker`。先用文字訊息，連結是 `https://liff.line.me/{liffId}?space=CODE`。用 Flex 的話只能用 URI action【官方】。
- 使用者取消時，不顯示錯誤。
- 外部瀏覽器沒有 SSO session 時，可能跳出 email 登入【官方】，這時退回複製連結。
- 「空間名稱」目前資料模型裡沒有，訊息先用固定文字。

---

## 6. 檔案變更清單

| 檔案 | 變更 |
|---|---|
| package.json | 新增 `@line/liff` 固定 2.32.0（不用 `^` 範圍）；devDependencies 加 vitest、`@line/liff-mock`（用法【待驗證】）；新增 `test` script |
| src/main.tsx | 改成 async bootstrap：判斷 LIFF 入口、init（單一 Promise、略過按鈕）、解析邀請，最後才 render HashRouter |
| src/liff/liffClient.ts（新） | 整個 app 只有這裡 import `@line/liff`：init、isLiffEntry、login、getProfile、canShare、share。不宣告或修改 `window.liff`【官方】 |
| src/liff/lineKey.ts（新） | 用 WebCrypto 計算 SHA-256(`code:userId`) |
| src/utils/invite.ts（新） | consumeInviteFromUrl：讀 `space`；`code` 只在沒有 OAuth 或 liff 參數時接受；只刪不重排；liff.state 後備解析。applyInvite 從 App.tsx:36-58 搬過來 |
| src/utils/syncCode.ts | buildInviteUrl 固定根路徑，過渡期帶 `space` 和 `code`；新增 buildLiffInviteUrl；之後用 `crypto.getRandomValues` 產生新同步碼 |
| src/App.tsx | 移除 :27-60 的 URL 解析；LIFF 內直接切換空間；在 :92 和 :100 之間插入 useResolveIdentity |
| src/hooks/useResolveIdentity.ts（新） | 5.3 的判斷順序、自我修復、legacyName 遷移、工作階段覆寫旗標 |
| src/components/BindConfirm.tsx（新） | 5.4 的完整畫面 |
| src/components/IdentitySelect.tsx | 新暱稱改用 addRosterMemberStrict 寫進 roster（修現況缺口 :14-16）；顯示「LINE 自動辨識」徽章；外部瀏覽器加 LINE 登入按鈕 |
| src/components/Layout.tsx | LINE 綁定區塊（改綁、解除）、工作階段覆寫、recentSpaces 與返回橫幅、P4 的分享按鈕 |
| src/components/SyncGate.tsx | :35 改用 recentSpaces 和 byCode；加「回到 LINE 群組點連結」提示 |
| src/store/identityStore.ts | persist v1：byCode、legacyName migrate；useMyMember、useMyName |
| src/store/lastSpaceStore.ts | 改成 recentSpaces，移除 identity |
| src/store/liffStore.ts、bindingStore.ts（新） | 不 persist；devtools 不輸出 userId |
| src/store/groupStore.ts | 新增 addRosterMemberStrict（同名就拒絕）和 ensureRosterMember(id, name) |
| src/sync/lineBindingSync.ts（新） | 冪等的 connect、disconnect（StrictMode 安全）、bindLine、unbindLine（setDoc 和 deleteDoc） |
| src/sync/firestoreSync.ts | disconnect 時一起退訂 bindings；**:117-118 只在 `!snap.metadata.fromCache` 時才建立文件**（防止離線時用空資料覆寫帳本，【待驗證】）；export migrateLedgerDoc 供測試 |
| src/types/index.ts | 新增 LineBinding；Member 不變 |
| src/utils/identity.ts、src/pages/*.tsx、ExpenseModal.tsx、Groups.tsx、GroupDetail.tsx | 比對從 `m.name === identity` 改成 `m.id === myMemberId`；GroupDetail 加徽章和解除綁定 |
| src/vite-env.d.ts（新，目前不存在【程式碼】） | ImportMetaEnv.VITE_LIFF_ID |
| firestore.rules、firebase.json（新） | 先匯出 Console 現行規則，再加 lineBindings 子集合規則；用 Emulator 測試 |
| .github/workflows/deploy.yml | build step 注入 `VITE_LIFF_ID: ${{ vars.LIFF_ID }}`；**正式分支缺這個值時讓 build 失敗**；加 lint 和 test |
| vite.config.ts | 開發用 `server.allowedHosts` 加 tunnel 網域 |
| README.md、隱私權政策頁 | LINE 開啟方式、「LINE 自動辨識只是便利功能，不防偽」、邀請參數改名說明 |

---

## 7. 分階段里程碑（每個階段都能單獨上線）

### P0：前置修正（不碰 LINE，約 1 天）
- 內容：
  - 邀請參數改成 `?space=`，過渡期同時帶 `code`；buildInviteUrl 固定根路徑。
  - 修 firestoreSync:117-118 的 fromCache 建檔問題（先用離線測試確認問題真的存在）。
  - IdentitySelect 新暱稱用 addRosterMemberStrict 寫進 roster。
  - 匯出 Firestore rules 納入 repo。
  - 加 vitest。
- 驗收：
  - 新、舊連結都能加入空間；舊 bundle 打開新連結也能加入。
  - 離線開啟不會清空帳本。
  - 新暱稱會出現在 roster，同名會被拒絕。
  - 邀請解析的單元測試全部通過。

### P1：身分改用 memberId（約 1 天）
- 內容：identityStore 改 byCode 並做 v0 遷移；recentSpaces；頁面比對改用 id（可以先靠 useMyName 過渡）。
- 驗收：
  - 舊使用者升級後不必重選。
  - 兩個空間有同名但不同人時，不會互相串用身分。
  - identity.ts 和遷移的測試通過。

### P2：LIFF 啟動（還不做綁定，約 1 天）
- 內容：Console 設定（第 3 節）、liffClient、bootstrap、略過按鈕、外部瀏覽器登入按鈕。
- 驗收：
  - 一般瀏覽器沒有退化，也不會下載 SDK。
  - iOS 和 Android 的 LINE 內開 `liff.line.me/{id}?space=X` 都能正確加入空間。
  - 外部瀏覽器 login 回來後，OAuth code 不會被當成同步碼，登入成功。
  - init 卡住時按略過可以進入，邀請碼沒有遺失。

### P3：綁定 MVP（約 1.5–2 天）
- 內容：lineBindings 子集合、bindingStore、useResolveIdentity、BindConfirm、自我修復、改綁和解除、取代通知、rules 開放子集合。
- 驗收：
  - 已綁定的人直接進入，畫面不閃爍。
  - 未綁定的人可以選人或以新成員加入。
  - 用同名當新成員會被擋下。
  - 兩支手機同時綁定不同成員時，兩邊的綁定都保留。
  - 兩支手機同時以新成員加入時，roster 被覆蓋後可以自我修復。
  - 換 LINE 帳號後，可以由別人解除舊綁定再重新綁定。
  - LINE 內手動切換身分後，本次工作階段不會被設回綁定身分。
  - channel 已切到 Published。

### P4：分享（約 0.5–1 天）
- 內容：啟用 shareTargetPicker、邀請到 LINE、退回複製連結。
- 驗收：
  - LINE 內可以分享到聊天室，對方點開能加入空間。
  - 使用者取消分享時沒有錯誤訊息。
  - 不支援分享時會顯示複製連結。

### P5（選做）：可信身分
- 內容：
  - Firebase Anonymous Auth，rules 要求 `request.auth != null`。要先部署 client，等大家都更新後才收緊 rules。
  - Cloudflare Worker：呼叫 `POST https://api.line.me/oauth2/v2.1/verify`（帶 `id_token` 和 `client_id`，不需要 channel secret【官方】），再用 service account 私鑰簽 RS256 custom token。
  - rules 限制只能寫自己的綁定。必須保留「替別人強制解除」的路徑，不能做成 secure 案那種 `update:false` 加「只能本人刪除」，否則會卡死。
- 驗收：用 Emulator 和 rules-unit-testing 測試冒綁、列舉、解除。

---

## 8. 安全性與隱私

- **威脅模型**：持有同步碼的人可以讀寫整份文件和子集合，也能寫入任何綁定。安全性和現在「誰都能選任何名字」一樣，沒有退步，也沒有提升。
  - 官方說明：不是直接從 LINE Platform 取得的 ID token，要在伺服器端驗證；不要把 getProfile 的資料當成可信身分送到伺服器【官方】。
- **隱私**：
  - 只存 lineKey（雜湊，以同步碼當鹽，不同空間無法關聯）。不存明文 userId 和 pictureUrl。displayName 預設不存。
  - userId 的值域有限，知道某人 userId 的人仍能比對出雜湊，所以這只算「減少暴露」，不算匿名化。
- **不可記錄**：
  - console、錯誤回報不可印出 userId 或 ID token。
  - 不可把 primary redirect URL（含 access token）送到外部 log【官方】。
- **同步碼**：目前用 `Math.random` 產生，8 碼、字元表 31 個【程式碼】，P0 之後改用 crypto 亂數。Console 的 rules 是否允許 list 列舉所有空間【待驗證】，如果允許，要優先處理。
- **刪除要求**：使用者要能在每個空間解除綁定。用了雜湊就無法跨空間反查，這點要在隱私頁寫明。
- **文案**：一律用「LINE 自動辨識」，不要用「已驗證」。

---

## 9. 風險與待驗證事項

### 風險
1. LIFF 和 HashRouter：官方說 fragment 路由「相容性有限」【官方】。LIFF 連結只用 query，不帶 `#/route`；要深連結就用 `?to=balances`，init 後再導頁。長期可評估改用 BrowserRouter 加 404.html。
2. 主文件 last-writer-wins 依舊存在：新成員寫進 roster 時仍可能被覆蓋，只能靠自我修復。支出互相覆蓋是既有問題，這次不處理。
3. 新、舊 bundle 並存：GitHub Pages 和 LINE 內的快取可能拖延更新，靠過渡期雙參數處理。
4. 搶綁拉鋸：取代和解除都沒有權限控管，只能靠通知和稽核欄位讓事情可見。
5. 台灣使用者第一次開啟會看到同意畫面，可能流失使用者。

### 待驗證
- [ ] 個人是否算 MINI App Policy 的 permitted customer；MINI App 的 Developing channel 能否另設 dev Endpoint；MINI App 的 shareTargetPicker 開關在哪裡。
- [ ] `liff.login` 回呼網址實際帶哪些參數名（`liffClientId`、`liffRedirectUri` 等）。
- [ ] `liff.state` 的編碼格式；init 後 `?src=liff&space=X` 的實際還原結果和參數順序。
- [ ] Channel consent simplification 是否只限日本（本輪沒有重新確認）；台灣是否適用 MINI App 外部瀏覽器支援。
- [ ] LIFF browser 的 localStorage 會保留多久（iOS、Android）；LINE PC 版的行為。
- [ ] 離線時 `onSnapshot` 是否回傳 `fromCache` 加上 `exists=false`，並觸發空文件寫入（Firestore SDK 實測）。
- [ ] Console 上實際的 Firestore rules，以及是否允許 list。
- [ ] Developing 狀態只有 Admin 和 Tester 能登入（逐字確認）。
- [ ] `@line/liff-mock` 的用法。
- [ ] P5 相關：custom token 在 Spark 方案能否使用；Worker 免費方案 10 ms CPU 內能否完成 RS256 簽章；rules 的 `sign_in_provider` 值和 `diff().affectedKeys()` 語法。
- [ ] LIFF 頁首的分享或永久連結會不會帶到 space 已被刪掉的 URL。

### 測試矩陣（P2、P3 實機）
- 平台：iOS LINE、Android LINE、LINE PC、外部 Safari、外部 Chrome。
- 開啟來源：一對一聊天、群組、記事本、釘選連結。
- 狀態：已綁定、未綁定、同名、取代綁定、換帳號、兩台手機同時以新成員加入。
- 網路與生命週期：弱網路、離線、init 卡住、外部登入回呼、LIFF 視窗被系統回收後恢復。
- 部署：舊 bundle 收到新連結。

---

## 10. 已確認的決策（2026-11-11）

> 原本的 14 題已逐題確認。凡與本文其他章節衝突之處，以本節為準。

| # | 題目 | 決定 | 對本文其他章節的影響 |
|---|---|---|---|
| 1 | Channel 類型 | **LINE MINI App（未認證）**；Console 不讓個人建立時，改用 LINE Login channel | MINI App Policy 列出台灣個人可建「未認證 MINI App」，但同頁也有「需公司核准」的舊說法，以 Console 實際操作為準 |
| 2 | userId 儲存 | **只存雜湊** SHA-256(`code:userId`) | 同第 4.1 節 |
| 3 | LINE displayName | **不存** | 同第 4.1 節 |
| 4 | 邀請參數 | **改名 `?space=`，過渡期同時帶 `code`** | 同第 4.3 節 |
| 5 | 外部瀏覽器 | **不自動登入**，只提供 LINE 登入按鈕 | `withLoginOnExternalBrowser: false` |
| 6 | 未綁定的人 | **不強制綁定** | 保留「這次先不綁定」與「此空間不再詢問」 |
| 7 | 改綁別人已綁定的成員 | **不允許改綁；只能解除自己的綁定** | **取代**第 5 節與 P3 中「改綁、取代通知、任何人可替別人解除、強制解除」的設計。已被綁定的成員在綁定畫面顯示為不可選。風險見下方 |
| 8 | 一個成員多個 LINE 帳號 | **不行，一對一** | 同第 4.1 節 |
| 9 | LINE 內點其他空間的連結 | **直接切換**，並提供「回到上一個空間」 | 同第 5.2 節 |
| 10 | LIFF ID 位置 | **GitHub repo Variables**，deploy.yml 注入，正式分支缺值時 build 失敗 | 同第 6 節 |
| 11 | 開發用 HTTPS Endpoint | **Cloudflare 具名 tunnel** | 需要一個託管在 Cloudflare 的網域 |
| 12 | Firestore 安全規則 | **使用者自己在 Firebase Console 修改**；規則**不**納入 repo | **取代**第 4.1、6 節與 P0 中「匯出 rules 納入 repo、firestore.rules / Emulator 測規則」的項目。實作 P3 時由我提供要加的規則內容 |
| 13 | 可信身分（P5） | **先不排** | P5 維持選做，本次不做 |
| 14 | 上線節奏 | **P1–P4 全部做完一次上線** | **取代**第 7 節「每階段單獨上線、觀察幾天」。開發時仍依 P1→P4 順序進行、每階段有自己的測試，只是合併成一次部署 |

### 決策 7 帶來的風險（待處理）
- **換 LINE 帳號或綁錯人時**：舊綁定只有原本的 LINE 帳號能解除。如果那個帳號已經不用了，這個成員就無法再被任何 LINE 帳號綁定。
- **影響範圍**：綁定只是「自動選名字」的便利功能，這個人仍可以手動選自己的名字使用 app，不會被鎖在外面。
- **可能的退路**（需再決定）：在 Firebase Console 手動刪除該筆綁定文件；或加一個不在 LINE 內、需要確認的「重設此成員的 LINE 綁定」功能。

### 決策 14 帶來的風險
- 一次上線時，P1 的本機身分遷移（名字 → memberId）和 LINE 功能同時生效。上線前要在正式資料的複本上跑過遷移，並準備好退回上一版的方式（GitHub Pages 重新部署上一個 commit）。

---

## 11. 參考資料

### LINE 官方
- https://developers.line.biz/en/docs/liff/opening-liff-app/ （primary／secondary redirect、liff.state）
- https://developers.line.biz/en/docs/liff/registering-liff-apps/ （Endpoint 限制、scope、channel 類型）
- https://developers.line.biz/en/reference/liff/ （init 前可用的 API、login redirectUri、shareTargetPicker）
- https://developers.line.biz/en/tips/2026/07/16/liff-url-additional-info/ （init 前不可改 URL）
- https://developers.line.biz/en/docs/liff/development-guidelines/ （建議用 History API、fragment 相容性有限）
- https://developers.line.biz/en/docs/liff/developing-liff-apps/
- https://developers.line.biz/en/docs/liff/using-user-profile/
- https://developers.line.biz/en/docs/liff/release-notes/ （v2.31.1 XSS 修正、v2.31.2、v2.32.0）
- https://developers.line.biz/en/docs/liff/liff-plugin/ （LIFF Inspector、LIFF Mock）
- https://developers.line.biz/en/docs/line-login/verify-id-token/
- https://developers.line.biz/en/reference/line-login/ （verify endpoint）
- https://developers.line.biz/en/docs/line-login/integrate-line-login/ （callback 參數）
- https://developers.line.biz/en/news/2026/ （2026/03/11 台灣、泰國開放 MINI App）
- https://developers.line.biz/en/docs/line-mini-app/discover/introduction/
- https://developers.line.biz/en/docs/line-mini-app/develop/develop-overview/
- https://developers.line.biz/en/docs/line-mini-app/develop/external-browser/
- https://developers.line.biz/en/docs/line-mini-app/develop/channel-consent-simplification/
- https://developers.line.biz/en/docs/line-mini-app/submit/submission-guide
- https://developers.line.biz/en/tips/2026/06/25/provider-design-basics/ （provider 與 userId）
- https://developers.line.biz/en/docs/messaging-api/getting-user-ids/

### Firebase 和 Cloudflare（P5 用）
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://firebase.google.com/docs/auth/web/openid-connect
- https://firebase.google.com/pricing
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/

### 本 repo 關鍵檔案
- C:\Users\chris\Desktop\ledger-app\.claude\worktrees\check-current-content-54a0fd\src\App.tsx （:27-34 讀取並刪除 `?code=`；:92、:100 是插入點）
- C:\Users\chris\Desktop\ledger-app\.claude\worktrees\check-current-content-54a0fd\src\sync\firestoreSync.ts （:22-29、:41-63、:115-118、:131-134）
- C:\Users\chris\Desktop\ledger-app\.claude\worktrees\check-current-content-54a0fd\src\store\groupStore.ts （:35-41 以名字去重）
- C:\Users\chris\Desktop\ledger-app\.claude\worktrees\check-current-content-54a0fd\src\components\IdentitySelect.tsx （:14-16）
- C:\Users\chris\Desktop\ledger-app\.claude\worktrees\check-current-content-54a0fd\src\utils\syncCode.ts （:4-8、:10-12、:15-17）
- C:\Users\chris\Desktop\ledger-app\.claude\worktrees\check-current-content-54a0fd\src\store\identityStore.ts、src\store\lastSpaceStore.ts、src\components\SyncGate.tsx、src\components\Layout.tsx
