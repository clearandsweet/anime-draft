export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Normalized shape matches the Character type used by the lobby system:
//   id          → Pokédex/form ID
//   name.full   → Display name ("Charizard", "Mega Charizard X", "Alolan Raichu")
//   name.native → Types string ("Fire / Flying")
//   gender      → Generation string ("Gen 1", "Gen 2", … "Form")
//   image.large → Image URL
//   favourites  → Rough popularity proxy (higher for earlier gens)

type NormalizedPokemon = {
  id: number;
  name: { full: string; native: string };
  gender: string;
  image: { large: string };
  favourites: number;
};

// Module-level cache — survives across requests on a warm instance
let pokemonCache: NormalizedPokemon[] | null = null;
let cacheBuilding: Promise<NormalizedPokemon[]> | null = null;

const POKEAPI_BASE = "https://pokeapi.co/api/v2";

// PokeAPI returns ~1300 Pokemon including alternate forms when limit=2000
const POKEMON_LIMIT = 2000;

const TYPE_NAMES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

function getGeneration(id: number): string {
  if (id <= 151) return "Gen 1";
  if (id <= 251) return "Gen 2";
  if (id <= 386) return "Gen 3";
  if (id <= 493) return "Gen 4";
  if (id <= 649) return "Gen 5";
  if (id <= 721) return "Gen 6";
  if (id <= 809) return "Gen 7";
  if (id <= 905) return "Gen 8";
  if (id <= 1025) return "Gen 9";
  return "Form";
}

function getImageUrl(id: number): string {
  // Official artwork exists for base Pokemon (1–1025); forms use front sprites
  if (id >= 1 && id <= 1025) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

// Normalize a Pokemon name for lookup (works on both PokeAPI raw names and display names)
function normalizePokemonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/♂/g, 'm')
    .replace(/♀/g, 'f')
    .replace(/[é]/g, 'e')
    .replace(/[^a-z0-9]/g, '');
}

// Popularity scores from https://thomasgamedocs.com/pokemon/
// Score = Math.round(popularity_percentage * 10)
// Higher score = more popular (more "shame points" in the popularity draft)
const POPULARITY_SCORES: Record<string, number> = {
  umbreon:795,mimikyu:792,sylveon:780,eevee:768,vaporeon:768,rayquaza:764,
  lucario:763,chandelure:763,mew:761,espeon:753,lugia:752,leafeon:751,
  mudkip:751,kyogre:749,lapras:747,mewtwo:747,gengar:746,luxray:746,
  rowlet:742,cyndaquil:741,gardevoir:739,giratina:739,jolteon:738,
  decidueye:738,dragonite:733,lunala:732,suicune:729,bulbasaur:728,
  piplup:727,flygon:726,ninetales:726,garchomp:726,darkrai:726,zoroark:725,
  dragonair:724,empoleon:723,glaceon:721,blastoise:721,greninja:720,
  wooper:720,shaymin:718,zorua:718,scizor:717,typhlosion:715,dialga:714,
  hooh:713,jirachi:711,raichu:711,xerneas:710,ampharos:710,reshiram:710,
  arceus:710,swampert:709,torterra:708,squirtle:707,ivysaur:707,absol:706,
  sprigatito:706,victini:705,flareon:704,arcanine:703,ceruledge:702,
  blaziken:702,litten:701,pikachu:701,snorlax:701,gyarados:699,milotic:699,
  metagross:696,venusaur:695,articuno:695,latias:694,celebi:693,altaria:693,
  oshawott:691,rotom:691,gallade:691,zekrom:690,ditto:688,lycanroc:688,
  dratini:686,corviknight:686,dragapult:686,salamence:685,mismagius:685,
  serperior:685,riolu:682,vulpix:682,goodra:682,furret:681,quagsire:681,
  porygon:680,solgaleo:680,meowscarada:679,primarina:678,spheal:678,
  sceptile:677,clodsire:677,marshadow:676,quilava:676,tyranitar:676,
  charizard:675,cosmog:674,totodile:673,groudon:673,phantump:672,
  rockruff:671,haunter:668,grovyle:667,fennekin:667,mareep:666,porygon2:666,
  pichu:665,wartortle:664,scyther:664,hydreigon:663,noivern:662,zapdos:661,
  snivy:659,porygonz:658,turtwig:657,litwick:657,torchic:656,samurott:655,
  latios:655,deoxys:655,froslass:655,braixen:653,shinx:653,entei:652,
  togepi:652,raikou:652,charmander:650,weavile:650,volcarona:649,
  aegislash:649,breloom:647,trevenant:645,treecko:645,fuecoco:645,
  gliscor:644,skeledirge:644,tinkaton:644,krookodile:643,meloetta:642,
  popplio:641,misdreavus:640,yveltal:640,scorbunny:638,delphox:636,
  heracross:635,growlithe:635,cubone:635,togekiss:634,alakazam:634,
  dewott:634,haxorus:633,froakie:632,miraidon:630,ironvaliant:630,
  palkia:630,aggron:630,crobat:628,ralts:627,mawile:624,zygarde:623,
  floragato:622,feraligatr:622,lilligant:621,sirfetchd:621,aurorus:620,
  meganium:620,sharpedo:620,shedinja:619,slowbro:618,goomy:617,
  incineroar:617,golurk:616,marill:616,azumarill:616,gible:614,torracat:614,
  lampent:613,nidoking:613,cinderace:613,emolga:613,wooloo:610,
  whimsicott:610,snom:610,koraidon:609,joltik:609,sandslash:609,
  spiritomb:609,pachirisu:608,gabite:607,zacian:606,staraptor:606,
  meowth:605,sneasel:605,cinccino:604,houndoom:603,luxio:602,
  walkingwake:601,bayleef:600,gastly:599,reuniclus:599,kyurem:599,
  noibat:598,marowak:598,sableye:598,pumpkaboo:598,excadrill:597,
  beedrill:595,axew:594,infernape:594,sandshrew:592,cresselia:592,
  hawlucha:592,appletun:592,zeraora:591,wailord:591,lurantis:591,
  cofagrigus:590,hydrapple:589,fluttermane:589,regigigas:589,munchlax:589,
  rapidash:588,marshtomp:587,wobbuffet:587,roserade:587,dusknoir:587,
  chikorita:587,diancie:586,poliwhirl:586,slowking:586,bisharp:585,
  toxtricity:585,chienpao:585,farfetchd:584,tropius:584,talonflame:583,
  jigglypuff:582,lopunny:582,servine:582,duskull:581,espurr:581,tepig:580,
  genesect:579,psyduck:578,kangaskhan:578,starmie:578,abra:578,regice:578,
  keldeo:578,necrozma:577,shuckle:577,tapukoko:577,charmeleon:577,
  meowstic:577,banette:576,butterfree:576,kirlia:575,armarouge:575,
  ponyta:575,hatterene:575,gligar:575,clefairy:573,swablu:573,zebstrika:573,
  steelix:573,honchkrow:572,annihilape:572,magnezone:572,oddish:571,
  scolipede:571,phanpy:571,bidoof:571,falinks:570,zigzagoon:569,
  registeel:568,trapinch:568,aron:568,moltres:567,alcremie:567,flaaffy:567,
  machamp:566,ludicolo:566,grookey:566,omanyte:566,politoed:566,virizion:566,
  aerodactyl:565,buizel:565,golisopod:565,slowpoke:565,skarmory:564,
  drakloak:564,galvantula:564,mienshao:563,tyrantrum:563,chespin:563,
  dedenne:562,ogerpon:562,archeops:562,bellossom:562,drifloon:561,
  togetic:561,zamazenta:560,salazzle:560,sobble:559,amaura:559,larvitar:557,
  bewear:557,roselia:557,inteleon:557,drifblim:557,leavanny:557,kartana:557,
  murkrow:556,yamper:556,tsareena:556,minccino:556,skitty:556,dreepy:555,
  poliwrath:555,kommoo:554,sliggoo:554,gogoat:553,magikarp:553,azelf:553,
  houndour:553,kingdra:552,kabutops:551,typenull:551,blissey:551,
  vileplume:550,poliwag:550,azurill:550,nihilego:549,slitherwing:549,
  quaxly:548,floatzel:548,clefable:548,zangoose:547,nidoqueen:547,
  roaringmoon:547,smeargle:546,pangoro:546,rhydon:545,pancham:545,
  pidgeot:545,buneary:544,raboot:544,flapple:543,dwebble:543,frogadier:543,
  toucannon:542,tapufini:542,yamask:542,electivire:541,ribombee:540,
  dartrix:540,vikavolt:540,larvesta:540,xatu:539,abomasnow:539,ironmoth:538,
  zweilous:538,maushold:537,magearna:537,deino:537,gigalith:536,
  spectrier:536,lotad:535,honedge:535,kadabra:534,wigglytuff:533,
  sandile:533,silvally:533,gourgeist:533,palossand:532,wynaut:532,
  magneton:531,runerigus:531,centiskorch:530,krokorok:530,cosmoem:530,
  arbok:530,togedemaru:529,sudowoodo:529,mightyena:529,greattusk:529,
  croconaw:529,obstagoon:529,corvisquire:529,audino:528,wailmer:528,
  tangela:528,braviary:527,manaphy:527,vespiquen:527,nidoranm:527,
  stufful:526,applin:526,mamoswine:525,toxicroak:525,dipplin:525,
  seviper:524,chiyu:524,archen:524,metang:524,corsola:523,frosmoth:523,
  pheromosa:523,magnemite:523,salandit:522,drampa:522,tapulele:522,
  cursola:522,ursaluna:522,hoppip:521,croagunk:521,poochyena:521,
  malamar:520,magcargo:520,gastrodon:520,teddiursa:520,fletchling:520,
  doublade:519,seadra:517,hattrem:517,floette:516,tyrunt:516,girafarig:516,
  regirock:515,cobalion:515,shroomish:515,maractus:515,golett:514,
  skiddo:514,uxie:514,snorunt:513,onix:513,mantine:513,tatsugiri:513,
  lairon:512,sentret:512,inkay:511,chansey:511,whiscash:511,steenee:511,
  pelipper:510,combusken:510,horsea:510,tentacruel:509,spinda:509,
  polteageist:509,stoutland:508,chimchar:508,nidorino:507,ninjask:507,
  torkoal:507,jumpluff:507,cutiefly:506,swellow:506,shuppet:506,
  eternatus:506,pidgeotto:506,fletchinder:506,screamtail:505,tandemaus:505,
  starly:505,vivillon:505,eelektross:505,fraxure:505,guzzlord:505,
  dachsbun:505,crustle:505,yanmega:504,electabuzz:504,scraggy:504,
  emboar:504,unown:502,sneasler:502,kingambit:502,basculegion:501,
  corphish:501,vibrava:501,kleavor:500,persian:500,regieleki:500,plusle:499,
  rillaboom:499,minun:498,staryu:498,diglett:498,greavard:498,farigiraf:497,
  oricorio:497,meltan:497,melmetal:496,dugtrio:495,armaldo:494,
  charcadet:494,ragingbolt:493,omastar:493,sawsbuck:493,morpeko:492,
  duosion:492,xurkitree:492,manectric:492,swadloon:491,combee:491,
  sinistea:490,exeggutor:490,mudsdale:490,pyukumuku:490,hoopa:490,
  bounsweet:490,cloyster:490,deerling:489,delibird:489,lanturn:488,
  hitmonchan:488,helioptile:488,regidrago:488,wyrdeer:488,nidorina:488,
  slugma:488,spoink:487,poipole:487,ursaring:487,dunsparce:487,buzzwole:487,
  heliolisk:486,pawniard:486,dudunsparce:485,druddigon:485,amoonguss:485,
  gougingfire:485,palafin:485,chinchou:485,rhyhorn:485,jangmoo:485,
  donphan:485,walrein:485,tinkatuff:484,florges:484,natu:484,smoliv:483,
  prinplup:483,dragalge:483,klefki:483,scrafty:482,hitmontop:482,
  vanillite:482,mesprit:482,petilil:481,dusclops:481,primeape:481,
  drilbur:481,fidough:480,garganacl:480,glalie:480,crawdaunt:480,foongus:480,
  noctowl:479,cleffa:479,swinub:478,sealeo:478,chesnaught:478,sewaddle:477,
  sigilyph:477,dewgong:477,blitzle:477,mantyke:476,kecleon:475,shellder:475,
  komala:475,liepard:475,caterpie:474,darmanitan:473,delcatty:473,
  araquanid:473,grotle:472,shiftry:472,chatot:472,bellsprout:471,
  beautifly:471,chimecho:471,cottonee:470,cranidos:470,glastrier:469,
  kabuto:469,boltund:468,eiscue:468,stakataka:468,golduck:468,pawmi:467,
  mienfoo:467,wingull:467,nickit:467,dodrio:467,hatenna:464,monferno:464,
  whirlipede:464,carbink:463,clawitzer:463,brionne:463,lillipup:463,
  ironbundle:463,solosis:462,lunatone:462,rookidee:462,elekid:462,yanma:462,
  finizen:461,herdier:461,mareanie:461,ironleaves:461,wishiwashi:461,
  dondozo:460,beldum:460,tauros:460,naganadel:459,sandygast:459,
  octillery:459,taillow:459,bagon:459,ironjugulis:458,cacturne:458,
  cacnea:458,blacephalon:457,carnivine:457,pikipek:457,thievul:456,
  carracosta:456,flabebe:456,hariyama:456,quaquaval:456,charjabug:456,
  hakamoo:455,rampardos:455,camerupt:455,toxapex:455,cyclizar:455,
  lickitung:455,terapagos:454,purrloin:454,victreebel:454,machoke:454,
  comfey:453,doduo:453,kingler:451,venonat:451,ducklett:450,pawmot:450,
  mankey:450,eldegoss:449,escavalier:449,archaludon:448,dhelmise:448,
  dubwool:448,nidoranf:448,krabby:447,cubchoo:447,cherubi:447,wochien:446,
  aipom:446,celesteela:446,vanilluxe:446,hoothoot:445,perrserker:445,
  furfrou:445,miltank:445,venipede:444,electrike:444,golem:444,tangrowth:443,
  ironthorns:443,cramorant:443,drednaw:443,urshifu:442,pawmo:441,drapion:440,
  frillish:440,zubat:440,golbat:439,budew:439,linoone:438,ferrothorn:438,
  wurmple:438,fomantis:438,glameow:437,kricketune:437,phione:437,koffing:437,
  sandyshocks:436,milcery:435,rhyperior:435,hippowdon:434,tirtouga:434,
  clauncher:434,lechonk:433,litleo:433,thundurus:433,boldore:433,minior:433,
  parasect:432,rufflet:432,houndstone:432,ariados:432,gothitelle:432,
  voltorb:431,seel:431,ironcrown:430,shellos:430,darumaka:430,piloswine:430,
  cetitan:429,pinsir:429,kubfu:429,lombre:428,bronzong:428,gimmighoul:428,
  swanna:428,claydol:428,hitmonlee:427,klinklang:427,anorith:426,
  makuhita:426,magmar:426,clobbopus:426,pidove:425,ekans:425,electrode:425,
  numel:425,heatran:425,beartic:424,roggenrola:424,grimmsnarl:423,
  duraludon:423,surskit:423,morelull:423,spinarak:422,pidgey:422,
  turtonator:422,volcanion:422,toedscruel:420,staravia:420,overqwil:420,
  skorupi:419,musharna:418,coalossal:418,dracozolt:418,tynamo:418,
  vanillish:417,tentacool:417,nacli:416,masquerain:416,mabosstiff:416,
  bibarel:415,pyroar:415,dracovish:415,bonsly:415,wimpod:415,shieldon:414,
  gulpin:414,solrock:414,nuzleaf:414,carvanha:414,brutebonnet:413,ledian:413,
  paras:412,arboliva:412,seedot:411,shelgon:411,trubbish:411,indeedee:411,
  snover:411,sunflora:411,jellicent:410,rattata:410,grapploct:410,
  skiploom:410,slaking:409,whismur:409,relicanth:409,crocalor:409,
  avalugg:409,grimer:409,magmortar:409,landorus:408,gossifleur:408,
  trumbeak:408,pignite:407,bellibolt:407,machop:407,muk:406,lumineon:406,
  cryogonal:406,sinistcha:405,bastiodon:405,forretress:405,cradily:405,
  swoobat:405,tornadus:404,gloom:403,wugtrio:403,pupitar:402,chingling:401,
  poltchageist:400,seismitoad:399,gholdengo:399,munna:399,orbeetle:399,
  weepinbell:398,swirlix:398,ironhands:398,fezandipiti:397,woobat:397,
  zarude:397,grafaiai:396,slurpuff:396,nincada:395,baxcalibur:395,
  beheeyem:393,clamperl:393,tapubulu:393,klink:392,copperajah:392,
  kilowattrel:391,unfezant:391,stonjourner:391,mrrime:390,sizzlipede:389,
  weezing:389,dewpider:389,garbodor:389,durant:389,elgyem:388,grubbin:388,
  wiglett:388,passimian:387,ambipom:387,bunnelby:387,drizzile:387,
  accelgor:387,bergmite:386,hypno:386,spewpa:385,terrakion:385,
  mandibuzz:384,slakoth:384,shiinotic:384,mudbray:384,cetoddle:384,
  dustox:383,panpour:383,dolliv:382,venomoth:381,klang:381,finneon:380,
  exeggcute:380,lokix:379,mrmime:378,gothorita:378,exploud:378,weedle:378,
  irontreads:378,arctozolt:376,pansage:375,pincurchin:375,swalot:375,
  glimmora:375,seaking:375,fearow:373,brambleghast:372,lileep:372,
  geodude:372,qwilfish:372,oranguru:371,spearow:370,mothim:370,eelektrik:369,
  igglybuff:369,happiny:369,ledyba:369,naclstack:368,toxel:368,flamigo:367,
  orthworm:367,wattrel:367,medicham:366,nosepass:366,quaxwell:366,baltoy:365,
  heatmor:364,loudred:363,goldeen:362,feebas:362,tinglu:362,castform:362,
  mimejr:361,scovillain:361,cufant:361,pansear:361,metapod:360,
  toedscool:360,meditite:360,bronzor:359,skwovet:359,bouffalant:359,
  espathra:357,revavroom:357,klawf:355,pecharunt:355,pecharun:355,sawk:355,
  kricketot:354,vigoroth:354,shelmet:354,conkeldurr:353,cherrim:353,
  sunkern:352,tranquill:352,thwackey:352,magby:352,bombirdier:351,
  lickilicky:351,skrelp:350,drowzee:349,spritzee:347,veluza:347,
  arctibax:347,sandaconda:347,carkol:346,ferroseed:346,ironboulder:346,
  calyrex:346,crabrawler:345,tinkatink:343,graveler:343,simisage:342,
  pineco:341,hippopotas:340,raticate:337,bramblin:337,remoraid:337,
  morgrem:335,quilladin:335,snubbull:333,kakuna:332,purugly:330,stunfisk:330,
  timburr:330,barraskewda:327,barboach:325,okidogi:324,tympole:324,
  probopass:323,greedent:320,granbull:319,grumpig:319,chewtle:319,
  karrablast:318,nymble:318,luvdisc:317,tadbulb:317,barbaracle:317,
  stantler:317,impidimp:317,throh:316,scatterbug:316,palpitoad:315,
  skuntank:315,tarountula:315,simipour:312,burmy:311,arctovish:311,
  rolycoly:310,spidops:308,glimmet:305,silicobra:304,stunky:304,
  aromatisse:303,dottler:302,alomomola:302,huntail:302,simisear:299,
  gothita:294,varoom:292,wormadam:292,arrokuda:290,rabsca:287,jynx:286,
  shroodle:284,tyrogue:283,oinkologne:282,gorebyss:280,silcoon:279,
  gumshoos:278,patrat:277,yungoos:277,diggersby:275,gurdurr:273,vullaby:272,
  squawkabilly:271,cascoon:270,crabominable:269,basculin:268,illumise:265,
  enamorus:263,maschiff:261,volbeat:255,frigibax:255,flittle:236,watchog:229,
  blipbug:223,capsakid:221,smoochum:220,munkidori:208,binacle:207,
  bruxish:197,rellor:181,
};

function getPopularityScore(rawApiName: string): number {
  const key = normalizePokemonName(rawApiName);
  return POPULARITY_SCORES[key] ?? 0;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatPokemonName(apiName: string): string {
  const parts = apiName.split("-");
  const base = capitalize(parts[0]);

  if (parts.length === 1) return base;

  const rest = parts.slice(1);

  // Mega evolutions: "venusaur-mega", "charizard-mega-x", "charizard-mega-y"
  if (rest.includes("mega")) {
    const suffix = rest.filter((p) => p !== "mega").map((p) => p.toUpperCase());
    return suffix.length ? `Mega ${base} ${suffix.join(" ")}` : `Mega ${base}`;
  }

  // Gigantamax: "charizard-gmax", "urshifu-rapid-strike-gmax"
  if (rest[rest.length - 1] === "gmax") {
    const formParts = rest.slice(0, -1);
    return formParts.length
      ? `${base} (${formParts.map(capitalize).join(" ")} Gigantamax)`
      : `${base} (Gigantamax)`;
  }

  // Regional forms: "raichu-alola", "meowth-galar", "darmanitan-galar-zen"
  const regionMap: Record<string, string> = {
    alola: "Alolan",
    galar: "Galarian",
    hisui: "Hisuian",
    paldea: "Paldean",
  };
  for (const [key, label] of Object.entries(regionMap)) {
    const idx = rest.indexOf(key);
    if (idx >= 0) {
      const extra = rest.filter((_, i) => i !== idx);
      return extra.length
        ? `${label} ${base} (${extra.map(capitalize).join(" ")})`
        : `${label} ${base}`;
    }
  }

  // Generic alternate form: "rotom-heat" → "Rotom (Heat)", "giratina-origin" → "Giratina (Origin)"
  return `${base} (${rest.map(capitalize).join(" ")})`;
}

async function buildCache(): Promise<NormalizedPokemon[]> {
  // 1. Fetch full Pokemon list
  const listRes = await fetch(`${POKEAPI_BASE}/pokemon?limit=${POKEMON_LIMIT}`, {
    next: { revalidate: 86400 }, // 24h cache hint for edge/Next cache
  });
  if (!listRes.ok) throw new Error(`PokeAPI list failed: ${listRes.status}`);
  const listData = await listRes.json();

  const rawList: Array<{ name: string; url: string }> = listData.results ?? [];

  // 2. Build ID → types map using type list endpoints (18 parallel calls)
  const typeIndex = new Map<number, string[]>();

  const typeResults = await Promise.allSettled(
    TYPE_NAMES.map((t) =>
      fetch(`${POKEAPI_BASE}/type/${t}`, { next: { revalidate: 86400 } }).then((r) => r.json())
    )
  );

  for (let i = 0; i < TYPE_NAMES.length; i++) {
    const result = typeResults[i];
    if (result.status !== "fulfilled") continue;
    const typeName = TYPE_NAMES[i];
    const pokemonEntries: Array<{ pokemon: { name: string; url: string } }> =
      result.value?.pokemon ?? [];
    for (const entry of pokemonEntries) {
      const urlParts = entry.pokemon.url.replace(/\/$/, "").split("/");
      const pokemonId = parseInt(urlParts[urlParts.length - 1], 10);
      if (!Number.isFinite(pokemonId)) continue;
      if (!typeIndex.has(pokemonId)) typeIndex.set(pokemonId, []);
      typeIndex.get(pokemonId)!.push(typeName);
    }
  }

  // 3. Build normalized list
  const pokemon: NormalizedPokemon[] = rawList.map((entry) => {
    const urlParts = entry.url.replace(/\/$/, "").split("/");
    const id = parseInt(urlParts[urlParts.length - 1], 10);
    const types = typeIndex.get(id) ?? [];
    const typesStr = types.map(capitalize).join(" / ");

    return {
      id,
      name: {
        full: formatPokemonName(entry.name),
        native: typesStr || "Unknown",
      },
      gender: getGeneration(id),
      image: { large: getImageUrl(id) },
      favourites: getPopularityScore(entry.name),
    };
  });

  // Sort: base Pokemon by ID first, then forms
  pokemon.sort((a, b) => {
    const aIsBase = a.id <= 1025;
    const bIsBase = b.id <= 1025;
    if (aIsBase && !bIsBase) return -1;
    if (!aIsBase && bIsBase) return 1;
    return a.id - b.id;
  });

  return pokemon;
}

export async function GET() {
  try {
    if (pokemonCache) {
      return Response.json({ pokemon: pokemonCache, total: pokemonCache.length });
    }

    if (!cacheBuilding) {
      cacheBuilding = buildCache().then((result) => {
        pokemonCache = result;
        return result;
      }).catch((err) => {
        cacheBuilding = null; // allow retry on failure
        throw err;
      });
    }

    const pokemon = await cacheBuilding;
    return Response.json({ pokemon, total: pokemon.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PokeAPI fetch failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
