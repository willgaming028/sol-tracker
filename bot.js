import { Client, GatewayIntentBits } from "discord.js";
import sqlite3 from "sqlite3";
import fetch from "node-fetch";
import { trackToken, getHoldings } from "./modules/tracker.js";
import config from "./config.json" assert { type: "json" };

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const db = new sqlite3.Database("db.sqlite");
db.run(`CREATE TABLE IF NOT EXISTS tokens (contract TEXT PRIMARY KEY)`);

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith("!")) return;

  const [cmd, arg] = msg.content.split(" ");
  if (cmd === "!track") {
    if (!arg) return msg.reply("Please provide a contract address.");
    await trackToken(db, arg, msg.channel);
    msg.reply(`Now tracking: ${arg}`);
  }

  if (cmd === "!untrack") {
    db.run(`DELETE FROM tokens WHERE contract=?`, [arg]);
    msg.reply(`Stopped tracking ${arg}`);
  }

  if (cmd === "!holdings") {
    if (!arg) return msg.reply("Please provide a wallet address.");
    const holdings = await getHoldings(arg);
    msg.reply(`Holdings for ${arg}:\n${holdings}`);
  }
});

client.login(config.token);
