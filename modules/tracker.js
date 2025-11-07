import fetch from "node-fetch";
import { EmbedBuilder } from "discord.js";
import config from "../config.json" assert { type: "json" };
import { formatNumber, shortenAddress } from "./utils.js";

const HELIUS_API_KEY = config.heliusKey;
const CACHE = new Map();

export async function trackAllTokens(db, channel) {
  db.each("SELECT contract FROM tokens", (err, row) => {
    if (!err && row?.contract) {
      console.log(`▶ Tracking ${row.contract}`);
      startTracking(row.contract, channel);
    }
  });
}

export async function addToken(db, contract) {
  db.run(`INSERT OR IGNORE INTO tokens VALUES (?)`, [contract]);
}

export async function removeToken(db, contract) {
  db.run(`DELETE FROM tokens WHERE contract=?`, [contract]);
}

async function startTracking(contract, channel) {
  setInterval(async () => {
    try {
      const url = `https://api.helius.xyz/v0/addresses/${contract}/transactions?api-key=${HELIUS_API_KEY}&limit=${config.settings.maxTransactions}`;
      const res = await fetch(url);
      const txs = await res.json();

      if (!Array.isArray(txs) || txs.length === 0) return;

      const lastSeen = CACHE.get(contract);
      const newTxs = lastSeen ? txs.filter(tx => tx.signature !== lastSeen) : txs;

      if (newTxs.length > 0) CACHE.set(contract, newTxs[0].signature);

      for (const tx of newTxs.reverse()) {
        if (tx.tokenTransfers?.length) {
          for (const t of tx.tokenTransfers.filter(tt => tt.mint === contract)) {
            const from = t.fromUserAccount;
            const to = t.toUserAccount;
            const amount = t.tokenAmount / Math.pow(10, t.decimals);
            const action = from && !to ? "Sell" : to && !from ? "Buy" : "Transfer";
            const color = config.settings.embedColors[action.toLowerCase()] || "#aaaaaa";

            const embed = new EmbedBuilder()
              .setTitle(`${action} Detected`)
              .setColor(color)
              .addFields(
                { name: "Amount", value: `${formatNumber(amount)} tokens`, inline: true },
                { name: "From", value: shortenAddress(from), inline: true },
                { name: "To", value: shortenAddress(to), inline: true }
              )
              .setFooter({ text: contract })
              .setTimestamp();

            if (config.settings.showTransactionLinks)
              embed.setURL(`https://solscan.io/tx/${tx.signature}`);

            channel.send({ embeds: [embed] });

            if (config.settings.logToConsole) {
              console.log(`TX: ${action} ${amount} ${contract}`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error tracking ${contract}:`, err);
    }
  }, config.pollInterval);
}

export async function getHoldings(wallet) {
  try {
    const res = await fetch(`https://api.helius.xyz/v0/addresses/${wallet}/balances?api-key=${HELIUS_API_KEY}`);
    const data = await res.json();
    if (!data.tokens) return "No tokens found.";

    return data.tokens
      .map(t => `${shortenAddress(t.mint)} → ${formatNumber(t.amount / Math.pow(10, t.decimals))}`)
      .join("\n");
  } catch (err) {
    return "Error retrieving holdings.";
  }
}
