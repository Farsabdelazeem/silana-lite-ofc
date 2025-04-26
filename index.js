import './config.js';
import './function/settings/settings.js';
import { fetchLatestBaileysVersion } from '@adiwajshing/baileys';
import cfont from "cfonts";
import { spawn } from 'child_process';
import { createInterface } from "readline";
import { promises as fsPromises } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sizeFormatter } from 'human-readable';
import axios from 'axios';
import cheerio from "cheerio";
import os from 'os';
import moment from 'moment-timezone';
import fs from 'fs';
import yargs from "yargs";
import express from 'express';
import chalk from 'chalk';

const app = express();
const port = process.env.PORT || 7860;
const __dirname = dirname(fileURLToPath(import.meta.url));
const time = moment().tz('Africa/Casablanca').format('HH:mm:ss');
const rl = createInterface({ input: process.stdin, output: process.stdout });
let isRunning = false;

const formatSize = sizeFormatter({
  std: 'JEDEC',
  decimalPlaces: 2,
  keepTrailingZeroes: false,
  render: (literal, symbol) => `${literal} ${symbol}B`
});

// Start Express server
app.get("/", (req, res) => {
  res.send("Bot is running...");
});
app.listen(port, () => {
  console.log(chalk.green(`⚡ Web server running on port ${port}`));
});

// Create tmp folder if not exists
const folderPath = join(__dirname, 'tmp');
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath);
  console.log(chalk.green('✅ tmp folder created successfully.'));
}

// Show CFonts
cfont.say(info.figlet, {
  font: "simpleBlock",
  align: "center",
  gradient: ["yellow", "cyan", "red"],
  transitionGradient: true,
});
cfont.say('by ' + info.nameown, {
  font: "tiny",
  align: "center",
  colors: ["white"]
});

async function start(file) {
  if (isRunning) return;
  isRunning = true;
  const args = [join(__dirname, file), ...process.argv.slice(2)];
  const p = spawn(process.argv[0], args, { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });

  p.on("message", (data) => {
    console.log(chalk.magenta("[✅ Accepted]", data));
    switch (data) {
      case "reset":
        p.kill();
        isRunning = false;
        start(file);
        break;
      case "uptime":
        p.send(process.uptime());
        break;
    }
  });

  p.on("exit", (_, code) => {
    isRunning = false;
    console.error(chalk.red(`[❗] Process exited with code: ${code}`));
    if (code !== 0) start(file);
  });

  const opts = yargs(process.argv.slice(2)).exitProcess(false).parse();
  if (!opts["test"] && !rl.listenerCount('line')) {
    rl.on("line", (line) => {
      p.emit("message", line.trim());
    });
  }

  try {
    const packageJsonPath = join(__dirname, 'package.json');
    const pluginsFolder = join(__dirname, 'plugins');

    const packageJsonData = await fsPromises.readFile(packageJsonPath, 'utf-8');
    const packageJsonObj = JSON.parse(packageJsonData);

    const { data: ip } = await axios.get('https://api.ipify.org');
    const ramInGB = os.totalmem() / (1024 * 1024 * 1024);
    const freeRamInGB = os.freemem() / (1024 * 1024 * 1024);

    const totalFoldersAndFiles = await getTotalFoldersAndFiles(pluginsFolder);

    console.table({
      "⎔ Dashboard": " System ⎔",
      "Name Bot": packageJsonObj.name,
      "Version": packageJsonObj.version,
      "Description": packageJsonObj.description,
      "Os": os.type(),
      "Memory": `${freeRamInGB.toFixed(2)} / ${ramInGB.toFixed(2)} GB`,
      "IP": ip,
      "Owner": global.info.nomerown,
      "Features": `${totalFoldersAndFiles.files} features`,
      "Creator": "NOUREDDINE"
    });

    console.log(chalk.bgGreen(chalk.white(`✅ Baileys version ${(await fetchLatestBaileysVersion()).version} installed.`)));

  } catch (error) {
    console.error(chalk.red(`❌ Error reading package.json or plugins: ${error}`));
  }

  // Prevent server auto-shutdown
  setInterval(() => {}, 1000);
}

function getTotalFoldersAndFiles(folderPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(folderPath, (err, files) => {
      if (err) {
        reject(err);
      } else {
        let folders = 0;
        let filesCount = 0;
        files.forEach((file) => {
          const filePath = join(folderPath, file);
          if (fs.statSync(filePath).isDirectory()) {
            folders++;
          } else {
            filesCount++;
          }
        });
        resolve({ folders, files: filesCount });
      }
    });
  });
}

// Start bot
start('main.js');
