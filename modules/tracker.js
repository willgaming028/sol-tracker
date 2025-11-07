import fetch from "node-fetch";

const HELIUS_API_KEY = "YOUR_API_KEY_HERE";

// store the last transaction signature per token to avoid duplicates
const lastTxCache = new Map();

export async function trackToken(db, contract, channel) {
  db.run(`INSERT OR IGNORE INTO tokens VALUES (?)`, [contract]);
  console.log(`🟢 Tracking ${contract}`);

  // poll every 500 ms
  setInterval(async () => {
    try {
      const url = `https://api.helius.xyz/v0/addresses/${contract}/transactions?api-key=${HELIUS_API_KEY}&limit=5`;
      const res = await fetch(url);
      const txs = await res.json();

      if (!Array.isArray(txs) || txs.length === 0) return;

      // only process new transactions
      const lastSeen = lastTxCache.get(contract);
      const newTxs = lastSeen
        ? txs.filter((tx) => tx.signature !== lastSeen)
        : txs;

      if (newTxs.length > 0) lastTxCache.set(contract, newTxs[0].signature);

      for (const tx of newTxs.reverse()) {
        if (tx.tokenTransfers?.length) {
          const relevant = tx.tokenTransfers.filter(
            (t) => t.mint === contract
          );
          for (const t of relevant) {
            const from = t.fromUserAccount;
            const to = t.toUserAccount;
            const amount = t.tokenAmount / Math.pow(10, t.decimals);
            const action =
              to && !from ? "Buy" : from && !to ? "Sell" : "Transfer";
            const msg = `💸 **${action}** ${amount} tokens on ${contract}\nFrom: ${from}\nTo: ${to}\n[View TX](https://solscan.io/tx/${tx.signature})`;
            channel.send(msg);
          }
        }
      }
    } catch (err) {
      console.error("❌ Tracker error:", err);
    }
  }, 500); // every 500ms
}

export async function getHoldings(wallet) {
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=${HELIUS_API_KEY}`
    );
    const data = await res.json();
    if (!data.tokens) return "No tokens found.";

    const lines = data.tokens.map(
      (t) =>
        `${t.mint.slice(0, 8)}... → ${t.amount / Math.pow(10, t.decimals)}`
    );
    return lines.join("\n");
  } catch (err) {
    console.error("❌ Error getting holdings:", err);
    return "Error retrieving holdings.";
  }
}
