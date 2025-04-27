import { createConnection, fetchLatestBaileysVersion, useMultiFileAuthState, DisconnectReason, makeWASocket, delay } from '@adiwajshing/baileys';
import { Boom } from '@hapi/boom';
import { join } from 'path';
import { readdirSync } from 'fs';
import pino from 'pino';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { platform } from 'os';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '../');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(join(__dirname, './session'));

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(chalk.green(`✅ Using Baileys Version: ${version.join('.')}, isLatest: ${isLatest}`));

  const sock = makeWASocket({
    printQRInTerminal: true,
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ["WhatsApp Bot", "Chrome", "4.0"],
    version
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      switch (reason) {
        case DisconnectReason.badSession:
          console.log(chalk.red('❌ Bad session, please delete session and scan again.'));
          process.exit();
          break;
        case DisconnectReason.connectionClosed:
          console.log(chalk.red('❌ Connection closed, reconnecting...'));
          start();
          break;
        case DisconnectReason.connectionLost:
          console.log(chalk.red('❌ Connection lost, reconnecting...'));
          start();
          break;
        case DisconnectReason.connectionReplaced:
          console.log(chalk.red('❌ Connection replaced, another session opened.'));
          process.exit();
          break;
        case DisconnectReason.loggedOut:
          console.log(chalk.red('❌ Logged out, please scan again.'));
          process.exit();
          break;
        case DisconnectReason.restartRequired:
          console.log(chalk.yellow('⚠️ Restart required, restarting...'));
          start();
          break;
        case DisconnectReason.timedOut:
          console.log(chalk.red('❌ Connection timed out, reconnecting...'));
          start();
          break;
        default:
          console.log(chalk.red(`❌ Unknown disconnect reason: ${reason}. Reconnecting...`));
          start();
      }
    } else if (connection === 'open') {
      console.log(chalk.green('✅ Successfully connected to WhatsApp!'));
      await delay(500);
      loadPlugins(sock);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || !m.messages[0]) return;
    const msg = m.messages[0];

    if (msg.key && msg.key.remoteJid === 'status@broadcast') return;

    const from = msg.key.remoteJid;
    const type = Object.keys(msg.message || {})[0];
    const body = (msg.message?.conversation || msg.message?.[type]?.caption || msg.message?.[type]?.text || '').trim();

    if (!body) return;

    const command = body.split(' ')[0].toLowerCase();
    const args = body.split(' ').slice(1);

    if (global.plugins) {
      for (const pluginName in global.plugins) {
        const plugin = global.plugins[pluginName];
        if (plugin.command && typeof plugin.command.test === 'function' && plugin.command.test(command)) {
          try {
            await plugin.run({ sock, msg, command, args });
          } catch (e) {
            console.error(chalk.red(`❌ Error in plugin ${pluginName}:`), e);
          }
        }
      }
    }
  });
}

function loadPlugins(sock) {
  global.plugins = {};
  const pluginFolder = join(__dirname, 'plugins');

  if (!fs.existsSync(pluginFolder)) {
    console.warn(chalk.yellow('⚠️ No plugins folder found.'));
    return;
  }

  const pluginFiles = readdirSync(pluginFolder).filter(file => file.endsWith('.js'));

  for (const file of pluginFiles) {
    const pluginPath = join(pluginFolder, file);
    try {
      import(`file://${pluginPath}?update=${Date.now()}`).then((plugin) => {
        global.plugins[file] = plugin.default;
        console.log(chalk.blue(`✅ Loaded plugin: ${file}`));
      }).catch(err => {
        console.error(chalk.red(`❌ Failed to load plugin ${file}:`), err);
      });
    } catch (e) {
      console.error(chalk.red(`❌ Error loading plugin ${file}:`), e);
    }
  }
}

start();
