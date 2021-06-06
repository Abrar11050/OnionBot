import { type } from 'os';
import Discord from "discord.js";
import OBSignal from "./OBSignal";
import { OBStatusType, OBStatus, OBStatusLoad, SimpleLexer } from "./OBTools";

enum CMDType { NORMAL, ALIASED }

type MSGfn  = (obs : OBSignal, sys? : OBSystem) => Promise<void>;
type HELPfn = (msg : Discord.Message) => Promise<void>;
type TERMfn = (sys : OBSystem) => Promise<void>;

export interface OBFX {
    onMessage   : MSGfn;
    onHelp?     : HELPfn;
    onStart?    : TERMfn;
    onShutdown? : TERMfn;
}

interface Refer {
    refersTo : string;
    fn       : MSGfn;
}

export class OBSystem {
    private client!  : Discord.Client;
    private commands : string[];
    private descs    : (string | null)[];
    private aliases  : Map<string, Refer>;
    private shortcut : string[];

    private startFuncs     : TERMfn[];
    private shutdownFuncs  : TERMfn[];
    private msgOrdinary    : Map<string, MSGfn>;
    private helpProcedures : Map<string, HELPfn>;

    public constructor() {
        this.commands = [];
        this.descs    = [];
        this.aliases  = new Map();
        this.shortcut = [];

        this.startFuncs     = [];
        this.shutdownFuncs  = [];
        this.msgOrdinary    = new Map();
        this.helpProcedures = new Map();

        this.addAction('help', helpfx, 'Displays this message');
        this.addAction('explain', explainfx, 'Shows help message specific to an action');
    }

    public addAction(command : string, app : OBFX, description? : string) : void {
        if(this.commands.indexOf(command) >= 0) {
            console.error(`Failed to add action "${command}", it already exists`);
            return;
        }
        this.commands.push(command);
        this.descs.push(description ? description : null);

        this.msgOrdinary.set(command, app.onMessage);
        if(app.onHelp) {
            this.helpProcedures.set(command, app.onHelp);
        }
        if(app.onStart) {
            this.startFuncs.push(app.onStart);
        }
        if(app.onShutdown) {
            this.shutdownFuncs.push(app.onShutdown);
        }
    }

    public setShortcut(name : string, refersTo : string) : void {
        if(this.aliases.has(name)) {
            console.error(`A shortcut named "${name} already exists, it refers to "${this.aliases.get(name)?.refersTo}""`);
            return;
        }
        if(this.commands.indexOf(refersTo) < 0) {
            console.error(`Failed to set shortcut for "${refersTo}", it doesn't exist`);
            return;
        }
        const fn = this.msgOrdinary.get(refersTo);
        if(!fn) {
            console.error(`Failed to set shortcut for "${refersTo}", procedure doesn't exist`);
            return;
        }

        this.aliases.set(name, { refersTo, fn });
        this.shortcut.push(name);
    }

    public getActionList() {
        const tmap : Map<string, string> = new Map();
        this.aliases.forEach((val, key) => tmap.set(val.refersTo, key));
        return this.commands.map((cmd, i) => {
            return {
                cmd,
                shortcut: tmap.get(cmd),
                desc: this.descs[i]
            };
        });
    }

    public getHelpFnByName(cmd : string) : HELPfn | undefined {
        return this.helpProcedures.get(cmd);
    }

    public getDescByName(cmd : string) : string | null {
        const index = this.commands.indexOf(cmd);
        if(index < 0) return null;
        return this.descs[index];
    }

    public getCmdList() {
        return [...this.commands];
    }

    private static msgBreakdown(trimmedMsg : string, commands : string[], aliases : string[]) : OBStatusLoad {
        if(trimmedMsg.length === 0) {
            return OBStatusLoad.warningLoad('NOP', 0);
        }
        const sl = new SimpleLexer(trimmedMsg);
        const firstToken = sl.lex().toLowerCase();
        if(firstToken === 'ob') {
            const secondToken = sl.lex().toLowerCase();
            if(secondToken.length === 0) {
                return OBStatusLoad.failureLoad('Incomplete action command', 1);
            } else if(commands.indexOf(secondToken) >= 0) {
                return OBStatusLoad.successLoad('OK', {
                    type : CMDType.NORMAL,
                    cmd  : secondToken,
                    args : trimmedMsg.slice(sl.getCursorEscaped(), trimmedMsg.length)
                });
            } else {
                return OBStatusLoad.failureLoad(`Action "${secondToken}" is not supported`, 1);
            }
        } else if(aliases.indexOf(firstToken) >= 0) {
            return OBStatusLoad.successLoad('OK', {
                type : CMDType.ALIASED,
                cmd  : firstToken,
                args : trimmedMsg.slice(sl.getCursorEscaped(), trimmedMsg.length)
            });
        } else {
            return OBStatusLoad.warningLoad('NOP', 0);
        }
    }

    private async onMessage(msg : Discord.Message) {
        const status = OBSystem.msgBreakdown(msg.content.trim(), this.commands, this.shortcut);
        if(status.type === OBStatusType.SUCCESS) {
            try {
                const ctype = status.data.type as CMDType;
                const cmd   = status.data.cmd  as string;
                const args  = status.data.args as string;
                let fn = ctype === CMDType.NORMAL ? this.msgOrdinary.get(cmd) : this.aliases.get(cmd)?.fn;
                if(fn) {
                    const obs = new OBSignal(this.client, msg, args);
                    await fn(obs, this);
                    this.printLogs(cmd, obs.logs);
                } else {
                    console.warn(`Unbale to find function for "${cmd}"`);
                }
            } catch(e) {
                console.warn(`Failure executing function for "${status.data.cmd}"`, e);
            }
        } else if(status.type === OBStatusType.FAILURE) {
            try { await msg.reply('🛑 ' + status.text); }
            catch(e) { console.warn('Failure sending error message', e); }
        }
    }

    private printLogs(name : string, logs : OBStatus[]) {
        const tstamp = Date.now();
        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            switch (log.type) {
                case OBStatusType.FAILURE: console.error(`[[ FAILURE >> ${name} @ ${tstamp} ]]`, log.text); break;
                case OBStatusType.WARNING: console.warn(`[[ WARNING >> ${name} @ ${tstamp} ]]`, log.text); break;
                case OBStatusType.SUCCESS: console.log(`[[ SUCCESS >> ${name} @ ${tstamp} ]]`, log.text); break;
                default: break;
            }
        }
    }

    private async runProcList(init : boolean) {
        const array = init ? this.startFuncs : this.shutdownFuncs;
        for (let i = 0; i < array.length; i++) {
            const fn = array[i];
            try {
                await fn(this);
            } catch(e) {
                console.error(`[${init ? 'INIT' : 'SHUTDOWN'} Callback failed]`, e);
            }
        }
    }

    public async startSystem(client : Discord.Client) {
        this.client = client;
        await this.runProcList(true);
        this.client.on('message', (msg : Discord.Message) => this.onMessage(msg));
        const term = type() === 'Windows_NT' ? 'SIGINT' : 'SIGTERM';
        process.on(term, async () => { await this.runProcList(false); });
    }
}

/////////////////

const helpfx : OBFX = {
    onMessage: async (obs : OBSignal, sys? : OBSystem) => {
        const actList = sys?.getActionList().map((act, i) => {
            const scut = act.shortcut ? ` (shortcut: ${act.shortcut})` : '';
            return `${i + 1}. **${act.cmd}${scut}:** *${act.desc ? act.desc : '<No Desciption>'}*`;
        });
        let strs = [
            'Write ``ob <action_name> <...arguments>`` to call your desired action',
            'Or ``<action_shortcut> <...arguments>`` (If shortcut is available)'
        ];
        if(actList && actList.length > 0) strs = [...strs, '\nAvailable actions are:', ...actList];
        await obs.msg.channel.send(strs.join('\n'));
    },
    onHelp: async (msg : Discord.Message) => {
        await msg.channel.send([
            'Are you really trying to get explanation for **help**?',
            'Just write ``ob help``, it\'s self-explanatory.'
        ].join('\n'));
    }
};

const explainfx : OBFX = {
    onMessage: async (obs : OBSignal, sys? : OBSystem) => {
        const cmd = obs.args.trim();
        const fn = sys?.getHelpFnByName(cmd);
        if(fn) {
            try {
                await fn(obs.msg);
            } catch(e) {
                console.warn(`Failure executing help function for "${cmd}"`, e);
            }
        } else if(sys && sys.getCmdList().indexOf(cmd) >= 0) {
            await obs.msg.channel.send(`The action "${cmd}" doesn't come with a help`);
        } else {
            await obs.msg.channel.send(`Non-existent action "${cmd}"`);
        }
    },
    onHelp: async (msg : Discord.Message) => {
        await msg.channel.send('Write ``ob explain <action_name>`` to show help for that action');
    }
};