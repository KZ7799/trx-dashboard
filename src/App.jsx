import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
} from "lightweight-charts";

export default function App() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const liveRef = useRef(null);

  const loaded = useRef(new Set());
  const lastClose = useRef(5);
  const currentBlock = useRef(0);

  // 🔥 streak refs
  const lastSignalRef = useRef(null);
  const streakRef = useRef(0);

  // 🔥 history refs
  const historyRef = useRef([]);

  const [startBlock, setStartBlock] = useState(82741360);

  const [hover, setHover] = useState("-");
  const [latest, setLatest] = useState("-");
  const [status, setStatus] = useState("STOPPED");

  const [liveSignal, setLiveSignal] = useState("-");
  const [streak, setStreak] = useState(0);

  // 🔥 prediction %
  const [bigPercent, setBigPercent] = useState(50);
  const [smallPercent, setSmallPercent] = useState(50);

  // 🔥 timer
  const [timer, setTimer] = useState(60);

  // 🔥 trend
  const [trend, setTrend] = useState("SIDEWAYS");

  // 🔥 history text
  const [historyText, setHistoryText] =
    useState([]);

  function getDigit(hash) {
    for (let i = hash.length - 1; i >= 0; i--) {
      if (!isNaN(hash[i])) return Number(hash[i]);
    }
    return 0;
  }

  async function getLatest() {
    try {
      const res = await fetch(
        "https://api.trongrid.io/wallet/getnowblock",
        { method: "POST" }
      );

      const json = await res.json();

      return json.block_header.raw_data.number;
    } catch {
      return 0;
    }
  }

  async function loadBlock(block) {
    if (loaded.current.has(block)) return;

    const res = await fetch(
      "https://api.trongrid.io/wallet/getblockbynum",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          num: block,
        }),
      }
    );

    const json = await res.json();

    if (!json.blockID) return;

    const digit = getDigit(json.blockID);

    const big = digit >= 5;

    const signal = big ? "BIG" : "SMALL";

    // 🔥 RESULT TEXT
    setLiveSignal(signal);

    // 🔥 reset timer every candle
    setTimer(60);

    // 🔥 STREAK
    if (lastSignalRef.current === signal) {
      streakRef.current += 1;
    } else {
      streakRef.current = 1;
      lastSignalRef.current = signal;
    }

    setStreak(streakRef.current);

    // 🔥 HISTORY
    const updatedHistory = [
      ...historyRef.current,
      signal,
    ];

    historyRef.current = updatedHistory;

    // latest 14 only
    const latest14 =
      updatedHistory.slice(-14);

    setHistoryText(
      latest14.map((x) =>
        x === "BIG" ? "B" : "S"
      )
    );

    // keep last 20 results
    if (historyRef.current.length > 20) {
      historyRef.current.shift();
    }

    const bigCount =
      historyRef.current.filter(
        (x) => x === "BIG"
      ).length;

    const smallCount =
      historyRef.current.filter(
        (x) => x === "SMALL"
      ).length;

    const total =
      bigCount + smallCount;

    const bigP = Math.round(
      (bigCount / total) * 100
    );

    const smallP = 100 - bigP;

    setBigPercent(bigP);
    setSmallPercent(smallP);

    // 🔥 TREND DETECTOR
    const recent =
      historyRef.current.slice(-5);

    const recentBig =
      recent.filter(
        (x) => x === "BIG"
      ).length;

    const recentSmall =
      recent.filter(
        (x) => x === "SMALL"
      ).length;

    if (recentBig >= 4) {
      setTrend("UP TREND");
    } else if (recentSmall >= 4) {
      setTrend("DOWN TREND");
    } else {
      setTrend("SIDEWAYS");
    }

    const open = lastClose.current;

    const close = big
      ? open + 1
      : open - 1;

    lastClose.current = close;

    const candle = {
      time: Number(block),
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
    };

    seriesRef.current.update(candle);

    loaded.current.add(block);

    setLatest(String(block));
  }

  async function start() {
    setStatus("LOADING");

    if (liveRef.current) {
      clearInterval(liveRef.current);
    }

    loaded.current = new Set();

    lastClose.current = 5;

    // reset
    lastSignalRef.current = null;
    streakRef.current = 0;
    historyRef.current = [];

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

    let block = Number(startBlock);

    while (block <= latestBlock) {
      await loadBlock(block);
      block += 20;
    }

    currentBlock.current = block;

    setStatus("LIVE");

    liveRef.current = setInterval(async () => {
      const latestNow = await getLatest();

      if (currentBlock.current <= latestNow) {
        await loadBlock(currentBlock.current);

        currentBlock.current += 20;
      }
    }, 3000);
  }

  // 🔥 TIMER LOOP
  useEffect(() => {
    const t = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const chart = createChart(
      containerRef.current,
      {
        width: window.innerWidth - 40,
        height: 650,

        layout: {
          background: {
            color: "#111",
          },
          textColor: "#fff",
        },

        grid: {
          vertLines: {
            color: "#222",
          },
          horzLines: {
            color: "#222",
          },
        },

        timeScale: {
          timeVisible: true,
        },
      }
    );

    chartRef.current = chart;

    const series = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#00ff99",
        downColor: "#ff3333",
        borderVisible: false,
      }
    );

    seriesRef.current = series;

    chart.subscribeCrosshairMove((p) => {
      if (!p?.time) {
        setHover("-");
        return;
      }

      setHover(String(p.time));
    });

    return () => {
      if (liveRef.current) {
        clearInterval(liveRef.current);
      }

      chart.remove();
    };
  }, []);

  return (
    <div
      style={{
        background: "#111",
        minHeight: "100vh",
        padding: 20,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#fff",
          marginBottom: 10,
        }}
      >
        <h2 style={{ margin: 0 }}>
          TRON Big/Small Chart
        </h2>

        <div
          style={{
            display: "flex",
            gap: 20,
          }}
        >
          <span>Hover: {hover}</span>

          <span>Latest: {latest}</span>

          <span>Status: {status}</span>
        </div>
      </div>

      {/* CONTROL ROW */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 15,
        }}
      >
        {/* LEFT */}
        <div>
          <input
            value={startBlock}
            onChange={(e) =>
              setStartBlock(e.target.value)
            }
            style={{
              padding: 10,
              marginRight: 10,
            }}
          />

          <button
            onClick={start}
            style={{
              padding: 10,
            }}
          >
            Start
          </button>
        </div>

        {/* RIGHT PANEL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* 🔥 HISTORY */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {historyText.map((x, i) => (
              <span
                key={i}
                style={{
                  fontSize: 22,
                  fontWeight: "bold",
                  color:
                    x === "B"
                      ? "#00ff99"
                      : "#ff3333",
                }}
              >
                {x}
              </span>
            ))}
          </div>

          <div
            style={{
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: "bold",
                letterSpacing: 2,
                color:
                  liveSignal === "BIG"
                    ? "#00ff99"
                    : liveSignal === "SMALL"
                    ? "#ff3333"
                    : "#888",
              }}
            >
              Result: {liveSignal}
            </div>

            {/* 🔥 INFO ROW */}
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 20,
                justifyContent: "flex-end",
                fontSize: 16,
                fontWeight: "bold",
                alignItems: "center",
              }}
            >
              <span style={{ color: "#fff" }}>
                Streak: {streak}
              </span>

              <span style={{ color: "#00ff99" }}>
                BIG %: {bigPercent}%
              </span>

              <span style={{ color: "#ff3333" }}>
                SMALL %: {smallPercent}%
              </span>

              <span
                style={{
                  color:
                    timer <= 10
                      ? "#ff3333"
                      : "#ffaa00",
                }}
              >
                Timer: {timer}s
              </span>

              {/* 🔥 TREND */}
              <span
                style={{
                  color:
                    trend === "UP TREND"
                      ? "#00ff99"
                      : trend === "DOWN TREND"
                      ? "#ff3333"
                      : "#999",
                }}
              >
                {trend}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CHART */}
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 650,
        }}
      />
    </div>
  );
}