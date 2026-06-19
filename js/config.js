const firebaseConfig = {
  apiKey: "AIzaSyDhYg6l_aBZRAm8WoXWQIcxFaIIcmArl-c",
  authDomain: "wccc-dff55.firebaseapp.com",
  projectId: "wccc-dff55",
  storageBucket: "wccc-dff55.firebasestorage.app",
  messagingSenderId: "677739951203",
  appId: "1:677739951203:web:49da77e651e8af68c3b456"
};
const DATA_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
const SQUADS_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.squads.json';
const TEAM_ALIAS = { 'United States': 'USA', 'Bosnia and Herzegovina': 'Bosnia & Herzegovina' };
const KO_START = new Date('2026-06-28T00:00:00Z');

const KO_POINT = 2;
const CHAMPION_BONUS = 15;
const ROUND_VI = { 'Round of 32': 'Vòng 1/16', 'Round of 16': 'Vòng 1/8', 'Quarter-final': 'Tứ kết', 'Semi-final': 'Bán kết', 'Match for third place': 'Tranh hạng 3', 'Final': 'Chung kết' };

const BRACKET_FEEDS = { 89:[74,77], 90:[73,75], 91:[76,78], 92:[79,80], 93:[83,84], 94:[81,82], 95:[86,88], 96:[85,87], 97:[89,90], 98:[93,94], 99:[91,92], 100:[95,96], 101:[97,98], 102:[99,100], 103:[101,102], 104:[101,102] };
const BRACKET_COLS = [
    [74,77,73,75,83,84,81,82,76,78,79,80,86,88,85,87],
    [89,90,93,94,91,92,95,96],
    [97,98,99,100],
    [101,102],
    [104]
];

const FLAGS = {
    'Algeria':'DZ','Argentina':'AR','Australia':'AU','Austria':'AT','Belgium':'BE','Bosnia & Herzegovina':'BA','Brazil':'BR','Canada':'CA','Cape Verde':'CV','Colombia':'CO','Croatia':'HR','Curaçao':'CW','Czech Republic':'CZ','DR Congo':'CD','Ecuador':'EC','Egypt':'EG','France':'FR','Germany':'DE','Ghana':'GH','Haiti':'HT','Iran':'IR','Iraq':'IQ','Ivory Coast':'CI','Japan':'JP','Jordan':'JO','Mexico':'MX','Morocco':'MA','Netherlands':'NL','New Zealand':'NZ','Norway':'NO','Panama':'PA','Paraguay':'PY','Portugal':'PT','Qatar':'QA','Saudi Arabia':'SA','Senegal':'SN','South Africa':'ZA','South Korea':'KR','Spain':'ES','Sweden':'SE','Switzerland':'CH','Tunisia':'TN','Turkey':'TR','Uruguay':'UY','USA':'US','Uzbekistan':'UZ'
};

function flagCode(team) {
    if (team === 'England') return 'gb-eng';
    if (team === 'Scotland') return 'gb-sct';
    return (FLAGS[team] || '').toLowerCase();
}
function flagOf(team) {
    const code = flagCode(team);
    if (!code) return '⚽';
    return `<img src="https://flagcdn.com/w40/${code}.png" alt="" class="inline-block w-6 h-4 object-cover rounded-sm align-[-3px] mr-1 shadow-sm ring-1 ring-white/10">`;
}
