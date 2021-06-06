import Discord from "discord.js";
import got from 'got';
import { OBFX } from '../../onionwork/OBExecution';
import OBSignal from "../../onionwork/OBSignal";
import { OBStatus } from "../../onionwork/OBTools";

export const inspiro : OBFX = {
    onMessage: async (obs : OBSignal) => {
        const reqForLInk = await got.get('https://inspirobot.me/api?generate=true', { responseType: 'text' });
        if(reqForLInk.statusCode !== 200) {
            obs.logs.push(OBStatus.failure('Failed to get link for inspirobot'));
            return;
        }
        await obs.msg.channel.send(reqForLInk.body);
        // const reqForImg = await got.get(reqForLInk.body, { responseType: 'buffer' });
        // if(reqForImg.statusCode !== 200) {
        //     obs.logs.push(OBStatus.failure('Failed to get image for inspirobot'));
        //     return;
        // }
        // await obs.msg.channel.send('', new Discord.MessageAttachment(reqForImg.body));
    },
    onHelp: async (msg : Discord.Message) => {
        await msg.channel.send('Write ``ob inspiro`` to show AI generated inspirational quotes');
    }
};