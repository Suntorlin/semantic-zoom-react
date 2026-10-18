// The same content as the Flutter example app (example/lib/main.dart of
// semantic_zoom, (c) Roshen De Zoysa, MIT), so both demos can be compared
// side by side.
import { LeveledText } from '../../../src'

export const trip: [date: string, place: string, text: LeveledText][] = [
  [
    'Sun 15 Sep',
    'Lisbon',
    LeveledText.parse(
      '[Took] Tram 28 [up] to **Alfama**{, standing room only and every curve a ' +
        'small adventure}[. Got lost on purpose and found a tiny bakery.]\n' +
        '{Pastéis de nata still warm from the oven. I ate three before ' +
        'admitting it was lunch.}',
    ),
  ],
  [
    'Mon 16 Sep',
    'Sintra',
    LeveledText.parse(
      'Day trip to [Sintra](https://en.wikipedia.org/wiki/Sintra)[. ' +
        '**Pena Palace** was lost in fog]{ until noon, then the ' +
        'whole valley opened up below us}[. Walked back down through the ' +
        'forest.] {My legs will remember this tomorrow.}',
    ),
  ],
  [
    'Tue 17 Sep',
    'Lisbon',
    LeveledText.parse(
      '*Fado* {night} in **Mouraria**[, a tiny room with twelve tables.] {The singer ' +
        'closed her eyes for the last song and nobody moved, not even the ' +
        'waiters.}',
    ),
  ],
  [
    'Wed 18 Sep',
    'Porto',
    LeveledText.parse(
      'Train to Porto[, three hours along the coast.] {Window seat on the ' +
        'left, as the ticket inspector advised.}\n' +
        '[Sunset from the] Dom Luís Bridge{ with half the city doing the same ' +
        'thing}[.]',
    ),
  ],
  [
    'Thu 19 Sep',
    'Porto',
    LeveledText.parse(
      'Port tasting [in Gaia]{: tawny, ruby, and a white I did not expect to ' +
        'like}[. Bought one bottle for home.] {Then a second, just in case.}',
    ),
  ],
  [
    'Fri 20 Sep',
    'Porto',
    LeveledText.parse(
      'Livraria Lello[ at opening time]{, before the queue wrapped around the ' +
        'block}[, then coffee by the river.] {Already planning the next trip.}',
    ),
  ],
]

export const threads: [from: string, time: string, versions: string[]][] = [
  [
    'Maya · Design',
    '9:41',
    [
      'Onboarding mockups ready for review',
      'Onboarding mockups from Maya are ready for review by Thursday',
      'Onboarding mockups from Maya are ready for review in Figma. She ' +
        'prefers option B, which cuts signup to two steps, and needs ' +
        'feedback by Thursday so engineering can start next sprint.',
    ],
  ],
  [
    'Leo · Support',
    '9:12',
    [
      'Checkout crash fixed',
      'Android checkout crash is fixed in version 4.2.1',
      'The checkout crash affecting some Android 14 users is fixed in ' +
        'version 4.2.1, now rolling out to 20% of users. Leo will close the ' +
        'tickets once the crash rate stays flat for 48 hours.',
    ],
  ],
  [
    'Finance',
    'Yesterday',
    [
      'Q3 budget approved',
      'Q3 budget approved with a 5% cut to travel',
      'Q3 budget approved with a 5% cut to travel. Trips already booked are ' +
        'unaffected; new ones need director sign-off from October.',
    ],
  ],
  [
    'Sam · People team',
    'Mon',
    [
      'Offsite moved to Friday',
      'Team offsite moved to Friday because of the rail strike',
      'Team offsite moved from Thursday to Friday because of the rail ' +
        'strike. Same venue and agenda; Sam is sending new invites today.',
    ],
  ],
]

export const articles: [title: string, text: LeveledText][] = [
  [
    'Designing for one hand',
    LeveledText.parse(
      'Most phone use is **one-handed**[, so the thumb decides what is easy ' +
        'to reach.]{ Put frequent actions in the bottom third of the screen, ' +
        'keep destructive ones out of easy reach, and test on the largest ' +
        'phones your users own. See the ' +
        '[Material layout guide](https://m3.material.io/foundations/layout/understanding-layout/overview).}',
    ),
  ],
  [
    'Why offline-first feels faster',
    LeveledText.parse(
      'Offline-first apps feel faster[ because they read local data first]' +
        '{ and sync in the background. People never wait for the network to ' +
        'see what they already have, and a flaky connection stops being an ' +
        'error screen.}',
    ),
  ],
  [
    'In Chinese: a day in Porto',
    LeveledText.parse(
      '我们坐火车去了**波尔图**[，沿着海岸线一路向北]' +
        '{。下午在河边散步，晚上在一家小餐馆吃了晚饭，窗外的风景非常美丽。}',
    ),
  ],
  [
    'In Sinhala: the train to Ella',
    LeveledText.parse(
      'ඇල්ල දක්වා **දුම්රිය** ගමන[, මහනුවර සිට පැය හයක් පමණ]' +
        '{. කඳුකරයේ තේ වතු, දිය ඇලි සහ මීදුම අතරින් යන මේ ගමන ' +
        'ශ්‍රී ලංකාවේ ලස්සනම දුම්රිය ගමනයි.}',
    ),
  ],
  [
    'Accessibility is a feature',
    LeveledText.parse(
      'Screen readers[, larger text] and reduced motion[ are used by more ' +
        'people than most teams expect.]{ Designing for them early is cheaper ' +
        'than retrofitting, and it usually makes the app *better for ' +
        'everyone*.}',
    ),
  ],
]
