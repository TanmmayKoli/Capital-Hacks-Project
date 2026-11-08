// One icon system: Tabler outline icons (MIT), inlined as SVG so they inherit text colour.
import moodAngry from '@tabler/icons/outline/mood-angry.svg?raw';
import moodNervous from '@tabler/icons/outline/mood-nervous.svg?raw';
import moodSad from '@tabler/icons/outline/mood-sad.svg?raw';
import tornado from '@tabler/icons/outline/tornado.svg?raw';
import user from '@tabler/icons/outline/user.svg?raw';
import helpCircle from '@tabler/icons/outline/help-circle.svg?raw';
import laptopOff from '@tabler/icons/outline/device-laptop-off.svg?raw';
import wind from '@tabler/icons/outline/wind.svg?raw';
import sun from '@tabler/icons/outline/sun.svg?raw';
import cloudRain from '@tabler/icons/outline/cloud-rain.svg?raw';
import ripple from '@tabler/icons/outline/ripple.svg?raw';
import piano from '@tabler/icons/outline/piano.svg?raw';
import circleDot from '@tabler/icons/outline/circle-dot.svg?raw';
import headphones from '@tabler/icons/outline/headphones.svg?raw';
import movie from '@tabler/icons/outline/movie.svg?raw';
import gamepad from '@tabler/icons/outline/device-gamepad-2.svg?raw';
import pizza from '@tabler/icons/outline/pizza.svg?raw';
import music from '@tabler/icons/outline/music.svg?raw';
import palette from '@tabler/icons/outline/palette.svg?raw';
import compass from '@tabler/icons/outline/compass.svg?raw';
import volume from '@tabler/icons/outline/volume.svg?raw';
import circleCheck from '@tabler/icons/outline/circle-check.svg?raw';
import playerPlay from '@tabler/icons/outline/player-play.svg?raw';
import handStop from '@tabler/icons/outline/hand-stop.svg?raw';
import moodSmile from '@tabler/icons/outline/mood-smile.svg?raw';
import school from '@tabler/icons/outline/school.svg?raw';
import userHeart from '@tabler/icons/outline/user-heart.svg?raw';
import users from '@tabler/icons/outline/users.svg?raw';
import book from '@tabler/icons/outline/book.svg?raw';
import shuffle from '@tabler/icons/outline/arrows-shuffle.svg?raw';
import flame from '@tabler/icons/outline/flame.svg?raw';
import activity from '@tabler/icons/outline/activity.svg?raw';
import squeeze from '@tabler/icons/outline/arrows-minimize.svg?raw';
import zzz from '@tabler/icons/outline/zzz.svg?raw';
import weight from '@tabler/icons/outline/weight.svg?raw';
import usersGroup from '@tabler/icons/outline/users-group.svg?raw';
import bulb from '@tabler/icons/outline/bulb.svg?raw';
import userX from '@tabler/icons/outline/user-x.svg?raw';
import presentation from '@tabler/icons/outline/presentation.svg?raw';
import battery from '@tabler/icons/outline/battery-1.svg?raw';
import message from '@tabler/icons/outline/message-circle.svg?raw';
import eyeOff from '@tabler/icons/outline/eye-off.svg?raw';
import friends from '@tabler/icons/outline/friends.svg?raw';
import handGrab from '@tabler/icons/outline/hand-grab.svg?raw';
import bottle from '@tabler/icons/outline/bottle.svg?raw';
import pencil from '@tabler/icons/outline/pencil.svg?raw';
import thumbUp from '@tabler/icons/outline/thumb-up.svg?raw';
import thumbDown from '@tabler/icons/outline/thumb-down.svg?raw';
import moodNeutral from '@tabler/icons/outline/mood-neutral.svg?raw';
import moodHappy from '@tabler/icons/outline/mood-happy.svg?raw';
import leaf from '@tabler/icons/outline/leaf.svg?raw';
import award from '@tabler/icons/outline/award.svg?raw';
import sparkles from '@tabler/icons/outline/sparkles.svg?raw';
import walk from '@tabler/icons/outline/walk.svg?raw';
import route from '@tabler/icons/outline/route.svg?raw';
import clock from '@tabler/icons/outline/clock.svg?raw';
import pause from '@tabler/icons/outline/player-pause.svg?raw';
import skip from '@tabler/icons/outline/player-skip-forward.svg?raw';

const RAW = {
  angry: moodAngry, scared: moodNervous, sad: moodSad, overwhelmed: tornado, lonely: user, unsure: helpCircle,
  laptop: laptopOff, wind, sun, rain: cloudRain, waves: ripple, piano, breathe: circleDot, headphones,
  movie, gamepad, pizza, music, palette, compass, volume, check: circleCheck, play: playerPlay,
  hand: handStop, smile: moodSmile, school, student: userHeart,
  users, book, shuffle, flame, activity, squeeze, zzz, weight,
  crowd: usersGroup, bulb, userX, presentation, battery, message,
  eyeOff, friends, handGrab, bottle, pencil, thumbUp, thumbDown, neutral: moodNeutral, happy: moodHappy, leaf, award, sparkles, walk, route, clock, pause, skip,
};

// icon('angry') -> inline SVG, decorative by default (the visible label carries the meaning).
export function icon(name, { size = '1.25em', cls = '' } = {}) {
  const raw = RAW[name];
  if (!raw) return '';
  return raw
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/class="[^"]*"/, `class="ic ${cls}" width="${size}" height="${size}" aria-hidden="true" focusable="false"`);
}
