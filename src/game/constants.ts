export const PLAYER_MAX_HP = 50
export const ENERGY_PER_TURN = 3
export const DRAW_PER_TURN = 5
export const HAND_LIMIT = 10
export const VICTORY_HEAL = 8
export const BATTLE_COUNT = 3
/** 最近战斗事件的保留条数。界面漏掉一次渲染时，仍可按编号补读还留在缓冲里的事件。 */
export const EVENT_BUFFER_LIMIT = 64
/** 最终命中率下限。基础命中率、瞄准和闪避都先算完，再夹到这个区间。 */
export const HIT_CHANCE_MIN = 25
/** 最终命中率上限。 */
export const HIT_CHANCE_MAX = 100
/** 攻击牌没有写基础命中率时使用。100 仍会被闪避降低，不等于必定命中。 */
export const DEFAULT_ATTACK_ACCURACY = 100
/** 瞄准至少有 1 次时，这一张攻击牌获得的命中加成。次数只决定能覆盖几张攻击牌。 */
export const AIM_HIT_BONUS = 20
/** 破绽存在期间提供的命中加成。层数是剩余回合，不按层数加倍。 */
export const EXPOSE_HIT_BONUS = 15
