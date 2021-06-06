export enum OBStatusType {
    SUCCESS,
    WARNING,
    FAILURE
}

export class OBStatus {
    public type : OBStatusType;
    public text : string;

    public constructor(type : OBStatusType, text : string) {
        this.type = type;
        this.text = text;
    }

    public static success(text : string) : OBStatus {
        return new OBStatus(OBStatusType.SUCCESS, text);
    }

    public static warning(text : string) : OBStatus {
        return new OBStatus(OBStatusType.WARNING, text);
    }

    public static failure(text : string) : OBStatus {
        return new OBStatus(OBStatusType.FAILURE, text);
    }
}

export class OBStatusLoad extends OBStatus {
    public data : any;

    public constructor(type : OBStatusType, text : string, data : any) {
        super(type, text);
        this.data = data;
    }

    public static successLoad(text : string, data : any) : OBStatusLoad {
        return new OBStatusLoad(OBStatusType.SUCCESS, text, data);
    }

    public static warningLoad(text : string, data : any) : OBStatusLoad {
        return new OBStatusLoad(OBStatusType.WARNING, text, data);
    }

    public static failureLoad(text : string, data : any) : OBStatusLoad {
        return new OBStatusLoad(OBStatusType.FAILURE, text, data);
    }
}

export class SimpleLexer {
    private source : string;
    private cursor : number;

    public constructor(source : string) {
        this.source = source;
        this.cursor = 0;
    }

    public lex() : string {
        this.escape();
        const start = this.cursor;
        for (let i = this.cursor; i < this.source.length; i++, this.cursor++) {
            if(this.isEscapable(this.source.charCodeAt(i))) {
                break;
            } else {
                continue;
            }
        }
        return this.source.slice(start, this.cursor);
    }

    public getCursorEscaped() : number {
        this.escape();
        return this.cursor;
    }

    private escape() {
        for (let i = this.cursor; i < this.source.length; i++, this.cursor++) {
            if(this.isEscapable(this.source.charCodeAt(i))) {
                continue;
            } else {
                break;
            }
        }
    }

    private isEscapable(c : number) : boolean {
        return (c === 0x20)
            || (c === 0x09)
            || (c === 0x0B)
            || (c === 0x0C)
            || (c === 0xA0)
            || (c === 0x0A)
            || (c === 0x0D)
            || (c === 0x2028)
            || (c === 0x2029);
    }
}

// || (c >= 0x1680 && [0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF].indexOf(c) >= 0);