# 貴金屬與匯率換算器

版本：**v1.0.0**

這是一個免安裝、免 API 金鑰的靜態網站。開啟 `index.html` 即可使用。可查詢金、銀、鉑、鈀的美元現貨價，按重量與純度估算新台幣或其他幣別價值，並轉換貨幣。

## 部署到 GitHub Pages

1. 在 GitHub 建立一個新儲存庫，例如 `precious-metals-converter`，預設分支使用 `main`。
2. 解壓縮程式包，把**包內所有檔案和資料夾**放在儲存庫根目錄，包括 `index.html`、`package.json`、`.nojekyll` 與 `.github/workflows/deploy-pages.yml`。如果用 GitHub 網頁上傳，請確認隱藏的 `.github` 資料夾也成功上傳；較穩妥的方式是用 GitHub Desktop 加入整個解壓縮資料夾並推送。
3. 到儲存庫 **Settings → Pages → Build and deployment → Source**，選 **GitHub Actions**。
4. 推送到 `main` 後，前往 **Actions** 查看 `Deploy GitHub Pages`；成功後會取得網址 `https://你的帳號.github.io/儲存庫名稱/`。

檔案可放在任意 GitHub 儲存庫名稱下，無須修改網頁中的相對路徑。沒有 npm 安裝或建置步驟；`package.json` 只保存版本資料。

## 更新版本

版本號目前寫在 `package.json`、`README.md`、`index.html` 的畫面標籤與 `application-version` meta。發布下一版時請同步修改。採 `主版.次版.修訂` 格式，例如 `1.0.1`。

## 資料與限制

- 金屬價格由 [Gold API](https://gold-api.com/docs) 提供，每 60 秒嘗試更新；報價以美元／金衡盎司表示。
- 匯率由 [Frankfurter v2](https://frankfurter.dev/) 提供，每 15 分鐘檢查一次，但原始資料是每日參考中間價。
- 瀏覽器需能連線到上述服務；若報價失敗，頁面會顯示錯誤，曾載入成功的資料仍會保留在當次開啟的頁面。
- 現貨價估算不是回收報價。實際回收可能受到驗金、耗損與店家價差影響。

## 檔案

- `index.html`：完整網頁、樣式與換算邏輯。
- `package.json`：版本資訊。
- `.github/workflows/deploy-pages.yml`：推送 `main` 時自動部署 GitHub Pages。
- `.nojekyll`：讓 GitHub Pages 直接服務靜態檔案。
