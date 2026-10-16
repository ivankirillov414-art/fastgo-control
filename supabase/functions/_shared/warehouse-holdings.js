import {createNativeEngine} from './native-engine.js';
export function masterHoldings(sheets){if(!sheets['События'])return [];return createNativeEngine(sheets).run('master_holdings',{}, {id:'internal-holdings',role:'owner'});}
