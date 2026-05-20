import { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { use } from "react";

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

  const pendingPredictionRef =
    useRef("WAIT");

  const [prediction, setPrediction] =
    useState("WAIT");

  const [winCount, setWinCount] =
    useState(0);

  const [loseCount, setLoseCount] =
    useState(0);
 
  const [signalWin, setSignalWin] =
    useState(0);

  const [signalLose, setSignalLose] =
    useState(0);

  const [aiSignal, setAiSignal] =
    useState("WAIT");

  const [aiConfidence, setAiConfidence] =
    useState(0);

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
async function getSignal() {
  try {
    const res = await fetch(API);

    const data = await res.json();

    // RESULT ONLY
    setLiveSignal(signal);

  } catch (e) {
    console.log(e);
  }
}

async function loadBlock(block) {

  try {

   if (loaded.current.has(block))
     return false;

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

  if (!json.blockID) return false;

  setLatest(String(block));

    const digit = getDigit(json.blockID);

    const big = digit >= 5;

    const signal = big
      ? "BIG"
      : "SMALL";
  
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

    const candleCount =
      historyRef.current.length

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

// ==================================================
// 🔥 PREDICTION SYSTEM
// ==================================================

let nextPrediction = "WAIT";

if (candleCount >= 20) {

  if (trend === "SIDEWAYS") {

  // latest SMALL + small%=50
  if (
    signal === "SMALL" &&
    smallP === 50
  ) {
    nextPrediction = "SMALL";
  }

  // latest BIG + small%=60
  else if (
    signal === "BIG" &&
    smallP === 60
  ) {
    nextPrediction = "BIG";
  }
 }

}

setPrediction(nextPrediction);

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
    seriesRef.current.update(candle);

// ==================================================
// 🔥 CHECK PREVIOUS PREDICTION
// ==================================================

if (
  pendingPredictionRef.current !==
  "WAIT"
) {

  if (
    pendingPredictionRef.current ===
    signal
  ) {

    setSignalWin(prev => prev + 1);

  } else {

    setSignalLose(prev => prev + 1);

  }

}

setPrediction(nextPrediction);

pendingPredictionRef.current =
  nextPrediction;

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
// 🔥 AI SIGNAL SYSTEM
// ==================================================

if (historyRef.current.length >= 20) {

  let bigScore = 0;
  let smallScore = 0;

  // 🔥 TREND
  if (trend === "UP TREND") {
    bigScore += 2;
  }

  if (trend === "DOWN TREND") {
    smallScore += 2;
  }

  // 🔥 PERCENT
  if (bigPercent >= 60) {
    bigScore += 1;
  }

  if (smallPercent >= 60) {
    smallScore += 1;
  }

  // 🔥 STREAK REVERSAL
  if (
    signal === "BIG" &&
    streakRef.current >= 4
  ) {
    smallScore += 2;
  }

  if (
    signal === "SMALL" &&
    streakRef.current >= 4
  ) {
    bigScore += 2;
  }

  // 🔥 LAST 3 PATTERN
  const last3 =
    historyRef.current.slice(-3);

  const pattern =
    last3.join("-");

  if (pattern === "BIG-BIG-BIG") {
    smallScore += 1;
  }

  if (
    pattern ===
    "SMALL-SMALL-SMALL"
  ) {
    bigScore += 1;
  }

  // ==================================================
  // FINAL AI RESULT
  // ==================================================

  const totalScore =
    bigScore + smallScore;

  if (bigScore > smallScore) {

    setAiSignal("BIG");

    setAiConfidence(
      Math.round(
        (bigScore / totalScore) * 100
      )
    );

    markersRef.current.push({
  time: candle.time,

  position: "belowBar",

  color: "#00ccff",

  shape: "arrowUp",

  text: `AI B ${Math.round(
    (bigScore / totalScore) * 100
  )}%`,
});

  } else if (
    smallScore > bigScore
  ) {

    setAiSignal("SMALL");

    setAiConfidence(
      Math.round(
        (smallScore / totalScore) * 100
      )
    );

    markersRef.current.push({
  time: candle.time,

  position: "aboveBar",

  color: "#ff00aa",

  shape: "arrowDown",

  text: `AI S ${Math.round(
    (smallScore / totalScore) * 100
  )}%`,
});

  } else {

    setAiSignal("WAIT");

    setAiConfidence(50);

  }
}

// 🔥 ALL YOUR EXISTING CODE

  loaded.current.add(block);

  return true;

} catch (e) {

  console.log("BLOCK ERROR", e);

  return false;
  }

}

// ==================================================

  async function start() {
    setStatus("LOADING");

    if (liveRef.current) {
      clearInterval(liveRef.current);
    }

    loaded.current = new Set();

    lastClose.current = 5;

    markersRef.current = [];

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

    pendingPredictionRef.current =
      "WAIT";

    const latestBlock =
      await getLatest();

    let block = Number(startBlock);

    while (block <= latestBlock) {
      await loadBlock(block);

      block += 20;
    }

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
        const ok = await loadBlock(
            currentBlock.current
          );

          if (ok) {
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

    const t = setInterval(() => {
      getSignal();
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

        <div
  style={{
    marginTop: 10,
    fontSize: 18,
    fontWeight: "bold",
    lineHeight: 1.8,
  }}
>
  <div
    style={{
      color:
        aiSignal === "BIG"
          ? "#00ff99"
          : aiSignal === "SMALL"
          ? "#ff3333"
          : "#999",
    }}
  >
    AI Signal: {aiSignal}
  </div>

  <div style={{ color: "#ffaa00" }}>
    Confidence: {aiConfidence}%
  </div>

  <div style={{ color: "#fff" }}>
    Win: {signalWin}
    {" / "}
    Lose: {signalLose}
  </div>
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

              gap: 3,

              alignItems: "center",
                         
              flexWrap: "wrap",
            }}
          >
            {historyText.map(
              (x, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 16,

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
              gap: 20,
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