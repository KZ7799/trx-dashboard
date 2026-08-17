import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

export default function App() {
  const API = "https://trx-dashboard-production.up.railway.app/signal";

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const liveRef = useRef(null);

  const loaded = useRef(new Set());
  const lastClose = useRef(5);
  const currentBlock = useRef(0);

  // 🔥 Marker Refs
  const markersRef = useRef([]);
  const predictSideRef = useRef(null);
  const loseCountRef = useRef(1);
  const pauseRef = useRef(0);

  // 🔥 Streak Refs
  const lastSignalRef = useRef(null);
  const streakRef = useRef(0);

  // 🔥 History Refs
  const historyRef = useRef([]);

  const [startBlock, setStartBlock] = useState("");
  const [hover, setHover] = useState("-");
  const [latest, setLatest] = useState("-");
  const [status, setStatus] = useState("STOPPED");
  const [liveSignal, setLiveSignal] = useState("-");
  const [streak, setStreak] = useState(0);

  // 🔥 Stats & Trends
  const [bigPercent, setBigPercent] = useState(50);
  const [smallPercent, setSmallPercent] = useState(50);
  const [timer, setTimer] = useState(60);
  const [trend, setTrend] = useState("SIDEWAYS");
  const [historyText, setHistoryText] = useState([]);

  function getDigit(hash) {
    if (!hash || typeof hash !== "string") return 0;
    for (let i = hash.length - 1; i >= 0; i--) {
      if (!isNaN(hash[i]) && hash[i] !== " ") return Number(hash[i]);
    }
    return 0;
  }

  async function getLatest() {
    try {
      const res = await fetch("https://api.trongrid.io/wallet/getnowblock", {
        method: "POST",
      });
      const json = await res.json();
      return json.block_header.raw_data.number;
    } catch {
      return 0;
    }
  }

  async function loadBlock(block) {
    if (loaded.current.has(block)) return null;

    setLatest(String(block));

    try {
      const res = await fetch("https://api.trongrid.io/wallet/getblockbynum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num: block }),
      });
      const json = await res.json();
      if (!json.blockID) return null;

      const digit = getDigit(json.blockID);
      const big = digit >= 5;
      const signal = big ? "BIG" : "SMALL";

      // Result Update
      setLiveSignal(signal);
      setTimer(60); // Reset timer per candle

      // 🔥 Streak Calculator
      if (lastSignalRef.current === signal) {
        streakRef.current += 1;
      } else {
        streakRef.current = 1;
        lastSignalRef.current = signal;
      }
      setStreak(streakRef.current);

      // 🔥 History Tracker
      const updatedHistory = [...historyRef.current, signal];
      historyRef.current = updatedHistory;

      const latest20 = updatedHistory.slice(-20);
      setHistoryText(latest20.map((x) => (x === "BIG" ? "B" : "S")));

      if (historyRef.current.length > 20) {
        historyRef.current.shift();
      }

      // 🔥 Percentage Calculator
      const bigCount = historyRef.current.filter((x) => x === "BIG").length;
      const total = historyRef.current.length;
      const bigP = total > 0 ? Math.round((bigCount / total) * 100) : 50;
      setBigPercent(bigP);
      setSmallPercent(100 - bigP);

      // 🔥 Trend Detector
      const recent = historyRef.current.slice(-5);
      const recentBig = recent.filter((x) => x === "BIG").length;
      const recentSmall = recent.filter((x) => x === "SMALL").length;

      if (recentBig >= 4) setTrend("UP TREND");
      else if (recentSmall >= 4) setTrend("DOWN TREND");
      else setTrend("SIDEWAYS");

      // 🔥 Candle Formation
      const open = lastClose.current;
      const close = big ? open + 1 : open - 1;
      lastClose.current = close;

      const candle = {
        time: Number(block),
        open,
        high: Math.max(open, close),
        low: Math.min(open, close),
        close,
      };

      // ==================================================
      // 🔥 SIGNAL & MARKER SYSTEM (Win/Lose Tracking)
      // ==================================================
      if (pauseRef.current > 0) {
        pauseRef.current -= 1;
      } else {
        if (!predictSideRef.current) {
          predictSideRef.current = signal;
          loseCountRef.current = 1;

          markersRef.current.push({
            time: candle.time,
            position: signal === "BIG" ? "aboveBar" : "belowBar",
            color: signal === "BIG" ? "#00ff99" : "#ff3333",
            shape: signal === "BIG" ? "arrowUp" : "arrowDown",
            text: signal === "BIG" ? "B" : "S",
          });
        } else {
          if (signal === predictSideRef.current) {
            // ✅ WIN
            markersRef.current.push({
              time: candle.time,
              position: signal === "BIG" ? "aboveBar" : "belowBar",
              color: "#ffff00",
              shape: "circle",
              text: "WIN",
            });

            loseCountRef.current = 1;
            pauseRef.current = 4; // Win ပြီးရင် ၂ အလှည့် နားမယ်
            predictSideRef.current = null;
          } else {
            // ❌ LOSE (Martingale Tracking)
            loseCountRef.current += 1;

            markersRef.current.push({
              time: candle.time,
              position: predictSideRef.current === "BIG" ? "aboveBar" : "belowBar",
              color: predictSideRef.current === "BIG" ? "#00ff99" : "#ff3333",
              shape: predictSideRef.current === "BIG" ? "arrowUp" : "arrowDown",
              text: `${loseCountRef.current}${predictSideRef.current === "BIG" ? "B" : "S"}`,
            });
          }
        }
      }

      // ==================================================
      // 🔥 CONTRARIAN STREAK SIGNAL (Reversal)
      // ==================================================
      if (signal === "SMALL" && streakRef.current >= 6) {
        markersRef.current.push({
          time: candle.time,
          position: "aboveBar",
          color: "#0077ff",
          shape: "arrowUp",
          text: `REV-B`,
        });
      }

      if (signal === "BIG" && streakRef.current >= 6) {
        markersRef.current.push({
          time: candle.time,
          position: "belowBar",
          color: "#b433ff",
          shape: "arrowDown",
          text: `REV-S`,
        });
      }

      seriesRef.current.setMarkers(markersRef.current);
      loaded.current.add(block);
      return candle;
    } catch (e) {
      console.error("Load block error:", e);
      return null;
    }
  }

  async function start() {
    setStatus("LOADING");
    if (liveRef.current) clearInterval(liveRef.current);

    loaded.current = new Set();
    lastClose.current = 5;
    markersRef.current = [];
    lastSignalRef.current = null;
    streakRef.current = 0;
    historyRef.current = [];
    predictSideRef.current = null;
    pauseRef.current = 0;

    setHover("-");
    setLatest("-");
    setLiveSignal("-");
    setStreak(0);
    setBigPercent(50);
    setSmallPercent(50);
    setTimer(60);
    setTrend("SIDEWAYS");
    setHistoryText([]);
    seriesRef.current.setData([]);

    const latestBlock = await getLatest();
    const inputBlock = startBlock === "" ? latestBlock : Number(startBlock);
    let block = Math.max(0, inputBlock - 1000); //  blocks history

    const candles = [];
    while (block <= latestBlock) {
      const candle = await loadBlock(block);
      if (candle) candles.push(candle);
      block += 20;
    }

    seriesRef.current.setData(candles);
    currentBlock.current = block;
    setStatus("LIVE");

    liveRef.current = setInterval(async () => {
      const latestNow = await getLatest();
      if (currentBlock.current <= latestNow) {
        const candle = await loadBlock(currentBlock.current);
        if (candle) {
          seriesRef.current.update(candle);
          currentBlock.current += 20;
        }
      }
    }, 3000);
  }

  // Timer Loop
  useEffect(() => {
    const t = setInterval(() => {
      setTimer((prev) => (prev <= 1 ? 60 : prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Chart Setup & Responsive Handling
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 600,
      layout: { background: { color: "#111" }, textColor: "#fff" },
      grid: { vertLines: { color: "#222" }, horzLines: { color: "#222" } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    chartRef.current = chart;
    const series = chart.addCandlestickSeries({
      upColor: "#00ff99",
      downColor: "#ff3333",
      borderVisible: false,
      wickUpColor: "#00ff99",
      wickDownColor: "#ff3333",
    });

    seriesRef.current = series;

    chart.subscribeCrosshairMove((p) => {
      setHover(p?.time ? String(p.time) : "-");
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (liveRef.current) clearInterval(liveRef.current);
      chart.remove();
    };
  }, []);

  return (
    <div style={{ background: "#111", minHeight: "100vh", padding: 20, fontFamily: "sans-serif" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", color: "#fff", marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>6Lottery TRX Live Chart & Signal</h2>
        <div style={{ display: "flex", gap: 20 }}>
          <span>Hover: {hover}</span>
          <span>Latest: {latest}</span>
          <span>
            Status: <b style={{ color: status === "LIVE" ? "#00ff99" : "#ffaa00" }}>{status}</b>
          </span>
        </div>
      </div>

      {/* CONTROL ROW */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15 }}>
        <div>
          <input
            placeholder="Start Block Num"
            value={startBlock}
            onChange={(e) => setStartBlock(e.target.value)}
            style={{ padding: "8px 12px", marginRight: 10, background: "#222", border: "1px solid #444", color: "#fff", borderRadius: 4 }}
          />
          <button
            onClick={start}
            style={{ padding: "8px 16px", background: "#0077ff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
          >
            Start Chart
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* HISTORY */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {historyText.map((x, i) => (
              <span key={i} style={{ fontSize: 20, fontWeight: "bold", color: x === "B" ? "#00ff99" : "#ff3333" }}>
                {x}
              </span>
            ))}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: "bold", color: liveSignal === "BIG" ? "#00ff99" : liveSignal === "SMALL" ? "#ff3333" : "#888" }}>
              Result: {liveSignal}
            </div>

            <div style={{ marginTop: 4, display: "flex", gap: 15, justifyContent: "flex-end", fontSize: 14, fontWeight: "bold" }}>
              <span style={{ color: "#fff" }}>Streak: {streak}</span>
              <span style={{ color: "#00ff99" }}>BIG: {bigPercent}%</span>
              <span style={{ color: "#ff3333" }}>SMALL: {smallPercent}%</span>
              <span style={{ color: timer <= 10 ? "#ff3333" : "#ffaa00" }}>Timer: {timer}s</span>
              <span style={{ color: trend === "UP TREND" ? "#00ff99" : trend === "DOWN TREND" ? "#ff3333" : "#999" }}>{trend}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CHART CONTAINER */}
      <div ref={containerRef} style={{ width: "100%", height: 600, border: "1px solid #222", borderRadius: 8 }} />
    </div>
  );
}