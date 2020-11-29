import fs = require('fs');
import request = require('request-promise-native');

import { PSConnection, Sink } from './PSConnection';
import { ShowdownMon } from './ShowdownMon';
import { PSRequest, GlobalEventsType, ConnectionRequest, PSRoomMessageRequest, BattleEventsType } from './PSMessage';
import { settings } from '../Backend/settings';
import { toId } from '../Website/utils';
import type { RoomID } from './PSRoom';
import { Agent } from 'https';

let sids: { [key: string]: { sid: string, exp: number } } = {};

let sidsfile = settings.ressources + '/sids.json';
if (fs.existsSync(sidsfile))
	sids = JSON.parse(fs.readFileSync(sidsfile).toString());

export enum LoginError {
	ChallengeFailed,
	UnexpectedResponse,
	MalformedAssertion
};

export type LoginForm = {
	act: 'login';
	challstr: string;
	name: string;
	pass?: string;
} | {
	act: 'upkeep';
	userid?: string;
	challstr: string;
} | {
	act: 'getassertion';
	userid?: string;
	challstr: string;
} | {
	act: 'changepassword';
	oldpassword?: string;
	password?: string;
	cpassword?: string;
}

export let upkeep = async (sid: string, challstr: string) => {
	let data: LoginForm = { act: 'upkeep', challstr };
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
		form: data,
		timeout: 10000,
		headers: {
			Cookie: `sid=${sid}`
		}
	});
	if (body[0] == ';') {
		throw LoginError.ChallengeFailed;
	}
	if (body[0] != ']')
		throw LoginError.UnexpectedResponse;
	body = body.substr(1);
	body = JSON.parse(body);
	if (!body.assertion || body.assertion[0] == ';') {
		throw LoginError.MalformedAssertion;
	}
	return body.assertion;
}

export let _getassertion = async (user: string, pass: string | undefined, challenge: string, proxy?: Agent): Promise<[string, string]> => {
	let regged = pass !== undefined;
	let data: LoginForm | null;
	let jar = request.jar();
	if (regged) {
		data = { challstr: challenge, act: 'login', name: user, pass};
	} else {
		data = { act: 'getassertion', userid: user, challstr: challenge};
	}
	console.log(data);
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
		form: data,
		timeout: 10000,
		jar: jar,
		agent: proxy
	});
	if (body[0] == ';') {
		throw LoginError.ChallengeFailed;
	}
	if (regged) {
		if (body[0] != ']')
			throw LoginError.UnexpectedResponse;
		body = body.substr(1);
		body = JSON.parse(body);
		if (body.assertion[0] == ';') {
			console.error(body);
			throw LoginError.MalformedAssertion;
		}
		let cookies = jar.getCookies('http://pokemonshowdown.com/');
		cookies = cookies.filter(c => c.key == 'sid');
		return [cookies[0]?.value, body.assertion];
	}
	else if (body.length > 10)
		return ['', body];
	throw LoginError.MalformedAssertion;
}

export let getassertion = async (user: string, pass: string | undefined, challenge: string, proxy?: Agent): Promise<[string, string]> => {
	try {
		return await _getassertion(user, pass, challenge, proxy);
	} catch (e) {
		return await _getassertion(user, pass, challenge, undefined);
	}
}

export class Player {
	con: PSConnection;
	user?: string;
	pass?: string;
	sid?: string;
	teamCache: Map<string, ShowdownMon[]> = new Map<string, ShowdownMon[]>();
	guest = false;

	constructor(user?: string, pass?: string) {
		let regged = pass !== undefined;
		this.guest = !regged && user === undefined;
		this.user = user;
		this.pass = pass;

		let agent: Agent | undefined;
		this.con = new PSConnection();
	}

	async connect() {
		this.con.onstart = async () => {
			let challstr: string = this.con.challstrraw;
			let sid;
			let connected = true;

			if (this.user) {
				let now = Date.now();
				if (sids[toId(this.user)]) {
					if (sids[toId(this.user)].exp > +now) {
						sid = sids[toId(this.user)].sid;
					}
				}
				let assertion: string | undefined;
				if (sid) {
					try {
						assertion = await upkeep(sid, challstr);
					} catch (e) {
						console.log('Failed to reuse sid, relogin in...', e);
					}
				}
				if (!assertion) {
					try {
						console.log('getting ass for', this.user);
						[sid, assertion] = await getassertion(this.user!, this.pass, challstr);
					} catch (e) {
						console.log('failed getting ass for', this.user, e);
						if (e == LoginError.MalformedAssertion)
							[sid, assertion] = await getassertion(this.user!, this.pass, challstr);
						else {
							throw new Error("Shit broke");
						}
					}
					let exp = now + 6 * 30 * 24 * 60 * 60 * 1000; // expires in 6 months
					if (sid)
						sids[toId(this.user)] = { sid, exp };
					fs.writeFile(sidsfile, JSON.stringify(sids), () => console.log(`saved session for ${this.user}`));
				}
				connected = await this.request(new ConnectionRequest(this.user!, assertion));
			}

			if (connected) {
				console.log('Successfully logged in');
			}
		}
		await this.con.start();
	}

	tryJoin(room: RoomID) {
		return this.con.joinRoom(room);
	}

	tryLeave(room: string) {
		return this.con.leaveRoom(room);
	}

	async message(room: RoomID, str: string) {
		this.tryJoin(room);
		await this.request(new PSRoomMessageRequest(room, str));
		this.con.send(`${room}|${str}`, Sink.Dogars); // Todo: Detect modchat, and if modchat then dogars, else showdown
	}

	forfeit(battle: RoomID) {
		this.message(battle, '/forfeit');
	}

	setTeam(team: string) {
		this.message('' as RoomID, `/utm ${team}`);
	}

	async getMyTeam(battle: RoomID) {
		this.tryJoin(battle);
		if (this.teamCache && this.teamCache.has(battle))
			return this.teamCache.get(battle);
		let room = this.con.rooms.get(battle)!;
		let event = await room.read('request');
		try {
			let req = JSON.parse(event[1]);
			if (!req.side || !req.side.pokemon)
				throw 'No side pokemons';
			this.teamCache.set(battle, req.side.pokemon!);
		} catch (e) {
			console.log('could not set team:', e);
		}
		return this.teamCache.get(battle);
	}

	request<T extends GlobalEventsType | BattleEventsType, R>(req: PSRequest<T, R>) {
		return this.con.request(req);
	}

	getBattles() {
		return this.con.rooms.keys();
	}

	disconnect() {
		this.con.close();
	}
}
