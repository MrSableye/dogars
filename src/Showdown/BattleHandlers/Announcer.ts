import BasicHandler from "./BasicHandler";
import { BattleEvents } from "../PSMessage";
import InfoAggregator from "./InfoAggregator";
import { MemeStats } from "../BattleData";

const specials = {
    'Charizard': 'Charizard Chipper',
    'Volcarona': 'Volcarona Vitiater',
    'Moltres': 'Moltres Mutiler',
    'Talonflame': 'Talonflame Trimmer'
}

const pebbles = [
    'Aggressive Aggregate', 'Astucious Asphalt',
    'Buried Boulders',
    'Concealed Cobblestone', 'Covert Corundum',
    'Deceiving Deposit', 'Disguised Debris',
    'Elusive Elements',
    'Furtive Flint',
    'Guileful Granite',
    'Hidden Hornfels',
    'Insidious Iridium', 'Inconceivable Iron',
    'Keen Kryptonite',
    'Latent Lead', 'Lurking Limestone',
    'Merciless Minerals', 'Metaphorical Moth Balls',
    'Ninja Nuggets',
    'Obscure Ore',
    'Pernicious Pebbles',
    'Rusing Radium', 'Reclusive Rocks',
    'Sacrilegious Shards', 'Shrouded Sediment', 'Smogon Stones',
    'Terrorizing Tectinics', 'Tricky Terrain',
    'Veiled Variolite',
    'Zetetic Zircon'
];

let skillmessage = '👌😭 ahahah he did ìt again h0ly shit the💃AbIaZoLUTE💃MadMaN💃 IT JUST KEeps geeting FuNniER EVERy 🍆fucking🍑⏳TIme⌛ he flinches it haHAzhAHa 👌😭 📞 OPErATOR give mE The p👮Lice thEre’s a💃 MADmaN💃maKIN 🐸skill🐸 in oUr MIDsT and I CAN’T bREATHe 👌😨'

let mpebbles: string[] = [];

let shuffle = <T>(arr: Array<T>) => {
    let currentIndex = arr.length, temporaryValue, randomIndex;
    while (currentIndex != 0) {
        randomIndex = ~~(Math.random() * currentIndex--);
        temporaryValue = arr[currentIndex];
        arr[currentIndex] = arr[randomIndex];
        arr[randomIndex] = temporaryValue;
    }
    return arr;
}

export default class Announcer extends BasicHandler {
    private warned: boolean = false;
    ia: InfoAggregator;

    constructor(ia: InfoAggregator) {
        super();
        this.ia = ia;
    }

    nummons: { p1: number, p2: number } = { p1: 0, p2: 0 };
    async teamsize(ts: BattleEvents['teamsize']) {
        let s: number = +ts[2];
        if (s < 6) {
            this.account.message(this.roomname, `psh,., i only need ${s},,.kid... nothin personel,,..,`);
        }
        this.nummons[ts[1] as 'p1' | 'p2'] = s;
    }

    async inactive(i: BattleEvents['inactive']) {
        if (this.warned)
            return;
        if (i[1].includes(this.ia.guessedChamp.showdown_name))
            return;
        if (i[1].includes('left'))
            return;
        this.warned = true;
        this.account.message(this.roomname, `wtf turn that off`);
    }

    async cant(c: BattleEvents['cant']) {
        if (c[2] == 'flinch' || c[2] == 'par') {
            if (c[2] == 'flinch' && this.turnFlags['fotarget'] && this.turnFlags['fotarget'] == c[1])
                return;
            if (this.turnFlags['currentTurn'] == this.battleFlags.lastSkillTurn + 1) {
                this.battleFlags.consecutiveSkill++;
            }
            this.battleFlags.lastSkillTurn = this.turnFlags['currentTurn'];
            this.account.message(this.roomname, this.battleFlags.consecutiveSkill < 3 ? `nice skill` : skillmessage);
        }
    }

    async move(m: BattleEvents['move']) {
        if (m[3].includes('hoge') && m[4] && m[4] == '[miss]') {
            this.account.message(this.roomname, `HOGE! HOGE! H O G E!`);
        } else if (m[2] == 'Scald') {
            this.turnFlags['scalder'] = m[1];
        } else if (m[2] == 'Fake Out') {
            this.account.message(this.roomname, 'FREE');
            this.turnFlags['fotarget'] = m[3];
        } else if (m[2] == 'Baneful Bunker') {
            this.account.message(this.roomname, 'Bane?');
        } else if (m[2] == 'Stealth Rock') {
            if (mpebbles.length == 0)
                mpebbles = shuffle(pebbles.slice());
            let p = mpebbles.splice(mpebbles.length - 1, 1)[0];
            let oppot = m[3].substr(0, 2) as 'p1' | 'p2';
            let c_or_v: MemeStats | undefined;
            if ((c_or_v = this.ia.battlers[oppot].team.find(mon => Object.keys(specials).includes(mon.species))))
                p = specials[c_or_v.species as keyof typeof specials];
            let mon = m[1].substr(5);
            if (Math.random() < 0.125)
                this.account.message(this.roomname, `あいての ${mon}の **「${p}」**!`);
            else
                this.account.message(this.roomname, `The opposing ${mon} used **${p}**!`);
        }
    }

    async "-status"(s: BattleEvents['-status']) {
        if (s[2] == 'brn' && this.turnFlags['scalder'] && this.turnFlags['scalder'] != s[1]) {
            if (s[3] !== undefined && s[3]!.includes('[from] item'))
                return;
            this.account.message(this.roomname, `le hot water of skill claims another`);
        }
    }

    turnFlags: any = {};
    battleFlags = {
        consecutiveSkill: 0,
        lastSkillTurn: 0 
    };

    async turn(t: BattleEvents['turn']) {
        this.turnFlags = {};
        this.turnFlags['currentTurn'] = +t[1];
    }

    async "-crit"(c: BattleEvents['-crit']) {
        this.turnFlags['critted'] = c[1];
    }

    async "faint"(c: BattleEvents['faint']) {
        if (this.turnFlags['critted'] == c[1]) {
            this.account.message(this.roomname, 'crit mattered');
        }
        let pl = c[1].substr(0, 2) as 'p1' | 'p2';
        this.nummons[pl]--;
    }

    async '-message'() {
        this.turnFlags['ff'] = true;
    }

    async win(w: BattleEvents['win']) {
        super.win(w);
        if (this.turnFlags['ff']) {
            this.account.message(this.roomname, 'bullied');
            return;
        }
        if (Math.random() < 0.41)
            return;
        let diff = this.nummons.p1 - this.nummons.p2;
        diff = diff < 0 ? -diff : diff;
        let mes = [
            'wtf',
            'that was close',
            'bg',
            'bg',
            'bg',
            'no 6-0 bg',
            '6-0 bg hacker'
        ];
        if (w[1].includes(this.ia.guessedChamp.showdown_name))
            this.account.message(this.roomname, 'ez win gg ' + this.ia.guessedChamp.showdown_name);
        else
            this.account.message(this.roomname, mes[diff]);
    }
}
