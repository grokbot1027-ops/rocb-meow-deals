# Roc B 喵喵著數（Roc B Meow Deals）

一頁睇晒香港信用卡優惠：迎新、餐飲、網購、現金回贈、飛行里數、海外、超市、交通等，
可以搜尋、多重篩選（類別 × 銀行 × 卡種 × 優惠類型）同排序（回贈 %、每里成本、迎新價值、到期日、銀行）。
主列表**每張卡一行**（手機每張卡一張卡片）：JS 按 `card_id` 將 offers.json 嘅優惠分組，分開顯示「🎁 迎新」、「💳 平時回贈」（回贈率、類別回贈 `cat_rates`、上限、年費）同「🔥 限時推廣」；冇 `card_id` 嘅多卡／全行推廣放喺下面獨立嘅「銀行／多卡限時推廣」區。
篩選以卡為單位：一張卡嘅（未過期）優惠合埋符合條件就會顯示；「優惠類型」＝有呢類優惠嘅卡；排序用每張卡最好嘅相關數字（揀咗消費類別時用該類別回贈率）。
貓貓吉祥物叫 **Roc B** 🐱。

標題下面有「🆕 本月新優惠」橫額（唔係自動彈出嘅 pop-up）：顯示今個月新加入、仲未完嘅限時推廣數目、月底前完嘅數目同最近條款有變嘅優惠數目，撳落去打開面板（手機係由底部彈上嚟嘅 sheet）。詳見下面「🆕 本月新優惠／⚠️ 條款有變」。

> ⚠️ 資料只供參考，全部整理自各銀行／發卡機構官方網頁及條款（每項優惠都附官方連結）；優惠受銀行條款約束，隨時可能更改；唔構成理財建議。申請前請到官方網頁核實。

## 結構

```
index.html              # 單頁，全部用相對路徑（可放喺 GitHub Pages 子路徑 /rocb-meow-deals/）
assets/style.css        # 樣式（桌面＝表格，手機＝精簡卡片）
assets/app.js           # 讀取 data/offers.json、篩選、搜尋、排序、展開詳情（無 build step）；提供 window.RocBApp
assets/monthly.js       # 「🆕 本月新優惠」橫額＋面板、「⚠️ 條款有變」；提供 window.RocBMonthly
assets/assistant.js     # 「問 Roc B」規則式問答小助手（純前端，冇 API、冇伺服器）
assets/rocb-cat.svg     # Roc B 貓貓標誌（亦係 favicon）
data/offers.json        # ★ 唯一資料來源（array of objects）
scripts/validate_offers.py   # 更新資料後驗證 schema（包括 added_date、changes）
scripts/set_added_dates.py   # 幫冇 added_date 嘅優惠補日期（用 git 歷史搵第一次出現嘅日子；新優惠用今日）
scripts/REFRESH.md           # 每日更新流程
.nojekyll
```

## 本地預覽

```bash
cd /workspace            # 父目錄，模擬 GitHub Pages 子路徑
python3 -m http.server 8931
# 開 http://127.0.0.1:8931/rocb-meow-deals/
```

（直接用 `file://` 開唔得，因為瀏覽器唔俾 fetch 本地 JSON。）

## offers.json 欄位

| 欄位 | 說明 |
|---|---|
| `id` | 唯一 ID |
| `bank` / `bank_key` / `issuer_type` | 顯示名稱／英文 key／`銀行`、`虛擬銀行`、`非銀行發卡機構`、`卡組織／錢包` |
| `card` / `card_id` / `card_type` | 卡名／卡 ID／`現金回贈卡`、`里數卡`、`積分卡`、`不限／多款` |
| `offer_type` | `迎新`、`簽賬回贈`、`限時推廣` |
| `title` / `summary_zh` | 標題／繁體中文（港式）摘要 |
| `categories` | 迎新、現金回贈、里數、餐飲、網購、海外、超市、交通、內地／澳門、日本、電子產品、電子錢包、購物、繳費／保險、分期、生活 |
| `key_terms` / `caps` | 重要條款／上限 |
| `validity_text` | 有效期（按來源寫法，冇寫就「未有列明」） |
| `start_date` / `expiry_date` | ISO 日期（用嚟排序；唔知就 `null`） |
| `rebate_pct` | 最高回贈 %（排序用；通常有上限） |
| `hkd_per_mile` | 最低每里成本（HK$） |
| `welcome_value_hkd` / `welcome_miles` / `min_spend_hkd` | 迎新價值／迎新里數／簽賬要求 |
| `annual_fee_hkd` / `annual_fee_note` / `fx_fee_pct` | 年費／備註／外幣手續費 % |
| `requires_registration` | 要唔要登記 |
| `registration_method` | `app`、`web`、`sms`、`other`（唔使登記就 `null`） |
| `registration_app` / `registration_url` / `registration_deadline` | 登記用嘅 App 名／官方登記網址／登記限期（ISO；唔知就 `null`） |
| `registration_note_zh` | 網站同小助手顯示嘅登記備註（例如「📱 要喺 HSBC Reward+ App 登記…」）；官網冇講方法就寫 `⚠️ 需要登記，登記方法請睇官網條款` |
| `registration_confirmed` | 登記方法係咪已喺官方頁面確認（`false` ＝ 只知要登記，方法未列明） |
| `promo_url` | 官方推廣頁（所有 `限時推廣` 必填；`迎新` 有就填） |
| `source_url` / `source_label` / `source_type` | 官方來源（`source_type` 一定係 `official`） |
| `extra_sources` | 其他官方來源（例如條款 PDF、產品資料概要） |
| `last_checked` | 最後檢查日期（香港時間） |
| `added_date` | **必填**。呢項優惠第一次加入網站嘅日期（香港時間，YYYY-MM-DD）。之後唔好改。「🆕 本月新優惠」靠呢個欄位：`限時推廣` 而且 `added_date` 喺今個月就算「本月新」。首次建立網站時已有嘅優惠＝`2026-10-03` |
| `changes` | 選填。**銀行官方改咗條款**嘅紀錄（array），每項：`date`（記錄日期，香港時間）、`field`（`welcome` 迎新、`validity` 有效期、`rebate_pct` 回贈率、`cap` 上限、`min_spend` 簽賬要求、`registration` 登記、`other`）、`old_zh`／`new_zh`（改之前／之後，繁中）、`note_zh`（選填，一句解釋）、`source_url`（官方新條款）、`old_source_url`（選填，官方舊條款）。**自己資料出錯而更正唔算**，唔好記 |
| `cat_rates` | 類別 → 回贈 % 對照（例如 `{"網購": 4}`），只填官網／來源寫明嘅數字；問答小助手用 |
| `rebate_cap_hkd` / `cap_period` | 額外回贈上限（HK$）／上限周期：`月`、`期`、`推廣期`；唔知就 `null` |
| `min_spend_for_rate_hkd` | 要簽滿幾多先有該回贈率（唔知就 `null`） |
| `reward_categories` | 類別／指定商戶回贈（例如滙豐「最紅自主獎賞」5 大類別、Red 卡指定商戶）：`name`、`name_en`、`site_cats`（對應網站類別）、`rate_pct`（揀咗嘅最高 %）、`rate_if_not_chosen_pct`、`requires_choice`（要喺 App 揀類別）、`rate_note`、`desc`、`merchants`（官方中文商戶名單 `{分組: [商戶]}`）、`merchants_en`（官方英文名單，次序同中文版唔同，所以分開存） |
| `merchant_list_url` | 官方商戶名單網址 |

## 資料政策：只用官方來源

- 每項顯示嘅優惠都必須引用銀行／發卡機構嘅**官方**網頁或條款（`source_url`、`promo_url`、`registration_url`、`extra_sources` 全部要係官方網域，`scripts/validate_offers.py` 有白名單檢查）。
- 只有官方頁面寫明嘅數字先會顯示；官方頁面搵唔到嘅數字（例如上限、年費）會留空或者寫「未有列明」，唔會估。
- 官方頁面確認唔到嘅優惠會直接刪走，唔會顯示。
- 要登記嘅優惠一定有登記備註（喺表格同手機卡片直接顯示，唔使撳「詳情」）；有官方登記網址就有「去登記」掣。

## 🆕 本月新優惠／⚠️ 條款有變（`assets/monthly.js`）

- **本月新優惠**＝`offer_type` 係 `限時推廣`、`added_date` 喺今個月（香港時間）、而且未過期嘅優惠。迎新同簽賬回贈唔計。下個月 1 號自動轉新一期（例如 11 月就只計 11 月加入嘅）。
- 橫額：「🆕 10 月新優惠：X 個限時推廣 · Y 個月底前完 · ⚠️ Z 個優惠條款有變」。撳落去打開面板。
- 面板每項：銀行／卡、標題、重點數字（回贈 %、金額、簽賬要求、上限）、到期日同仲有幾多日、加入日期、登記備註（📱）、「去登記 ↗」（`registration_url`）同「官方推廣頁 ↗」（`promo_url`）。**月底前完或者 7 日內完**嘅會有 ⏰ 紅框，排最頂。
- **⚠️ 條款有變**：讀 `changes`，顯示本月或者 30 日內記錄嘅改動（之前 → 而家，附官方新／舊條款連結）。主列表受影響嘅卡會有「⚠️ 條款有變」小 badge，優惠入面亦有一行提示，撳落去直接跳去面板嗰項；「詳情」入面有完整變更紀錄。
- **記住睇過**：用 `localStorage`（key `rocb-monthly-seen-v1`）記低睇過嘅項目。睇過之後橫額縮細做一粒小 badge；有新推廣或者新條款改動先會再大大個亮返，仲會顯示「N 個新」，面板入面新嘢有 NEW 標記。
- 測試：`RocBMonthly.compute()`（今日）或者 `RocBMonthly.compute('2026-11-02')`（模擬另一日）；`RocBMonthly.resetSeen()` 清除「睇過」紀錄。

## 「問 Roc B」問答小助手

右下角貓貓掣「問 Roc B」打開對話框（手機全屏友善）。純前端規則配對，**唔使 API key、唔使伺服器**，GitHub Pages 直接用得。

- 可以用廣東話／中文／英文問，例如「網購邊張卡最抵」、「儲 Asia Miles 用邊張」、「去日本簽咩卡」、「超市」、「迎新最多」、「唔使年費」、「月簽 $5000 網購」。
- 同義詞表（`assets/assistant.js` 頂部 `CAT_SYN`、`BANK_SYN`）將字眼對應到 offers.json 嘅類別同銀行；亦識「免年費」、「唔使登記」同金額（$5000、5k、5千）。
- 排序：按回贈 %／每里成本／迎新價值／估算回贈排；每張卡最多出一次；已過期唔會出。
- 每個答案項目都會顯示登記備註（有就附「去登記」連結）同「官方推廣頁／官方來源」連結。
- 要揀類別先有高回贈嘅卡（例如滙豐「最紅自主獎賞」）：問餐飲／超市／海外等類別時，就算唔入頭 5 名都會另外列出，並寫明「要喺 Reward+ 揀「賞滋味」」、冇揀時嘅回贈率、上限同登記限期。
- 商戶名問題（例如「屈臣氏」、「Klook」、「百佳」、「壽司郎」）：用 `reward_categories[].merchants`／`merchants_en` 嘅官方名單配對，答邊張卡、邊個類別、幾多 %；亦會列出其他喺官方條款文字提到呢個商戶嘅優惠。
- 有金額時用 `cat_rates` × 金額粗略估算，有 `rebate_cap_hkd` 就封頂；未達 `min_spend_for_rate_hkd` 會提示。所有數字都直接嚟自 offers.json。
- 每個答案有「📋 喺主列表顯示呢類優惠」掣，會套用相應篩選。
- 唔明嘅問題會出提示；底部有免責一句：答案由規則自動配對，只供參考。
- 「今個月有咩新優惠」、「中銀有咩新推廣」、「今個月網購有咩新優惠」：列出本月新限時推廣（快完嘅排先，可以按銀行／類別篩），附登記備註同官方連結，仲有掣打開「🆕 本月新優惠」面板。
- 「有咩條款改咗」、「DBS 條款有變」：列出最近官方條款改動（之前 → 而家），附官方新條款連結。
- 測試：`window.RocBAssistant.answer('網購')` 會回傳結構化結果。

## 發佈

**已發佈。** 網站：https://grokbot1027-ops.github.io/rocb-meow-deals/ （GitHub Pages，`main` 分支 root）。
Repo：https://github.com/grokbot1027-ops/rocb-meow-deals 。
每朝香港時間大約 7:31 有自動更新流程：跟 `scripts/REFRESH.md` 去官網 check 優惠、更新 `data/offers.json`、驗證之後 commit 同 push `main`，GitHub Pages 自動重新發佈。
新功能（例如改 HTML／JS／CSS）會先喺獨立 branch 做，俾 Jonson 預覽確認先 merge 入 `main`。
