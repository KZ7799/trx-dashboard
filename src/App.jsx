import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";

export default function App() {
  const API =
    "https://trx-dashboard-production.up.railway.app/signal";

  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const liveRef = useRef(null);

  const loaded = useRef(new Set());
  const lastClose = useRef(5);
  const currentBlock = useRef(0);

  // 🔥 marker refs
  const markersRef = useRef([]);
  const activeArrowRef = useRef(null);
  const markerPrimitiveRef = useRef(null);
  const predictSideRef = useRef(null);
  const loseCountRef = useRef(1);
  const pauseRef = useRef(0);

  // 🔥 streak refs
  const lastSignalRef = useRef(null);
  const streakRef = useRef(0);

  // 🔥 history refs
  const historyRef = useRef([]);

  const [startBlock, setStartBlock] =
    useState("");

  const [hover, setHover] = useState("-");
  const [latest, setLatest] = useState("-");
  const [status, setStatus] =
    useState("STOPPED");

  const [liveSignal, setLiveSignal] =
    useState("-");

  const [streak, setStreak] = useState(0);

  // 🔥 prediction %
  const [bigPercent, setBigPercent] =
    useState(50);

  const [smallPercent, setSmallPercent] =
    useState(50);

  // 🔥 timer
  const [timer, setTimer] = useState(60);

  // 🔥 trend
  const [trend, setTrend] =
    useState("SIDEWAYS");

  // 🔥 history text
  const [historyText, setHistoryText] =
    useState([]);

  function getDigit(hash) {
    for (
      let i = hash.length - 1;
      i >= 0;
      i--
    ) {
      if (!isNaN(hash[i]))
        return Number(hash[i]);
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

// 🔥 API SIGNAL
  function getSignal(json) {

  try {

    const blockHash =
      json.blockID;

    if (!blockHash ||
       typeof blockHash !== "string"
    ) {
      return "WAIT";
    }

    const digit =
      Number(
        blockHash.slice(-1)
      );

    const signal =
      digit >= 5
       ? "BIG"
       : "SMALL";

     // RESULT ONLY  

    setLiveSignal(signal);

  } catch (e) {
    console.log(e);
  }
}

async function loadBlock(block) {

  if (loaded.current.has(block)) return;

  setLatest(String(block));

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

    const signal = big
      ? "BIG"
      : "SMALL";

    // previous signal
    const prevSignal =
     lastSignalRef.current;

    // 🔥 RESULT TEXT
    setLiveSignal(signal);

    // 🔥 reset timer every candle
    setTimer(60);

    // 🔥 STREAK
    if (
      lastSignalRef.current === signal
    ) {
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

    historyRef.current =
      updatedHistory;

    // latest 20 only
    const latest20 =
      updatedHistory.slice(-20);

    setHistoryText(
      latest20.map((x) =>
        x === "BIG" ? "B" : "S"
      )
    );

    // keep last 20 results
    if (
      historyRef.current.length > 20
    ) {
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

    // 🔥 UPDATE CHART
    

    console.log(markersRef.current);

// ==================================================
// 🔥 B/S TRACKING SYSTEM
// ==================================================

// 🔥 PAUSE MODE
if (pauseRef.current > 0) {
  pauseRef.current -= 1;

} else {

  // first signal
  if (!predictSideRef.current) {

    predictSideRef.current = signal;

    loseCountRef.current = 1;

    markersRef.current.push({
      time: candle.time,

      position:
        signal === "BIG"
          ? "aboveBar"
          : "belowBar",

      color:
        signal === "BIG"
          ? "#00ff99"
          : "#ff3333",

      shape:
        signal === "BIG"
          ? "arrowUp"
          : "arrowDown",

      text:
        signal === "BIG"
          ? "B"
          : "S",
    });

  } else {

    // ✅ WIN
    if (
      signal ===
      predictSideRef.current
    ) {

      markersRef.current.push({
        time: candle.time,

        position:
          signal === "BIG"
            ? "aboveBar"
            : "belowBar",

        color: "#ffff00",

        shape: "circle",
          
        text: "W",
      });

      // 🔥 RESET
      loseCountRef.current = 1;

      // 🔥 PAUSE RANDOM CANDLES
      pauseRef.current = 
      Math.floor(Math.random()*5)+3;

      // 🔥 CLEAR CURRENT SIDE
      predictSideRef.current = null;

    } else {

      // ❌ LOSE
      loseCountRef.current += 1;

      markersRef.current.push({
        time: candle.time,

        position:
          predictSideRef.current ===
          "BIG"
            ? "aboveBar"
            : "belowBar",

        color:
          predictSideRef.current ===
          "BIG"
            ? "#00ff99"
            : "#ff3333",

        shape:
          predictSideRef.current ===
          "BIG"
            ? "arrowUp"
            : "arrowDown",

        text:
          `${loseCountRef.current}${
            predictSideRef.current ===
            "BIG"
              ? "B"
              : "S"
          }`,
      });

      // keep tracking same side
    }
  }
}

// ==================================================
// 🔥 CONTRARIAN STREAK SIGNAL
// ==================================================

// 🟢 SMALL streak -> predict BIG
if (
  signal === "SMALL" &&
  streakRef.current >= 6
) {
  const count =
    streakRef.current - 5;

  markersRef.current.push({
    time: candle.time,

    position: "aboveBar",

    color: "#00ff99",

    shape: "arrowUp",

    text: `${count}B`,
  });
}

// 🔴 BIG streak -> predict SMALL
if (
  signal === "BIG" &&
  streakRef.current >= 6
) {
  const count =
    streakRef.current - 5;

  markersRef.current.push({
    time: candle.time,

    position: "belowBar",

    color: "#ff3333",

    shape: "arrowDown",

    text: `${count}S`,
  });
}

seriesRef.current.setMarkers(
  markersRef.current
);

// ==================================================

    loaded.current.add(block);

    return candle;

  }

  async function start() {

    setStatus("LOADING");

    const candles = [];
      
    if (liveRef.current) {
      clearInterval(liveRef.current);
    }

    loaded.current = new Set();

    lastClose.current = 5;

    markersRef.current = [];

    activeArrowRef.current = null;

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

    const latestBlock =
      await getLatest();

    const inputBlock =
      startBlock === ""
        ? latestBlock
        : Math.min(
          Number(startBlock)
        );

    let block = Math.max(0, inputBlock - 2000);

    while (block <= latestBlock) {

      console.log("LOADING BLOCK", block);

    const candle =
      await loadBlock(block);

      if (candle) {
        candles.push(candle);
      }

      await new Promise(
        (r) => setTimeout(r, 300)
      );

      block += 20;
      
    }

    seriesRef.current.setData(
      candles

    );

    currentBlock.current = block;

    setStatus("LIVE");

    liveRef.current = setInterval(
      async () => {
        const latestNow =
          await getLatest();

        if (
          currentBlock.current <=
          latestNow
        ) {

          console.log(
            "LIVE BLOCK",
            currentBlock.current
          );
        const candle =
          await loadBlock(
            currentBlock.current, true
          );

        if (candle) {
          seriesRef.current.update(
            candle
          );
        
          currentBlock.current += 20;
          }
        }
      },
      3000
    );
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

  // 🔥 API AUTO UPDATE
  useEffect(() => {
    getSignal();

    const t = setInterval(async () => {

      try {

      const res = await fetch(API);
      const json = await res.json();

      const signal = getSignal(json);

      } catch (e) {
        console.log("API error", e)
      }

    }, 3000);

    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const chart = createChart(
      containerRef.current,
      {
        width:
          window.innerWidth - 40,

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

    const series = chart.addCandlestickSeries({
  upColor: "#00ff99",
  downColor: "#ff3333",
  borderVisible: false,
});

    seriesRef.current = series;

    chart.subscribeCrosshairMove(
      (p) => {
        if (!p?.time) {
          setHover("-");

          return;
        }

        setHover(String(p.time));
      }
    );

    return () => {
      if (liveRef.current) {
        clearInterval(
          liveRef.current
        );
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

          justifyContent:
            "space-between",

          color: "#fff",

          marginBottom: 10,
        }}
      >
        <h2 style={{ margin: 0 }}>
          TRX Win Big/Small Chart
        </h2>

        <div
          style={{
            display: "flex",

            gap: 20,
          }}
        >
          <span>
            Hover: {hover}
          </span>

          <span>
            Latest: {latest}
          </span>

          <span>
            Status: {status}
          </span>
        </div>
      </div>

      {/* CONTROL ROW */}
      <div
        style={{
          display: "flex",

          justifyContent:
            "space-between",

          alignItems: "center",

          marginBottom: 15,
        }}
      >
        {/* LEFT */}
        <div>
          <input
            value={startBlock}
            onChange={(e) =>
              setStartBlock(
                e.target.value
              )
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
            {historyText.map(
              (x, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 22,

                    fontWeight:
                      "bold",

                    color:
                      x === "B"
                        ? "#00ff99"
                        : "#ff3333",
                  }}
                >
                  {x}
                </span>
              )
            )}
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
                  liveSignal ===
                  "BIG"
                    ? "#00ff99"
                    : liveSignal ===
                      "SMALL"
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

                justifyContent:
                  "flex-end",

                fontSize: 16,

                fontWeight: "bold",

                alignItems:
                  "center",
              }}
            >
              <span
                style={{
                  color: "#fff",
                }}
              >
                Streak: {streak}
              </span>

              <span
                style={{
                  color: "#00ff99",
                }}
              >
                BIG %: {bigPercent}%
              </span>

              <span
                style={{
                  color: "#ff3333",
                }}
              >
                SMALL %:{" "}
                {smallPercent}%
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
                    trend ===
                    "UP TREND"
                      ? "#00ff99"
                      : trend ===
                        "DOWN TREND"
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