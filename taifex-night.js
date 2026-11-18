"use strict";

function overnightScenario(change, foreignNet, dayVolume, nightVolume) {
  const total = dayVolume + nightVolume;
  if (![change, foreignNet, dayVolume, nightVolume].every(Number.isSafeInteger)
      || dayVolume <= 0 || nightVolume <= 0) {
    throw new Error("夜盤資料不完整");
  }
  const ratio = nightVolume / total;
  const strength = nightVolume * 10 < total * 3 ? "參考價值低"
    : nightVolume * 10 > total * 4 ? "強訊號" : "一般訊號";
  const flow = foreignNet >= 1000 ? "外資明顯偏多" : foreignNet <= -1000 ? "外資明顯偏空"
    : foreignNet < 0 ? "外資小幅偏空" : foreignNet > 0 ? "外資小幅偏多" : "外資多空持平";
  let scenario = 0;
  if (change > 0 && foreignNet >= 1000) scenario = 1;
  if (change > 0 && foreignNet < 0) scenario = 2;
  if (change < 0 && foreignNet < 0) scenario = 3;
  if (change < 0 && foreignNet >= 1000) scenario = 4;
  return { total, ratio, strength, flow, scenario };
}

const overnightPaths = [
  null,
  {
    trend: "開高續漲，買盤有機會延續",
    check: "開高後守住開盤價，且回檔未跌破昨收，續漲情境較有支撐。",
    invalidation: "若開高後跌破昨收，開高續漲的情境轉弱。",
  },
  {
    trend: "開高後回落，留意高開低走",
    check: "若開高後回落、跌破開盤價，且反彈站不回，留意賣壓擴大。",
    invalidation: "若回檔守住開盤價並再創早盤新高，高開低走的情境轉弱。",
  },
  {
    trend: "開低後續跌，空方壓力較大",
    check: "若開低後反彈站不回開盤價，且再破早盤低點，續跌情境較有支撐。",
    invalidation: "若收復開盤價並站穩昨收，續跌情境轉弱。",
  },
  {
    trend: "開低後反彈，留意能否翻紅",
    check: "若開低後止跌並收復開盤價，反彈情境較有支撐。站回昨收才算翻紅。",
    invalidation: "若反彈站不回開盤價且再破早盤低點，開低反彈的情境轉弱。",
  },
];

function soxConfirmation(change, foreignNet, soxChange) {
  if (!Number.isFinite(soxChange)) return "費半同夜收盤待確認";
  if (soxChange === 0) return "費半收平，未提供方向確認";
  if (change === 0) return "台指期夜盤收平，開盤方向待確認";
  if (Math.sign(soxChange) !== Math.sign(change)) return "費半與台指夜盤反向，開盤方向的支持度降低";
  if (change > 0 && foreignNet >= 1000) return "三項偏多同向，上漲力道較完整";
  if (change < 0 && foreignNet <= -1000) return "三項偏空同向，下跌壓力較完整";
  if (change < 0 && foreignNet < 0) return "三項偏空同向，外資淨空未達1,000口";
  return "費半與台指夜盤同向，外資籌碼未確認同方向";
}

function overnightOutlook(change, foreignNet, dayVolume, nightVolume, soxChange) {
  const signals = overnightScenario(change, foreignNet, dayVolume, nightVolume);
  const opening = change > 0 ? "偏向開高" : change < 0 ? "偏向開低" : "方向未明";
  const path = overnightPaths[signals.scenario] ?? {
    trend: "早盤延續方向待確認",
    check: "開盤後觀察指數相對於昨收與開盤價的位置。",
    invalidation: "",
  };
  return { ...signals, opening, ...path, confirmation: soxConfirmation(change, foreignNet, soxChange) };
}

function overnightHeadline(targetDate, today, time) {
  if (targetDate < today) {
    return time < "05:00" ? "最新早盤推估 · 等待夜盤 05:00 收盤" : "最新早盤推估 · 等待新一期夜盤資料";
  }
  return targetDate > today || time < "09:00" ? `${targetDate} 早盤推估` : `${targetDate} 盤前推估紀錄`;
}

async function fetchOvernight(url) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error("夜盤快照暫時無法取得");
  const snapshot = await response.json();
  for (const key of ["targetDate", "dayDate"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot[key])) throw new Error("夜盤日期格式錯誤");
  }
  overnightScenario(snapshot.nightChange, snapshot.foreignNet, snapshot.dayVolume, snapshot.nightVolume);
  return snapshot;
}

async function renderOvernight() {
  const panel = document.getElementById("taifexNight");
  if (!panel) return;
  const status = document.getElementById("taifexNightStatus");
  try {
    const local = "data/taifex-night.json";
    const raw = "https://raw.githubusercontent.com/james10394-bit/jc-stock-radar/main/data/taifex-night.json";
    // GitHub Pages may retain an older build after a scheduled data-only commit.
    const sources = location.hostname === "james10394-bit.github.io" ? [local, raw] : [local];
    const results = await Promise.allSettled(sources.map(fetchOvernight));
    const available = results.filter(result => result.status === "fulfilled").map(result => result.value);
    const data = available.sort((a, b) => b.targetDate.localeCompare(a.targetDate)).at(0);
    if (!data) throw new Error("等待期交所資料同步");

    const sox = data.sox?.sessionDate === data.dayDate && Number.isFinite(data.sox.close)
      && data.sox.close > 0 && Number.isFinite(data.sox.changePct) ? data.sox : null;
    const { total, ratio, strength, flow, scenario, opening, trend, check, invalidation, confirmation } =
      overnightOutlook(data.nightChange, data.foreignNet, data.dayVolume, data.nightVolume, sox?.changePct);
    const clock = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short",
    }).format(new Date());
    const today = clock.slice(0, 10);
    const time = clock.slice(11, 16);
    const historical = data.targetDate < today;
    const upcoming = data.targetDate > today || (data.targetDate === today && time < "09:00");
    const timing = historical ? "歷史盤前紀錄" : upcoming ? "待開盤" : "今日盤前紀錄";
    const number = new Intl.NumberFormat("zh-TW");
    const signed = new Intl.NumberFormat("zh-TW", { signDisplay: "exceptZero" });
    const percent = new Intl.NumberFormat("zh-TW", { style: "percent", maximumFractionDigits: 2 });
    status.textContent = `${data.targetDate} 台股早盤 · ${timing}｜${data.dayDate} 日盤與當晚夜盤`;
    const title = document.getElementById("taifexNightScenario");
    title.textContent = overnightHeadline(data.targetDate, today, time);
    const forecast = document.getElementById("taifexNightForecast");
    const tag = scenario ? `劇本${"一二三四"[scenario - 1]}` : "外資與夜盤尚未形成四種劇本";
    const briefing = historical ? `歷史示例｜${data.targetDate}｜${tag}` : tag;
    const quality = strength === "參考價值低"
      ? "量比低於30%，方向參考價值低，優先看開盤後是否符合下列確認條件。"
      : strength === "強訊號"
        ? "量比超過40%，符合強訊號門檻。"
        : "量比介於30%至40%，屬一般訊號。";
    const label = document.createElement("small");
    label.textContent = briefing;
    const openingLine = document.createElement("h3");
    openingLine.textContent = `預估開盤｜${opening}`;
    const notes = [
      `可能走勢｜${trend}`,
      `費半交叉確認｜${confirmation}`,
      `訊號強度｜${percent.format(ratio)} · ${strength}。${quality}`,
      `開盤後確認｜${check}`,
    ];
    if (invalidation) notes.push(`情境轉弱｜${invalidation}`);
    forecast.replaceChildren(label, openingLine, ...notes.map(text => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      return paragraph;
    }));
    forecast.hidden = false;
    const metrics = [
      ["TX 近月夜盤", `${number.format(data.nightClose)} 點（${signed.format(data.nightChange)} 點）`,
        `${data.contractMonth} 合約｜對比日盤結算 ${number.format(data.settlement)} 點`],
      ["TX 夜盤量比", `${percent.format(ratio)} · ${strength}`,
        `${number.format(data.nightVolume)} 口夜盤 ÷ ${number.format(total)} 口總量｜日盤 ${number.format(data.dayVolume)} 口`],
      ["TX 夜盤外資多空淨額", `${signed.format(data.foreignNet)} 口`, flow],
      ["費城半導體指數（SOX）",
        sox ? `${number.format(sox.close)} 點（${signed.format(sox.changePct)}%）` : "同夜收盤待確認",
        sox ? `${sox.sessionDate} 美東收盤｜${sox.source}` : "僅使用同夜已收盤資料"],
    ];
    const cards = metrics.map(([label, value, detail]) => {
      const card = document.createElement("div");
      card.className = "signal-card";
      const heading = document.createElement("small");
      heading.textContent = label;
      const amount = document.createElement("b");
      amount.textContent = value;
      const description = document.createElement("p");
      description.textContent = detail;
      card.append(heading, amount, description);
      return card;
    });
    document.getElementById("taifexNightMetrics").replaceChildren(...cards);
  } catch {
    status.textContent = "等待期交所夜盤行情與外資交易口數同步。";
    document.getElementById("taifexNightScenario").textContent = "最新早盤推估 · 等待夜盤資料";
  }
}

if (typeof module !== "undefined") module.exports = { overnightScenario, overnightOutlook, overnightHeadline };
if (typeof document !== "undefined") renderOvernight();
