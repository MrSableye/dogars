import { MemeStats } from "../Showdown/BattleData";
import { BattleURL } from "../Backend/CringeCompilation";

export class Champ {
	avatar: string = '166';
	current_battle?: BattleURL;
	name: string = '';
	trip: string = '';
	showdown_name: string = '';
	active: boolean = false;
	deaddrip: boolean = false;
	last_active: number = 0;
	jacked: boolean = false;
	regged: boolean = false;
	possible_names: string[] = [];
	team: MemeStats[] = [];
}