# 每日更新 offers.json 流程

網站只讀 `data/offers.json`，所以更新資料＝改呢個檔案，唔使改 HTML/JS。

## 1. 搵最新推廣
- 逐間銀行／發卡機構睇官方信用卡頁、推廣頁（例如滙豐 redhotoffers、中銀信用卡優惠頁、DBS 信用卡優惠頁）同條款 PDF。
- **網站只可以引用官方頁面**：唔好喺 offers.json、README 或者網頁放任何非官方網站嘅連結或名稱。

## 2. 讀官方網頁／條款 PDF
```bash
mkdir -p /workspace/rocb-sources && cd /workspace/rocb-sources
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
curl -sSL -A "$UA" -o page.raw "<官方網址>"
# PDF：pdftotext -layout file.pdf file.txt
# JS 網頁：google-chrome --headless=new --no-sandbox --virtual-time-budget=15000 --dump-dom "<網址>" > page.html
grep -n -E "%|HK\$|港元|202[67]" page.txt
```
已知難搞嘅網站：
- americanexpress.com：curl 會 403（Access Denied），要用瀏覽器或者網頁擷取工具。
- primecredit.com／wewacard.com／aeon.com.hk 部分頁面：Cloudflare（有時要 captcha）。
- hkbea.com 產品頁：JS 動態內容，headless 都未必讀到；條款 PDF（hkbea.com/pdf/...）就讀到。
- 滙豐部分條款 PDF 係圖片，pdftotext 讀唔到字，要睇圖／OCR。
- cdn.thesim.com：403。

## 3. 更新 JSON
每項優惠一個 object（欄位見 README）。規則：
- 冇寫嘅數字唔好估；有效期冇列明就寫 `"未有列明"`、`expiry_date: null`。
- `source_url`／`promo_url`／`registration_url`／`extra_sources` 全部用官方網址（`source_type: "official"`）。
- 官方頁面冇寫嘅數字（上限、年費等）就留 `null`／唔寫；官方頁面確認唔到嘅優惠唔好加。
- `限時推廣` 一定要有 `promo_url`；`迎新` 有官方推廣頁都要填。
- 要登記（`requires_registration: true`）就填 `registration_method`、`registration_app`、`registration_url`、`registration_deadline`、`registration_note_zh`，全部跟官方條款寫；官方冇講方法就用 `⚠️ 需要登記，登記方法請睇官網條款`，`registration_confirmed: false`。
- 新網域要加入 `scripts/validate_offers.py` 嘅官方網域白名單（只加銀行／發卡機構／商戶官方網域）。
- 更新 `last_checked` 做當日日期（香港時間，YYYY-MM-DD）。
- 已過期嘅推廣可以刪走（網站預設會隱藏已過期項目）。

## 4. 驗證同預覽
```bash
cd /workspace/rocb-meow-deals
python3 scripts/validate_offers.py          # 0 errors 先好 commit
cd .. && python3 -m http.server 8931         # http://127.0.0.1:8931/rocb-meow-deals/
```

## 5. Commit
```bash
cd /workspace/rocb-meow-deals
git add data/offers.json && git commit -m "data: refresh offers $(TZ=Asia/Hong_Kong date +%F)"
```
（未確認發佈前唔好 push。）

## 問答小助手相關（2026-10-03 新增）

- 改咗回贈率、上限或者到期日之後，記得同步更新 `cat_rates`、`rebate_cap_hkd`、`cap_period`、`min_spend_for_rate_hkd`。唔肯定嘅數就填 `null`，**唔好估**。小助手只會講 offers.json 入面有嘅數字。
- 加咗新類別或者新銀行，要喺 `assets/assistant.js` 嘅 `CAT_SYN`／`BANK_SYN` 補返同義詞。
- 改完喺瀏覽器 console 試下 `RocBAssistant.answer('網購')`、`RocBAssistant.answer('儲 Asia Miles')`，睇下排名合唔合理。

## 滙豐「最紅自主獎賞」（每年更新）

- 官方頁：https://www.hsbc.com.hk/zh-hk/credit-cards/rewards/your-choice/ （類別、商戶名單、登記限期）；條款 PDF 係圖片，要 OCR（`pdftoppm -r 300` + `tesseract -l chi_tra+eng`）。
- 商戶名單喺頁面 tab 入面；中英文版次序唔同，`merchants` 同 `merchants_en` 分開存，唔好按次序配對。
- 合資格卡睇條款「Eligible Credit Card」一條（2026 年：Red、EveryMile、Privé 除外）。
