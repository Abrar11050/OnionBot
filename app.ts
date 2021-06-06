import Discord from "discord.js";
import * as dotenv from "dotenv";
import http from 'http';
import { OBSystem } from './onionwork/OBExecution';

import { inspiro } from './functions/inspirobot/main';
import { xmoji } from './functions/xmoji/main';
import { nasa } from './functions/nasa/main';

dotenv.config();

const client = new Discord.Client();
client.on('ready', () => { console.log(`Logged in as ${client.user?.tag}!`); });

const sys = new OBSystem();

sys.addAction('inspiro', inspiro, 'AI generated inspirational quotes');
sys.addAction('emo',     xmoji,   'Mash up two emojis');
sys.addAction('nasa',    nasa,    'NASA Astronomy Picture Of the Day');

sys.setShortcut('ainspire', 'inspiro');
sys.setShortcut('xmoji',    'emo');
sys.setShortcut('astron',   'nasa');

client.login(process.env.DISCORD_KEY).then(val => sys.startSystem(client));

http.createServer((req, res) => { res.write('live'); res.end(); }).listen(8080);