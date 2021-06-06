import Discord from "discord.js";
import got from 'got';
import { OBFX } from '../../onionwork/OBExecution';
import OBSignal from "../../onionwork/OBSignal";
import { OBStatus, SimpleLexer } from "../../onionwork/OBTools";

const randDate = () : string => {
    let time = new Date(Math.floor(Math.random() * (Date.now() - 803433600001)) + 803433600000);
    const offset = time.getTimezoneOffset();
    time = new Date(time.getTime() - (offset * 60 * 1000));
    return time.toISOString().split('T')[0];
}

const validateDS = (str : string) : [string | null, string] => {
    let time = new Date(str);
    if(Number.isNaN(time.getTime())) return [null, `Invalid Date string "${str}"`];
    if(time.getTime() < 803433600000 || time.getTime() > Date.now()) return [null, 'Given date is out of range'];
    const offset = time.getTimezoneOffset();
    time = new Date(time.getTime() - (offset * 60 * 1000));
    return [time.toISOString().split('T')[0], 'OK'];
};

const MAX_ITER = 10;

interface NSRes {
    done : boolean;
    iter : number;
    text : string | undefined;
    date : string | undefined;
    link : string | undefined;
}

const tryFetching = async () : Promise<NSRes> => {
    for (let i = 0; i < MAX_ITER; i++) {
        const url = new URL('https://api.nasa.gov/planetary/apod');
        url.searchParams.append('api_key', process.env.NASA_KEY as string);
        url.searchParams.append('date', randDate());
        const req = await got.get(url.href, { responseType: 'json' })
                          .then(res => res)
                          .catch(e => { return { statusCode: 404, body: {} }; });
        if(req.statusCode === 200) {
            let body = req.body as any;
            return {
                done: true,
                iter: i,
                text: body.title as (string | undefined),
                date: body.date as (string | undefined),
                link: body.hdurl ? (body.hdurl as (string | undefined)) : (body.url as (string | undefined))
            }
        } else if(req.statusCode === 404) {
            continue;
        }
    }
    return {
        done: false,
        iter: MAX_ITER,
        text: undefined,
        date: undefined,
        link: undefined
    };
};

const dateFetch = async (date? : string) : Promise<NSRes> => {
    const url = new URL('https://api.nasa.gov/planetary/apod');
    url.searchParams.append('api_key', process.env.NASA_KEY as string);
    if(date) { url.searchParams.append('date', date); }
    const req = await got.get(url.href, { responseType: 'json' })
                      .then(res => res)
                      .catch(e => { return { statusCode: 404, body: {} }; });
    if(req.statusCode === 200) {
        let body = req.body as any;
        return {
            done: true,
            iter: 0,
            text: body.title as (string | undefined),
            date: body.date as (string | undefined),
            link: body.hdurl ? (body.hdurl as (string | undefined)) : (body.url as (string | undefined))
        };
    }
    return {
        done: false,
        iter: req.statusCode === 404 ? MAX_ITER : -MAX_ITER,
        text: undefined,
        date: undefined,
        link: undefined
    };
};

const attachAndSend = async (notext: boolean, obs : OBSignal, nss : NSRes) => {
    if(!nss.link) { obs.logs.push(OBStatus.failure('200 status code but there is no link')); return; }
    let strs : string[] = [];
    if(!notext) {
        if(nss.text) strs.push(`*${nss.text}*`);
        if(nss.date) strs.push(`Date: ${nss.date}`);
        if(nss.iter !== 0 && nss.iter < MAX_ITER) strs.push(`(Retries: ${nss.iter + 1})`);
    }
    strs.push(nss.link);
    await obs.msg.channel.send(strs.join('\n'));
};

enum NSType { RANDOM, DATE, TODAY }

export const nasa : OBFX = {
    onMessage: async (obs : OBSignal) => {
        let type = NSType.RANDOM;
        let notext = false;
        let dateStr = '';
        const sl = new SimpleLexer(obs.args);

        const first = sl.lex().toLowerCase();
        if(first === 'notext') {
            notext = true;
            const second = obs.args.slice(sl.getCursorEscaped(), obs.args.length).trim().toLowerCase();
            if(second === '') type = NSType.RANDOM;
            else if(second === 'today') type = NSType.TODAY;
            else { type = NSType.DATE; dateStr = second; }
        } else if(first === 'today') {
            type = NSType.TODAY;
        } else if(first === '') {
            type = NSType.RANDOM;
        } else {
            type = NSType.DATE;
            dateStr = obs.args.trim();
        }

        if(type === NSType.RANDOM) {
            const randP = await tryFetching();
            if(randP.done) {
                await attachAndSend(notext, obs, randP);
            } else {
                await obs.msg.channel.send('🛑 Failed to get any images even after maximum retries');
            }
        } else if(type === NSType.TODAY) {
            const todayP = await dateFetch();
            if(todayP.done) {
                await attachAndSend(notext, obs, todayP);
            } else {
                await obs.msg.channel.send('🛑 No image/video for today');
            }
        } else if(type === NSType.DATE) {
            const [dstr, rep] = validateDS(dateStr);
            if(dstr) {
                const dateP = await dateFetch(dstr);
                if(dateP.done) {
                    await attachAndSend(notext, obs, dateP);
                } else {
                    await obs.msg.channel.send(`🛑 No image/video for date ${dstr}`);
                }
            } else {
                await obs.msg.channel.send(rep);
            }
        }
    },
    onHelp: async (msg : Discord.Message) => {
        await msg.channel.send([
            'Show images/videos from NASA\'s Astronomy Picture of the Day',
            'Action command format is ``ob nasa <notext?> <"today" or any date>``',
            '```bash',
            'Examples:',
            'ob nasa',
            'ob nasa notext',
            'ob nasa today',
            'ob nasa notext today',
            'ob nasa 2013-07-03',
            'ob nasa 4 Sep 2002',
            'ob nasa notext 2013-07-03',
            'ob nasa notext 4 Sep 2002```',
            '**notext** is optional, use this to hide title from image',
            '**today** shows today\'s image',
            'Date range is from Jun 18 1995 to today',
            'By default, it shows random image'
        ].join('\n'));
    }
};
