import { defaultSpawnConfig } from '../config/exes.js';

/**
 * The 10 playable training modes. Each mode is a preset over the same live
 * systems (spawner, movement patterns, attack behaviour) so players can
 * switch modes at any time without restarting the game.
 */
function preset(overrides) {
  return { ...defaultSpawnConfig(), ...overrides };
}

export const TRAINING_MODES = [
  {
    id: 'precision',
    name: '1. Precision Practice',
    desc: 'Hit stationary targets at selectable distances. Distance dial controls where the EXE stands (10–250 studs).',
    setup: (game) => {
      game.spawner.setConfig(preset({ mode: 'stationary', distance: 60, facing: -1, count: 1 }));
      game.spawner.removeAll();
      game.spawner.spawn(game.player.position, game.player.yaw);
    }
  },
  {
    id: 'tracking',
    name: '2. Tracking Practice',
    desc: 'Moving EXEs strafe and weave — land accurate shots on moving targets and earn Moving-Target style bonuses.',
    setup: (game) => {
      game.spawner.setConfig(preset({ mode: 'moving', pattern: 'zigzag', speed: 1.1, areaRadius: 55, count: 2 }));
      game.spawner.removeAll();
      game.spawner.spawn(game.player.position, game.player.yaw);
      game.spawner.spawn(game.player.position, game.player.yaw);
    }
  },
  {
    id: 'reaction',
    name: '3. Reaction Practice',
    desc: 'Targets despawn and reappear at random distances — hit them as fast as possible after they become targetable.',
    setup: (game) => {
      game.spawner.setConfig(preset({ mode: 'stationary', distance: 50, facing: -1, autoRespawn: true, count: 2 }));
      game.spawner.removeAll();
      game.spawner.spawn(game.player.position, game.player.yaw);
      game.spawner.spawn(game.player.position, game.player.yaw);
      game.reactionDrill = true;
    }
  },
  {
    id: 'windup',
    name: '4. Attack-Windup Practice',
    desc: 'Attacking EXEs telegraph real windups — land your stun inside the windup window for Attack-Interrupt style points.',
    setup: (game) => {
      game.reactionDrill = false;
      game.spawner.setConfig(preset({ mode: 'attacking', difficulty: 'normal', aggression: 0.85, canDamagePlayer: true, count: 1 }));
      game.spawner.removeAll();
      game.spawner.spawn(game.player.position, game.player.yaw);
    }
  },
  {
    id: 'maxrange',
    name: '5. Maximum-Range Testing',
    desc: 'A lane of stationary EXEs at 80/120/160/200/250 studs reveals the true effective range of every ability.',
    setup: (game) => {
      game.reactionDrill = false;
      game.spawner.setConfig(preset({ mode: 'stationary', facing: -1, canDamagePlayer: false, count: 1 }));
      game.spawner.removeAll();
      for (const dist of [80, 120, 160, 200, 250]) {
        const d = game.spawner.spawn(game.player.position, game.player.yaw);
        if (d) {
          d.position.set(game.player.position.x, 0, game.player.position.z - dist);
          d.homePosition.copy(d.position);
          d.config.distance = dist;
        }
      }
    }
  },
  {
    id: 'travel',
    name: '6. Projectile Travel Practice',
    desc: 'Targets step in and out of cover at range — learn projectile speed, travel time and lead angles (Travel-Time style bonus).',
    setup: (game) => {
      game.reactionDrill = false;
      game.spawner.setConfig(preset({ mode: 'moving', pattern: 'straight', speed: 1.2, areaRadius: 70, distance: 110, count: 2 }));
      game.spawner.removeAll();
      for (let i = 0; i < 2; i++) {
        const d = game.spawner.spawn(game.player.position, game.player.yaw);
        if (d) {
          d.position.set(game.player.position.x + (i ? 18 : -18), 0, game.player.position.z - 110);
          d.homePosition.copy(d.position);
          d.facingYaw = Math.PI / 2 * (i ? 1 : -1);
          d.pattern = 'straight';
        }
      }
    }
  },
  {
    id: 'laser',
    name: '7. Laser Practice',
    desc: 'Compare Tails\' laser types side by side: Default plasma beam, Burst shockwave and the announced rework modes. Mode panel switches instantly.',
    setup: (game) => {
      game.reactionDrill = false;
      game.spawner.setConfig(preset({ mode: 'stationary', facing: -1, distance: 70, canDamagePlayer: false, count: 3 }));
      game.spawner.removeAll();
      for (const off of [-25, 0, 25]) {
        const d = game.spawner.spawn(game.player.position, game.player.yaw);
        if (d) {
          d.position.set(game.player.position.x + off, 0, game.player.position.z - 70);
          d.homePosition.copy(d.position);
        }
      }
      game.setActiveCharacter('tails');
    }
  },
  {
    id: 'amy',
    name: '8. Amy Ability Practice',
    desc: 'Train Tarot Card Toss, Hammer Throw and the swing separately — card deck live, so each throw reflects your current stun duration.',
    setup: (game) => {
      game.reactionDrill = false;
      game.setActiveCharacter('amy');
      game.spawner.setConfig(preset({ mode: 'moving', pattern: 'strafe', speed: 0.8, distance: 45, areaRadius: 35, count: 2 }));
      game.spawner.removeAll();
      game.spawner.spawn(game.player.position, game.player.yaw);
      game.spawner.spawn(game.player.position, game.player.yaw);
    }
  },
  {
    id: 'combat',
    name: '9. Full Combat Practice',
    desc: 'Active EXEs pursue and attack you. Survive while landing stuns — they will try to defeat you if your damage settings allow it.',
    setup: (game) => {
      game.reactionDrill = false;
      game.spawner.setConfig(preset({
        mode: 'full', aggression: 0.75, difficulty: 'normal',
        canDamagePlayer: true, autoRespawn: true, resetAfterStun: false, count: 2
      }));
      game.spawner.removeAll();
      game.spawner.spawn(game.player.position, game.player.yaw);
      game.spawner.spawn(game.player.position, game.player.yaw);
    }
  },
  {
    id: 'custom',
    name: '10. Custom Practice',
    desc: 'Combine character, ability, distance, movement and EXE behaviour freely. Every spawner control is unlocked in this mode.',
    setup: (game) => {
      game.reactionDrill = false;
      game.spawner.setConfig(preset({ mode: 'full' }));
      game.spawner.removeAll();
      game.spawner.spawn(game.player.position, game.player.yaw);
    }
  }
];

export function getMode(id) {
  return TRAINING_MODES.find((m) => m.id === id) || TRAINING_MODES[0];
}
