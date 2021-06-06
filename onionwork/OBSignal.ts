import Discord from "discord.js";
import { OBStatus } from "./OBTools";

export default class OBSignal {
    public client : Discord.Client;
    public msg    : Discord.Message;
    public args   : string; 
    public logs   : OBStatus[];

    public constructor(client : Discord.Client, msg : Discord.Message, args : string) {
        this.client = client;
        this.msg    = msg;
        this.args   = args;
        this.logs   = [];
    }
}