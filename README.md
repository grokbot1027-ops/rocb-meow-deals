# Roc B 喵喵著數（Roc B Meow Deals）

一頁睇晒香港信用卡優惠：迎新、餐飲、網購、現金回贈、飛行里數、海外、超市、交通等，
可以搜尋、多重篩選（類別 × 銀行 × 卡種 × 優惠類型）同排序（回贈 %、每里成本、迎新價值、到期日、銀行）。
貓貓吉祥物叫 **Roc B** 🐱。

> ⚠️ 資料只供參考，全部整理自各銀行／發卡機構官方網頁及條款（每項優惠都附官方連結）；優惠受銀行條款約束，隨時可能更改；唔構成理財建議。申請前請到官方網頁核實。

## 結構

```
index.html              # 單頁，全部用相對路徑（可放喺 GitHub Pages 子路徑 /rocb-meow-deals/）
assets/style.css        # 樣式（桌面＝表格，手機＝精簡卡片）
assets/app.js           # 讀取 data/offers.json、篩選、搜尋、排序、展開詳情（無 build step）；提供 window.RocBApp
assets/assistant.js     # 「問 Roc B」規則式問答小助手（純前端，冇 API、冇伺服器）
assets/rocb-cat.svg     # Roc B 貓貓標誌（亦係 favicon）
data/offers.json        # ★ 唯一資料來源（array of objects）
scripts/validate_offers.py   # 更新資料後驗證 schema
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
| `cat_rates` | 類別 → 回贈 % 對照（例如 `{"網購": 4}`），只填官網／來源寫明嘅數字；問答小助手用 |
| `rebate_cap_hkd` / `cap_period` | 額外回贈上限（HK$）／上限周期：`月`、`期`、`推廣期`；唔知就 `null` |
| `min_spend_for_rate_hkd` | 要簽滿幾多先有該回贈率（唔知就 `null`） |

## 資料政策：只用官方來源

- 每項顯示嘅優惠都必須引用銀行／發卡機構嘅**官方**網頁或條款（`source_url`、`promo_url`、`registration_url`、`extra_sources` 全部要係官方網域，`scripts/validate_offers.py` 有白名單檢查）。
- 只有官方頁面寫明嘅數字先會顯示；官方頁面搵唔到嘅數字（例如上限、年費）會留空或者寫「未有列明」，唔會估。
- 官方頁面確認唔到嘅優惠會直接刪走，唔會顯示。
- 要登記嘅優惠一定有登記備註（喺表格同手機卡片直接顯示，唔使撳「詳情」）；有官方登記網址就有「去登記」掣。

## 「問 Roc B」問答小助手

右下角貓貓掣「問 Roc B」打開對話框（手機全屏友善）。純前端規則配對，**唔使 API key、唔使伺服器**，GitHub Pages 直接用得。

- 可以用廣東話／中文／英文問，例如「網購邊張卡最抵」、「儲 Asia Miles 用邊張」、「去日本簽咩卡」、「超市」、「迎新最多」、「唔使年費」、「月簽 $5000 網購」。
- 同義詞表（`assets/assistant.js` 頂部 `CAT_SYN`、`BANK_SYN`）將字眼對應到 offers.json 嘅類別同銀行；亦識「免年費」、「唔使登記」同金額（$5000、5k、5千）。
- 排序：按回贈 %／每里成本／迎新價值／估算回贈排；每張卡最多出一次；已過期唔會出。
- 每個答案項目都會顯示登記備註（有就附「去登記」連結）同「官方推廣頁／官方來源」連結。
- 有金額時用 `cat_rates` × 金額粗略估算，有 `rebate_cap_hkd` 就封頂；未達 `min_spend_for_rate_hkd` 會提示。所有數字都直接嚟自 offers.json。
- 每個答案有「📋 喺主列表顯示呢類優惠」掣，會套用相應篩選。
- 唔明嘅問題會出提示；底部有免責一句：答案由規則自動配對，只供參考。
- 測試：`window.RocBAssistant.answer('網購')` 會回傳結構化結果。

## 發佈

**未發佈。** 呢個 repo 只喺本機 `git init` 咗，冇建立 GitHub repo、冇 push、冇開 GitHub Pages。
將來確認發佈後，可以建立 repo `rocb-meow-deals`，push `main`，喺 Settings → Pages 揀 `main` / root，網址會係 `https://<user>.github.io/rocb-meow-deals/`。
