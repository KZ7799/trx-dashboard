const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) =>
    fetch(...args)
  );
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

let latestSignal = {
  signal: "WAIT",
  block: 0,
};

// TEST API
app.get("/signal", (req, res) => {
  res.json(latestSignal);
});

// TRON DATA LOOP
async function fetchBlock() {
  try {
    const res = await fetch(
      "https://api.trongrid.io/wallet/getnowblock",
      { method: "POST" }
    );

    const json = await res.json();

    const block =
      json.block_header.raw_data.number;

    latestSignal = {
      signal: block % 2 === 0 ? "BIG" : "SMALL",
      block,
    };

    console.log(latestSignal);
  } catch (e) {
    console.log("error", e);
  }
}

setInterval(fetchBlock, 3000);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("SERVER RUNNING ON", PORT);
});