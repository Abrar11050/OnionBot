import Discord from "discord.js";
import got from 'got';
import { OBFX } from '../../onionwork/OBExecution';
import OBSignal from "../../onionwork/OBSignal";
import { OBStatus } from "../../onionwork/OBTools";

import emap from './emlist.json';
const gmap = emap as { [key : string] : string };

export const xmoji : OBFX = {
    onMessage: async (obs : OBSignal) => {
        const split = obs.args.split('+');
        if(split.length !== 2) {
            await obs.msg.channel.send(`Invalid expression "${obs.args}"`);
            return;
        }
        const left  = split[0].trim();
        const right = split[1].trim();

        if(left.length  !== 2) { await obs.msg.channel.send(`Invalid left operand "${left}"`); return; }
        if(right.length !== 2) { await obs.msg.channel.send(`Invalid right operand "${right}"`); return; }

        if(!(left  in gmap)) { await obs.msg.channel.send(`Unsupported sequence/character "${left}"`); return; }
        if(!(right in gmap)) { await obs.msg.channel.send(`Unsupported sequence/character "${right}"`); return; }

        if(left === right) { await obs.msg.channel.send('Cannot combine same emojis'); return; }

        const first  = gmap[left];
        const second = gmap[right];

        const url = new URL(process.env.XMOJI_LINK as string);
        url.searchParams.append('first', first);
        url.searchParams.append('second', second);

        // Send the two params to the serverless function
        const imgReq = await got.get(url.href, { responseType: 'buffer' });
        if(imgReq.statusCode === 200) {
            await obs.msg.channel.send('', new Discord.MessageAttachment(imgReq.body));
        } else if(imgReq.statusCode === 400) {
            obs.logs.push(OBStatus.failure('Query params not supplied properly'));
        } else if(imgReq.statusCode === 404) {
            obs.logs.push(OBStatus.failure('Failed to fetch mashed-up emoji'));
        }
    },
    onHelp: async (msg : Discord.Message) => {
        const list = Object.keys(gmap);
        await msg.channel.send([
            'Combine two emojis',
            'Action command format is ``ob emo <emoji1> + <emoji2>``',
            'Example: ``ob emo 🥳 + 🥵``',
            'Supported emojis are:',
            ...subSlice(list, 9)
        ].join('\n'));
    }
};

const subSlice = (list : string[], count : number) => {
    const limit = Math.floor(list.length / count);
    let till = 0;
    const ret : string[] = [];
    for (let i = 0; i < count; i++) {
        ret.push(list.slice(till, till + limit).join('  '));
        till += limit;
    }
    return ret;
};