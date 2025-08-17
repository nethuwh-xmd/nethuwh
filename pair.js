const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const router = express.Router();
const pino = require('pino');
const { Octokit } = require('@octokit/rest');
const moment = require('moment-timezone');
const Jimp = require('jimp');
const crypto = require('crypto');
const axios = require('axios');
const yts = require("yt-search");
const fetch = require("node-fetch"); 
const api = `https://delirius-apiofc.vercel.app/`;
const apikey = `edbcfabbca5a9750`;
const { initUserEnvIfMissing } = require('./settingsdb');
const { initEnvsettings, getSetting } = require('./settings');
const DY_SCRAP = require('@dark-yasiya/scrap');
const dy_scrap = new DY_SCRAP();

//=======================================
const autoReact = getSetting('AUTO_REACT') || 'on';

//=======================================
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    jidNormalizedUser,
    proto,
    prepareWAMessageMedia,
    generateWAMessageFromContent
} = require('@whiskeysockets/baileys');
//=======================================
const config = {
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_RECORDING: 'true',
    AUTO_LIKE_EMOJI: ['🧩', '🍉', '💜', '🌸', '🪴', '💊', '💫', '🍂', '🌟', '🎋', '😶‍🌫️', '🫀', '🧿', '👀', '🤖', '🚩', '🥰', '🗿', '💜', '💙', '🌝', '🖤', '💚'],
    PREFIX: '.',
    MAX_RETRIES: 3,
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/IMM3C4NUsetDCqZGGJ0eU8?mode=ac_t',
    ADMIN_LIST_PATH: './admin.json',
    IMAGE_PATH: 'https://files.catbox.moe/9nbk1t.jpg',
    NEWSLETTER_JID: '120363402466616623@newsletter',
    NEWSLETTER_MESSAGE_ID: '428',
    OTP_EXPIRY: 300000,
    NEWS_JSON_URL: '',
    BOT_NAME: '𝙽𝙴𝚃𝙷𝚄𝚆𝙷-𝚇𝙼𝙳-𝙼𝙸𝙽𝙸-𝙱𝙾𝚃-𝚅1 📌',
    OWNER_NAME: '𝕹𝕰𝕿𝕳𝖀𝖂𝕳',
    OWNER_NUMBER: '94740021158',
    BOT_VERSION: '1.0.0',
    BOT_FOOTER: '> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ɴᴇᴛʜᴜᴡʜ xᴍᴅ 🎭',
    CHANNEL_LINK: 'https://whatsapp.com/channel/0029Vb6gcq74NVij8LWJKy1D',
    BUTTON_IMAGES: {
        ALIVE: 'https://i.ibb.co/gb7KmtT5/jpg.jpg',
        MENU: 'https://i.ibb.co/gb7KmtT5/jpg.jpg',
        OWNER: 'https://i.ibb.co/gb7KmtT5/jpg.jpg',
        SONG: 'https://files.catbox.moe/xw7gz1.jpg',
        VIDEO: 'https://files.catbox.moe/xw7gz1.jpg'
    }
};

// List Message Generator
function generateListMessage(text, buttonTitle, sections) {
    return {
        text: text,
        footer: config.BOT_FOOTER,
        title: buttonTitle,
        buttonText: "Select",
        sections: sections
    };
}
//=======================================
// Button Message Generator with Image Support
function generateButtonMessage(content, buttons, image = null) {
    const message = {
        text: content,
        footer: config.BOT_FOOTER,
        buttons: buttons,
        headerType: 1 // Default to text header
    };

    // Add image if provided
    if (image) {
        message.headerType = 4; // Image header
        message.image = typeof image === 'string' ? { url: image } : image;
    }

    return message;
}
//=======================================
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});
const owner = process.env.GITHUB_REPO_OWNER;
const repo = process.env.GITHUB_REPO_NAME;

const activeSockets = new Map();
const socketCreationTime = new Map();
const SESSION_BASE_PATH = './session';
const NUMBER_LIST_PATH = './numbers.json';
const otpStore = new Map();

if (!fs.existsSync(SESSION_BASE_PATH)) {
    fs.mkdirSync(SESSION_BASE_PATH, { recursive: true });
}
//=======================================
function loadAdmins() {
    try {
        if (fs.existsSync(config.ADMIN_LIST_PATH)) {
            return JSON.parse(fs.readFileSync(config.ADMIN_LIST_PATH, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Failed to load admin list:', error);
        return [];
    }
}
function formatMessage(title, content, footer) {
    return `${title}\n\n${content}\n\n${footer}`;
}
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function getSriLankaTimestamp() {
    return moment().tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss');
}
async function cleanDuplicateFiles(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith(`empire_${sanitizedNumber}_`) && file.name.endsWith('.json')
        ).sort((a, b) => {
            const timeA = parseInt(a.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            const timeB = parseInt(b.name.match(/empire_\d+_(\d+)\.json/)?.[1] || 0);
            return timeB - timeA;
        });

        const configFiles = data.filter(file => 
            file.name === `config_${sanitizedNumber}.json`
        );

        if (sessionFiles.length > 1) {
            for (let i = 1; i < sessionFiles.length; i++) {
                await octokit.repos.deleteFile({
                    owner,
                    repo,
                    path: `session/${sessionFiles[i].name}`,
                    message: `Delete duplicate session file for ${sanitizedNumber}`,
                    sha: sessionFiles[i].sha
                });
                console.log(`Deleted duplicate session file: ${sessionFiles[i].name}`);
            }
        }

        if (configFiles.length > 1) {
            console.log(`Config file for ${sanitizedNumber} already exists`);
        }
    } catch (error) {
        console.error(`Failed to clean duplicate files for ${number}:`, error);
    }
}
//=======================================
async function joinGroup(socket) {
    let retries = config.MAX_RETRIES;
    const inviteCodeMatch = config.GROUP_INVITE_LINK.match(/chat\.whatsapp\.com\/([a-zA-Z0-9]+)/);
    if (!inviteCodeMatch) {
        console.error('Invalid group invite link format');
        return { status: 'failed', error: 'Invalid group invite link' };
    }
    const inviteCode = inviteCodeMatch[1];

    while (retries > 0) {
        try {
            const response = await socket.groupAcceptInvite(inviteCode);
            if (response?.gid) {
                console.log(`Successfully joined group with ID: ${response.gid}`);
                return { status: 'success', gid: response.gid };
            }
            throw new Error('No group ID in response');
        } catch (error) {
            retries--;
            let errorMessage = error.message || 'Unknown error';
            if (error.message.includes('not-authorized')) {
                errorMessage = 'Bot is not authorized to join (possibly banned)';
            } else if (error.message.includes('conflict')) {
                errorMessage = 'Bot is already a member of the group';
            } else if (error.message.includes('gone')) {
                errorMessage = 'Group invite link is invalid or expired';
            }
            console.warn(`Failed to join group, retries left: ${retries}`, errorMessage);
            if (retries === 0) {
                return { status: 'failed', error: errorMessage };
            }
            await delay(2000 * (config.MAX_RETRIES - retries));
        }
    }
    return { status: 'failed', error: 'Max retries reached' };
}
//=======================================
async function sendAdminConnectMessage(socket, number, groupResult) {
    const admins = loadAdmins();
    const groupStatus = groupResult.status === 'success'
        ? `Joined (ID: ${groupResult.gid})`
        : `Failed to join group: ${groupResult.error}`;
    const caption = formatMessage(
        '*Connected Successful ✅*',
        `📞 Number: ${number}\n🩵 Status: Online`,
        `${config.BOT_FOOTER}`
    );

    for (const admin of admins) {
        try {
            await socket.sendMessage(
                `${admin}@s.whatsapp.net`,
                {
                    image: { url: config.IMAGE_PATH },
                    caption
                }
            );
        } catch (error) {
            console.error(`Failed to send connect message to admin ${admin}:`, error);
        }
    }
}
//=======================================
async function sendOTP(socket, number, otp) {
    const userJid = jidNormalizedUser(socket.user.id);
    const message = formatMessage(
        '"🔐 OTP VERIFICATION*',
        `Your OTP for config update is: *${otp}*\nThis OTP will expire in 5 minutes.`,
        `${config.BOT_FOOTER}`
    );

    try {
        await socket.sendMessage(userJid, { text: message });
        console.log(`OTP ${otp} sent to ${number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${number}:`, error);
        throw error;
    }
}
//=======================================
function setupNewsletterHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== config.NEWSLETTER_JID) return;

        try {
            const emojis = ['❤️', '💯','📢','🤖'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            const messageId = message.newsletterServerId;

            if (!messageId) {
                console.warn('No valid newsletterServerId found:', message);
                return;
            }

            let retries = config.MAX_RETRIES;
            while (retries > 0) {
                try {
                    await socket.newsletterReactMessage(
                        config.NEWSLETTER_JID,
                        messageId.toString(),
                        randomEmoji
                    );
                    console.log(`Reacted to newsletter message ${messageId} with ${randomEmoji}`);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to react to newsletter message ${messageId}, retries left: ${retries}`, error.message);
                    if (retries === 0) throw error;
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
        } catch (error) {
            console.error('Newsletter reaction error:', error);
        }
    });
}
//=======================================
async function setupStatusHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const message = messages[0];
        if (!message?.key || message.key.remoteJid !== 'status@broadcast' || !message.key.participant || message.key.remoteJid === config.NEWSLETTER_JID) return;

        try {
            if (autoReact === 'on' && message.key.remoteJid) {
                await socket.sendPresenceUpdate("recording", message.key.remoteJid);
            }

            if (config.AUTO_VIEW_STATUS === 'true') {
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.readMessages([message.key]);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to read status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }

            if (config.AUTO_LIKE_STATUS === 'true') {
                const randomEmoji = config.AUTO_LIKE_EMOJI[Math.floor(Math.random() * config.AUTO_LIKE_EMOJI.length)];
                let retries = config.MAX_RETRIES;
                while (retries > 0) {
                    try {
                        await socket.sendMessage(
                            message.key.remoteJid,
                            { react: { text: randomEmoji, key: message.key } },
                            { statusJidList: [message.key.participant] }
                        );
                        console.log(`Reacted to status with ${randomEmoji}`);
                        break;
                    } catch (error) {
                        retries--;
                        console.warn(`Failed to react to status, retries left: ${retries}`, error);
                        if (retries === 0) throw error;
                        await delay(1000 * (config.MAX_RETRIES - retries));
                    }
                }
            }
        } catch (error) {
            console.error('Status handler error:', error);
        }
    });
}
//=======================================
async function handleMessageRevocation(socket, number) {
    socket.ev.on('messages.delete', async ({ keys }) => {
        if (!keys || keys.length === 0) return;

        const messageKey = keys[0];
        const userJid = jidNormalizedUser(socket.user.id);
        const deletionTime = getSriLankaTimestamp();
        
        const message = formatMessage(
            '╭──◯',
            `│ \`ＤＥＬＥＴＥ\`\n│ *⦁ From :* ${messageKey.remoteJid}\n│ *⦁ Time:* ${deletionTime}\n│ *⦁ Type: Normal*\n╰──◯`,
            `${config.BOT_FOOTER}`
        );

        try {
            await socket.sendMessage(userJid, {
                image: { url: config.IMAGE_PATH },
                caption: message
            });
            console.log(`Notified ${number} about message deletion: ${messageKey.id}`);
        } catch (error) {
            console.error('Failed to send deletion notification:', error);
        }
    });
}

// Image resizing function
async function resize(image, width, height) {
    let oyy = await Jimp.read(image);
    let kiyomasa = await oyy.resize(width, height).getBufferAsync(Jimp.MIME_JPEG);
    return kiyomasa;
}

// Capitalize first letter
function capital(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Generate serial
const createSerial = (size) => {
    return crypto.randomBytes(size).toString('hex').slice(0, size);
}

// Send slide with news items
async function SendSlide(socket, jid, newsItems) {
    let anu = [];
    for (let item of newsItems) {
        let imgBuffer;
        try {
            imgBuffer = await resize(item.thumbnail, 300, 200);
        } catch (error) {
            console.error(`Failed to resize image for ${item.title}:`, error);
            imgBuffer = await Jimp.read('https://i.ibb.co/qFJ08v4J/da3ed85877e73e60.jpg');
            imgBuffer = await imgBuffer.resize(300, 200).getBufferAsync(Jimp.MIME_JPEG);
        }
        let imgsc = await prepareWAMessageMedia({ image: imgBuffer }, { upload: socket.waUploadToServer });
        anu.push({
            body: proto.Message.InteractiveMessage.Body.fromObject({
                text: `*${capital(item.title)}*\n\n${item.body}`
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
                hasMediaAttachment: true,
                ...imgsc
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: [
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐃𝙴𝙿𝙻𝙾𝚈","url":"https:/","merchant_url":"https://www.google.com"}`
                    },
                    {
                        name: "cta_url",
                        buttonParamsJson: `{"display_text":"𝐂𝙾𝙽𝚃𝙰𝙲𝚃","url":"https","merchant_url":"https://www.google.com"}`
                    }
                ]
            })
        });
    }
    const msgii = await generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                    body: proto.Message.InteractiveMessage.Body.fromObject({
                        text: "*Latest News Updates*"
                    }),
                    carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
                        cards: anu
                    })
                })
            }
        }
    }, { userJid: jid });
    return socket.relayMessage(jid, msgii.message, {
        messageId: msgii.key.id
    });
}

// Fetch news from API
async function fetchNews() {
    try {
        const response = await axios.get(config.NEWS_JSON_URL);
        return response.data || [];
    } catch (error) {
        console.error('Failed to fetch news from raw JSON URL:', error.message);
        return [];
    }
}

// Command handlers
const commandHandlers = {
    alive: async (socket, sender, msg) => {
        const startTime = socketCreationTime.get(socket.user.id.split(':')[0]) || Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        await socket.sendMessage(sender, {
            react: { text: "⚡", key: msg.key }
        });

        const title = '𝗡𝗘𝗧𝗛𝗨𝗪𝗛 𝗫𝗠𝗗 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 𝗩1 ⚡';
        const content = `
┏━━👨‍💻* BOT INFO *🧑‍💻━━┓
┃ 🤖 *Name:* ${config.BOT_NAME}
┃ 👑 *Owner:* ${config.OWNER_NAME}
┃ 🏷️ *Version:* ${config.BOT_VERSION}
┃ ☁️ *Platform:* Heroku
┃ ⏳ *Uptime:* ${hours}h ${minutes}m ${seconds}s
┗━━━━━━━━━━━━━━━━━━┛

🌐 *Website:* Coming Soon...
💌 *Thanks for using ${config.BOT_NAME}!*`.trim();

        const footer = `💠 ${config.BOT_FOOTER} 💠`;

        await socket.sendMessage(sender, {
            image: { url: config.BUTTON_IMAGES.ALIVE },
            caption: formatMessage(title, content, footer),
            buttons: [
                { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📜 MENU' }, type: 1 },
                { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: '💥 PING' }, type: 1 }
            ],
            headerType: 4,
            quoted: msg
        });
    },

    menu: async (socket, sender, msg) => {
        const number = socket.user.id.split(':')[0];
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        await socket.sendMessage(sender, { 
            react: { 
                text: "📜",
                key: msg.key 
            } 
        });

        const title = "𝗡𝗘𝗧𝗛𝗨𝗪𝗛 𝗫𝗠𝗗 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 𝗩1 𝗠𝗘𝗡𝗨 👀  ";
        const text = `
╭───❏ *BOT STATUS* ❏
│ 🤖 *Bot Name*: ɴᴇᴛʜᴜᴡʜ xᴍᴅ
│ 👑 *Owner*: ɴᴇᴛʜᴜᴡʜ
│ 🏷️ *Version*: 0.0001+
│ ☁️ *Platform*: Heroku
│ ⏳ *Uptime*: ${hours}h ${minutes}m ${seconds}s
╰───────────────❏
   *ᴀʟɪᴠᴇ*     🤖
   *ᴘɪɴɢ*       🤖
   *ꜱʏꜱᴛᴇᴍ*  🤖
   *ᴊɪᴅ*          🤖     
   *ᴀᴄᴛɪᴠᴇ*   🤖 
   *ʙᴏᴏᴍ*    🤖  
   *ꜱᴏɴɢ*     🤖  
   *ɪɢ*           🤖
   
   *DEPLOY AND SHARE MY BOT 😩💔*
   *ENJOY MY BOT 🎉️*`.trim();

        const buttons = [
            { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: ".Alive" }, type: 1 },
            { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: " .Ping" }, type: 1 },
        ];

        await socket.sendMessage(sender, {
            image: { url: "https://i.ibb.co/gb7KmtT5/jpg.jpg" },
            caption: text,
            footer: "🄽🄴🅃🄷🅄🅆🄷 🅇🄼🄳 💥",
            buttons: buttons,
            headerType: 4
        });
    },

case 'song88': {
    if (!args.join(" ")) 
        return sock.sendMessage(from, { text: "👉 Song name denna\n\nExample: .song Believer" }, { quoted: msg });

    const search = args.join(" ");
    try {
        let { data } = await axios.get(`https://api.akuari.my.id/downloader/ytplay?query=${encodeURIComponent(search)}`);

        if (data.result && data.result.url) {
            await sock.sendMessage(
                from,
                {
                    audio: { url: data.result.url },
                    mimetype: "audio/mpeg",
                    fileName: search + ".mp3",
                    contextInfo: {
                        externalAdReply: {
                            title: `🎶 ${search}`,
                            body: "Powered by NETHUWH Mini Bot",
                            mediaType: 2,
                            thumbnailUrl: "https://i.ibb.co/bR26QxBS/70285ba0b204407c.jpg",
                            sourceUrl: "https://whatsapp.com/channel/0029VaABcdS2Q1sPFO8T2Y0k"
                        }
                    }
                },
                { quoted: msg }
            );

            // ➕ Return Menu Button
            await sock.sendMessage(from, {
                text: "✅ Song Download Complete!\n\n🔙 Press below to go back to menu.",
                buttons: [
                    { buttonId: "menu", buttonText: { displayText: "🏠 Return Menu" }, type: 1 }
                ],
                headerType: 1
            }, { quoted: msg });

        } else {
            await sock.sendMessage(from, { text: "❌ Song not found (API error)" }, { quoted: msg });
        }
    } catch (e) {
        await sock.sendMessage(from, { text: "❌ Error: Song API fail." }, { quoted: msg });
    }
}
break;
    
    ping: async (socket, sender, msg) => {
        var inital = new Date().getTime();
        let pingMsg = await socket.sendMessage(sender, { text: '*_Pinging to 𝗡𝗘𝗧𝗛𝗨𝗪𝗛 𝗫𝗠𝗗 🪢 Module..._* ❗' });
        var final = new Date().getTime();
        
        await Promise.all([
            socket.sendMessage(sender, { text: '《 █▒▒▒▒▒▒▒▒▒▒▒》10%', edit: pingMsg.key }),
            delay(500),
            socket.sendMessage(sender, { text: '《 ████▒▒▒▒▒▒▒▒》30%', edit: pingMsg.key }),
            delay(500),
            socket.sendMessage(sender, { text: '《 ███████▒▒▒▒▒》50%', edit: pingMsg.key }),
            delay(500),
            socket.sendMessage(sender, { text: '《 ██████████▒▒》80%', edit: pingMsg.key }),
            delay(500),
            socket.sendMessage(sender, { text: '《 ████████████》100%', edit: pingMsg.key }),
            delay(500)
        ]);
        
        await socket.sendMessage(sender, {
            text: `*Pong ${(final - inital)} Ms*`, 
            edit: pingMsg.key 
        });
    },

    system: async (socket, sender, msg) => {
        const number = socket.user.id.split(':')[0];
        const startTime = socketCreationTime.get(number) || Date.now();
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        await socket.sendMessage(sender, { 
            react: { 
                text: "☄️",
                key: msg.key 
            } 
        });

        const title = "𝗡𝗘𝗧𝗛𝗨𝗪𝗛 𝗫𝗠𝗗 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 𝗩1 𝗦𝗬𝗦𝗧𝗘𝗠 👀";
        const content = `
╭───❏ *SYSTEM STATUS* ❏
│ 🤖 *Bot Name*: ${config.BOT_NAME}
│ 🏷️ *Version*: ${config.BOT_VERSION}
│ ☁️ *Platform*: Heroku
│ ⏳ *Uptime*: ${hours}h ${minutes}m ${seconds}s
│ 👑 *Owner*: ${config.OWNER_NAME}
╰───────────────❏`.trim();

        await socket.sendMessage(sender, {
            image: { url: config.IMAGE_PATH },
            caption: content,
            footer: config.BOT_FOOTER,
            headerType: 4
        });
    },

    jid: async (socket, sender, msg) => {
        const userNumber = sender.split('@')[0];
        await socket.sendMessage(sender, { 
            react: { 
                text: "🆔",
                key: msg.key 
            } 
        });

        await socket.sendMessage(sender, {
            text: `
*🆔 Chat JID:* ${sender}
*📞 Your Number:* +${userNumber}
*ᴺᴱᵀᴴᵁᵂᴴ ˣᴹᴰ ᴹᴵᴺᴵ ᴮᴼᵀ ⱽ1 ᴶᴵᴰ ˢᵁᶜᶜᴱˢˢ 🌝:*`.trim()
        });
    },

    boom: async (socket, sender, msg, args) => {
        if (args.length < 2) {
            return await socket.sendMessage(sender, { 
                text: "💀 *Usage:* `.boom <count> <message>`\n📌 *Example:* `.boom 100 Dss*`" 
            });
        }

        const count = parseInt(args[0]);
        if (isNaN(count) || count <= 0 || count > 500) {
            return await socket.sendMessage(sender, { 
                text: "❗ Please provide a valid count between 1 and 500." 
            });
        }

        const message = args.slice(1).join(" ");
        for (let i = 0; i < count; i++) {
            await socket.sendMessage(sender, { text: message });
            await delay(500);
        }
    },

    active: async (socket, sender, msg) => {
        const activeBots = Array.from(activeSockets.keys());
        const count = activeBots.length;

        await socket.sendMessage(sender, {
            react: {
                text: "⚡",
                key: msg.key
            }
        });

        let message = `*𝗡𝗘𝗧𝗛𝗨𝗪𝗛 𝗫𝗠𝗗 𝗠𝗜𝗡𝗜 𝗕𝗢𝗧 𝗔𝗖𝗧𝗜𝗩𝗘 🫆*\n`;
        message += `━━━━━━━━━━━━━━━\n`;
        message += `📊 *Total Active Bots:* ${count}\n\n`;

        if (count > 0) {
            message += activeBots
                .map((num, i) => {
                    const uptimeSec = socketCreationTime.get(num)
                        ? Math.floor((Date.now() - socketCreationTime.get(num)) / 1000)
                        : null;
                    const hours = uptimeSec ? Math.floor(uptimeSec / 3600) : 0;
                    const minutes = uptimeSec ? Math.floor((uptimeSec % 3600) / 60) : 0;
                    return `*${i + 1}.* 📱 +${num} ${uptimeSec ? `⏳ ${hours}h ${minutes}m` : ''}`;
                })
                .join('\n');
        } else {
            message += "_No active bots currently_\n";
        }

        message += `\n━━━━━━━━━━━━━━━\n`;
        message += `👑 *Owner:* ${config.OWNER_NAME}\n`;
        message += `🤖 *Bot:* ${config.BOT_NAME}`;

        await socket.sendMessage(sender, { text: message });
    },

    song4: async (socket, sender, msg) => {
        try {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
            const q = text.split(" ").slice(1).join(" ").trim();
            if (!q) {
                await socket.sendMessage(sender, { 
                    text: '*🚫 Please enter a song name to search.*',
                    buttons: [
                        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
                    ]
                });
                return;
            }

            const searchResults = await yts(q);
            if (!searchResults.videos.length) {
                await socket.sendMessage(sender, { 
                    text: '*🚩 Result Not Found*',
                    buttons: [
                        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
                    ]
                });    
                return;
            }

            const video = searchResults.videos[0];
            const apiUrl = `${api}/download/ytmp3?url=${encodeURIComponent(video.url)}&apikey=${apikey}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!data.status || !data.data?.result) {
                await socket.sendMessage(sender, { 
                    text: '*🚩 Download Error. Please try again later.*',
                    buttons: [
                        { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
                    ]
                });
                return;
            }

            const { title, uploader, duration, quality, format, thumbnail, download } = data.data.result;
            const titleText = '*NETHUWH XMD MINI BOT SONG DOWNLOAD*';
            const content = `┏━━━━━━━━━━━━━━━━\n` +
                `┃📝 \`Title\` : ${video.title}\n` +
                `┃📈 \`Views\` : ${video.views}\n` +
                `┃🕛 \`Duration\` : ${video.timestamp}\n` +
                `┃🔗 \`URL\` : ${video.url}\n` +
                `┗━━━━━━━━━━━━━━━━`;
            const footer = config.BOT_FOOTER || '';
            const captionMessage = formatMessage(titleText, content, footer);

            await socket.sendMessage(sender, {
                image: { url: config.BUTTON_IMAGES.SONG },
                caption: captionMessage,
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 },
                    { buttonId: `${config.PREFIX}alive`, buttonText: { displayText: '🤖 BOT INFO' }, type: 1 }
                ]
            });

            await Promise.all([
                socket.sendMessage(sender, {
                    audio: { url: download },
                    mimetype: 'audio/mpeg'
                }),
                socket.sendMessage(sender, {
                    document: { url: download },
                    mimetype: "audio/mpeg",
                    fileName: `${video.title}.mp3`,
                    caption: captionMessage
                })
            ]);

        } catch (err) {
            console.error(err);
            await socket.sendMessage(sender, { 
                text: '*❌ Internal Error. Please try again later.*',
                buttons: [
                    { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: '📋 MENU' }, type: 1 }
                ]
            });
        }
    },

    ig: async (socket, sender, msg) => {
        const q = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
        const link = q.replace(/^[.\/!]ig\s*/i, '').trim();

        if (!link) {
            return await socket.sendMessage(sender, {
                text: '📌 *Usage:* .ig <instagram link>'
            }, { quoted: msg });
        }

        if (!link.includes('instagram.com')) {
            return await socket.sendMessage(sender, {
                text: '❌ *Invalid Instagram link.*'
            }, { quoted: msg });
        }

        try {
            await socket.sendMessage(sender, {
                text: '⏳ Downloading Instagram post, please wait...'
            }, { quoted: msg });

            const apiUrl = `https://delirius-apiofc.vercel.app/download/instagram?url=${encodeURIComponent(link)}`;
            const { data } = await axios.get(apiUrl);

            if (!data?.status || !data?.data) {
                return await socket.sendMessage(sender, {
                    text: '❌ Failed to fetch Instagram media.'
                }, { quoted: msg });
            }

            for (const item of data.data) {
                const buttons = [
                    { buttonId: `.ig ${link}`, buttonText: { displayText: '🔄 Download Again' }, type: 1 },
                    { buttonId: `.menu`, buttonText: { displayText: '🏠 Main Menu' }, type: 1 }
                ];

                await socket.sendMessage(sender, {
                    [item.type]: { url: item.url },
                    caption: `📷 *Instagram ${item.type.toUpperCase()}*\n🔗 ${link}`,
                    buttons,
                    headerType: 4
                }, { quoted: msg });
            }

        } catch (err) {
            console.error("Instagram command error:", err);
            await socket.sendMessage(sender, {
                text: `❌ An error occurred:\n${err.message}`
            }, { quoted: msg });
        }
    },

    news: async (socket, sender, msg) => {
        const botName = config.BOT_NAME;
        const footer = config.BOT_FOOTER;
        
        const desc = `*${botName} NEWS CENTER*

🫱 *Hello ${msg.pushName || 'User'}*

*╭─「 ɴᴇᴡꜱ ᴅᴇᴛᴀɪʟꜱ 」*
> Reply the Number you want to select
*╰──────────●●►*

*1│❯❯◦ DERANA NEWS*
*2│❯❯◦ HIRU NEWS*
*3│❯❯◦ BBC NEWS*
*4│❯❯◦ LANKADEEPA NEWS*
*5│❯❯◦ ITN NEWS*
*6│❯❯◦ SIYATHA NEWS*
*7│❯❯◦ NETH NEWS*
*8│❯❯◦ LANKA NEWS*
*9│❯❯◦ GOSSIPLANKA NEWS*
*10│❯❯◦ TECH NEWS*
*11│❯❯◦ WORLD NEWS*

*${footer}*`;

        await socket.sendMessage(sender, {
            image: { url: config.IMAGE_PATH },
            caption: desc
        }, { quoted: msg });
    }
};

// Setup command handlers with buttons and images
function setupCommandHandlers(socket, number) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        let command = null;
        let args = [];
        let sender = msg.key.remoteJid;

        if (msg.message.conversation || msg.message.extendedTextMessage?.text) {
            const text = (msg.message.conversation || msg.message.extendedTextMessage.text || '').trim();
            if (text.startsWith(config.PREFIX)) {
                const parts = text.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }
        else if (msg.message.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            if (buttonId && buttonId.startsWith(config.PREFIX)) {
                const parts = buttonId.slice(config.PREFIX.length).trim().split(/\s+/);
                command = parts[0].toLowerCase();
                args = parts.slice(1);
            }
        }

        if (!command) return;

        try {
            if (commandHandlers[command]) {
                await commandHandlers[command](socket, sender, msg, args);
            } else {
                console.warn(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error('Command handler error:', error);
            await socket.sendMessage(sender, {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '❌ ERROR',
                    'An error occurred while processing your command. Please try again.',
                    `${config.BOT_FOOTER}`
                )
            });
        }
    });
}

// Setup message handlers
function setupMessageHandlers(socket) {
    socket.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.remoteJid === config.NEWSLETTER_JID) return;

        if (autoReact === 'on') {
            try {
                await socket.sendPresenceUpdate('recording', msg.key.remoteJid);
                console.log(`Set recording presence for ${msg.key.remoteJid}`);
            } catch (error) {
                console.error('Failed to set recording presence:', error);
            }
        }
    });
}

// Delete session from GitHub
async function deleteSessionFromGitHub(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name.includes(sanitizedNumber) && file.name.endsWith('.json')
        );

        for (const file of sessionFiles) {
            await octokit.repos.deleteFile({
                owner,
                repo,
                path: `session/${file.name}`,
                message: `Delete session for ${sanitizedNumber}`,
                sha: file.sha
            });
        }
    } catch (error) {
        console.error('Failed to delete session from GitHub:', error);
    }
}

// Restore session from GitHub
async function restoreSession(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file =>
            file.name === `creds_${sanitizedNumber}.json`
        );

        if (sessionFiles.length === 0) return null;

        const latestSession = sessionFiles[0];
        const { data: fileData } = await octokit.repos.getContent({
            owner,
            repo,
            path: `session/${latestSession.name}`
        });

        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('Session restore failed:', error);
        return null;
    }
}

// Load user config (Fixed to handle errors properly)
async function loadUserConfig(number) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: configPath
        });

        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return JSON.parse(content);
    } catch (error) {
        console.warn(`No configuration found for ${number}, using default config`);
        return { ...config }; // Return a copy of default config
    }
}

// Update user config (Fixed to merge configs properly)
async function updateUserConfig(number, newConfig) {
    try {
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const configPath = `session/config_${sanitizedNumber}.json`;
        
        // Load existing config or start fresh
        let currentConfig = {};
        let sha = null;
        try {
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path: configPath
            });
            currentConfig = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
            sha = data.sha;
        } catch (loadError) {
            console.warn(`No existing config for ${sanitizedNumber}, creating new one`);
        }

        // Merge new config with existing
        const mergedConfig = {...currentConfig, ...newConfig};

        // Update the file
        await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: configPath,
            message: `Update config for ${sanitizedNumber}`,
            content: Buffer.from(JSON.stringify(mergedConfig, null, 2)).toString('base64'),
            sha: sha // Will be null for new files
        });
        
        console.log(`Updated config for ${sanitizedNumber}`);
    } catch (error) {
        console.error('Failed to update config:', error);
        throw error;
    }
}

// Setup auto restart
function setupAutoRestart(socket, number) {
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== 401) {
            console.log(`Connection lost for ${number}, attempting to reconnect...`);
            await delay(10000);
            activeSockets.delete(number.replace(/[^0-9]/g, ''));
            socketCreationTime.delete(number.replace(/[^0-9]/g, ''));
            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
        }
    });
}

// Main pairing function
async function EmpirePair(number, res) {
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    await initUserEnvIfMissing(sanitizedNumber);
    await initEnvsettings(sanitizedNumber);
    
    const sessionPath = path.join(SESSION_BASE_PATH, `session_${sanitizedNumber}`);

    await cleanDuplicateFiles(sanitizedNumber);

    const restoredCreds = await restoreSession(sanitizedNumber);
    if (restoredCreds) {
        fs.ensureDirSync(sessionPath);
        fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(restoredCreds, null, 2));
        console.log(`Successfully restored session for ${sanitizedNumber}`);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'fatal' : 'debug' });

    try {
        const socket = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.macOS('Safari')
        });

        socketCreationTime.set(sanitizedNumber, Date.now());

        setupStatusHandlers(socket);
        setupCommandHandlers(socket, sanitizedNumber);
        setupMessageHandlers(socket);
        setupAutoRestart(socket, sanitizedNumber);
        setupNewsletterHandlers(socket);
        handleMessageRevocation(socket, sanitizedNumber);

        if (!socket.authState.creds.registered) {
            let retries = config.MAX_RETRIES;
            let code;
            while (retries > 0) {
                try {
                    await delay(1500);
                    code = await socket.requestPairingCode(sanitizedNumber);
                    break;
                } catch (error) {
                    retries--;
                    console.warn(`Failed to request pairing code: ${retries}, error.message`, retries);
                    await delay(2000 * (config.MAX_RETRIES - retries));
                }
            }
            if (!res.headersSent) {
                res.send({ code });
            }
        }

        socket.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            let sha;
            try {
                const { data } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: `session/creds_${sanitizedNumber}.json`
                });
                sha = data.sha;
            } catch (error) {
            }

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `session/creds_${sanitizedNumber}.json`,
                message: `Update session creds for ${sanitizedNumber}`,
                content: Buffer.from(fileContent).toString('base64'),
                sha
            });
            console.log(`Updated creds for ${sanitizedNumber} in GitHub`);
        });

        socket.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                try {
                    await delay(3000);
                    const userJid = jidNormalizedUser(socket.user.id);
                    const groupResult = await joinGroup(socket);

                    try {
                        await socket.newsletterFollow(config.NEWSLETTER_JID);
                        await socket.sendMessage(config.NEWSLETTER_JID, { react: { text: '❤️', key: { id: config.NEWSLETTER_MESSAGE_ID } } });
                        console.log('✅ Auto-followed newsletter & reacted ❤️');
                    } catch (error) {
                        console.error('❌ Newsletter error:', error.message);
                    }

                    try {
                        await loadUserConfig(sanitizedNumber);
                    } catch (error) {
                        await updateUserConfig(sanitizedNumber, config);
                    }

                    activeSockets.set(sanitizedNumber, socket);

                    const groupStatus = groupResult.status === 'success'
                        ? 'Joined successfully'
                        : `Failed to join group: ${groupResult.error}`;
                    await socket.sendMessage(userJid, {
                        image: { url: config.IMAGE_PATH },
                        caption: formatMessage(
                            '*Dss*',
                            `✅ Successfully connected!\n\n🔢 Number: ${sanitizedNumber}\n🍁 Channel: ${config.NEWSLETTER_JID ? 'Followed' : 'Not followed'}\n\n📋 Available Category:\n📌${config.PREFIX}alive - Show bot status\n📌${config.PREFIX}menu - Show bot command\n📌${config.PREFIX}system - Bit system\n📌${config.PREFIX}ping - Bot Speed\n📌Channel react\n📌Status Auto Seen And React`,
                            'Dss'
                        )
                    });

                    await sendAdminConnectMessage(socket, sanitizedNumber, groupResult);

                    let numbers = [];
                    if (fs.existsSync(NUMBER_LIST_PATH)) {
                        numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH, 'utf8'));
                    }
                    if (!numbers.includes(sanitizedNumber)) {
                        numbers.push(sanitizedNumber);
                        fs.writeFileSync(NUMBER_LIST_PATH, JSON.stringify(numbers, null, 2));
                    }
                } catch (error) {
                    console.error('Connection error:', error);
                    exec(`pm2 restart ${process.env.PM2_NAME || 'Shala-Md-Free-Bot-Session'}`);
                }
            }
        });
    } catch (error) {
        console.error('Pairing error:', error);
        socketCreationTime.delete(sanitizedNumber);
        if (!res.headersSent) {
            res.status(503).send({ error: 'Service Unavailable' });
        }
    }
}

// Routes
router.get('/', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        return res.status(400).send({ error: 'Number parameter is required' });
    }

    if (activeSockets.has(number.replace(/[^0-9]/g, ''))) {
        return res.status(200).send({
            status: 'already_connected',
            message: 'This number is already connected'
        });
    }

    await EmpirePair(number, res);
});

router.get('/active', (req, res) => {
    res.status(200).send({
        count: activeSockets.size,
        numbers: Array.from(activeSockets.keys())
    });
});

router.get('/ping', (req, res) => {
    res.status(200).send({
        status: 'active',
        message: 'BOT is running',
        activesession: activeSockets.size
    });
});

router.get('/connect-all', async (req, res) => {
    try {
        if (!fs.existsSync(NUMBER_LIST_PATH)) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const numbers = JSON.parse(fs.readFileSync(NUMBER_LIST_PATH));
        if (numbers.length === 0) {
            return res.status(404).send({ error: 'No numbers found to connect' });
        }

        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            await EmpirePair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Connect all error:', error);
        res.status(500).send({ error: 'Failed to connect all bots' });
    }
});

router.get('/reconnect', async (req, res) => {
    try {
        const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: 'session'
        });

        const sessionFiles = data.filter(file => 
            file.name.startsWith('creds_') && file.name.endsWith('.json')
        );

        if (sessionFiles.length === 0) {
            return res.status(404).send({ error: 'No session files found in GitHub repository' });
        }

        const results = [];
        for (const file of sessionFiles) {
            const match = file.name.match(/creds_(\d+)\.json/);
            if (!match) {
                console.warn(`Skipping invalid session file: ${file.name}`);
                results.push({ file: file.name, status: 'skipped', reason: 'invalid_file_name' });
                continue;
            }

            const number = match[1];
            if (activeSockets.has(number)) {
                results.push({ number, status: 'already_connected' });
                continue;
            }

            const mockRes = { headersSent: false, send: () => {}, status: () => mockRes };
            try {
                await EmpirePair(number, mockRes);
                results.push({ number, status: 'connection_initiated' });
            } catch (error) {
                console.error(`Failed to reconnect bot for ${number}:`, error);
                results.push({ number, status: 'failed', error: error.message });
            }
            await delay(1000);
        }

        res.status(200).send({
            status: 'success',
            connections: results
        });
    } catch (error) {
        console.error('Reconnect error:', error);
        res.status(500).send({ error: 'Failed to reconnect bots' });
    }
});

router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) {
        return res.status(400).send({ error: 'Number and config are required' });
    }

    let newConfig;
    try {
        newConfig = JSON.parse(configString);
    } catch (error) {
        return res.status(400).send({ error: 'Invalid config format' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const otp = generateOTP();
    otpStore.set(sanitizedNumber, { otp, expiry: Date.now() + config.OTP_EXPIRY, newConfig });

    try {
        await sendOTP(socket, sanitizedNumber, otp);
        res.status(200).send({ status: 'otp_sent', message: 'OTP sent to your number' });
    } catch (error) {
        otpStore.delete(sanitizedNumber);
        res.status(500).send({ error: 'Failed to send OTP' });
    }
});

router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) {
        return res.status(400).send({ error: 'Number and OTP are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const storedData = otpStore.get(sanitizedNumber);
    if (!storedData) {
        return res.status(400).send({ error: 'No OTP request found for this number' });
    }

    if (Date.now() >= storedData.expiry) {
        otpStore.delete(sanitizedNumber);
        return res.status(400).send({ error: 'OTP has expired' });
    }

    if (storedData.otp !== otp) {
        return res.status(400).send({ error: 'Invalid OTP' });
    }

    try {
        await updateUserConfig(sanitizedNumber, storedData.newConfig);
        otpStore.delete(sanitizedNumber);
        const socket = activeSockets.get(sanitizedNumber);
        if (socket) {
            await socket.sendMessage(jidNormalizedUser(socket.user.id), {
                image: { url: config.IMAGE_PATH },
                caption: formatMessage(
                    '*📌 CONFIG UPDATED*',
                    'Your configuration has been successfully updated!',
                    `${config.BOT_FOOTER}`
                )
            });
        }
        res.status(200).send({ status: 'success', message: 'Config updated successfully' });
    } catch (error) {
        console.error('Failed to update config:', error);
        res.status(500).send({ error: 'Failed to update config' });
    }
});

router.get('/getabout', async (req, res) => {
    const { number, target } = req.query;
    if (!number || !target) {
        return res.status(400).send({ error: 'Number and target number are required' });
    }

    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(sanitizedNumber);
    if (!socket) {
        return res.status(404).send({ error: 'No active session found for this number' });
    }

    const targetJid = `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    try {
        const statusData = await socket.fetchStatus(targetJid);
        const aboutStatus = statusData.status || 'No status available';
        const setAt = statusData.setAt ? moment(statusData.setAt).tz('Asia/Colombo').format('YYYY-MM-DD HH:mm:ss') : 'Unknown';
        res.status(200).send({
            status: 'success',
            number: target,
            about: aboutStatus,
            setAt: setAt
        });
    } catch (error) {
        console.error(`Failed to fetch status for ${target}:`, error);
        res.status(500).send({
            status: 'error',
            message: `Failed to fetch About status for ${target}. The number may not exist or the status is not accessible.`
        });
    }
});

// Cleanup
process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        socket.ws.close();
        activeSockets.delete(number);
        socketCreationTime.delete(number);
    });
    fs.emptyDirSync(SESSION_BASE_PATH);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    exec(`pm2 restart ${process.env.PM2_NAME || 'BOT-session'}`);
});

module.exports = router;
