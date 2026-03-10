/**
 * gen-skill-icons.mjs -- v35 Skill Icon Generation
 *
 * 1. Gemini gemini-3.1-flash-image-preview 512x512 generation
 * 2. sharp BFS flood fill background removal
 * 3. sharp Lanczos3 downscale to 64x64 transparent PNG
 *
 * Usage:
 *   node scripts/gen-skill-icons.mjs              # Generate all 57 icons
 *   node scripts/gen-skill-icons.mjs steel         # STEEL category only
 *   node scripts/gen-skill-icons.mjs morale        # MORALE category only
 *   node scripts/gen-skill-icons.mjs --dry-run     # Print prompts only (no API calls)
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// ─── Config ───
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.1-flash-image-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const BASE = 'apps/web/public/assets/skills';
const TARGET_SIZE = 64;
const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 1;
const MIN_FILE_SIZE = 1024; // 1KB

// ─── Common Prompt DNA ───
const PROMPT_DNA = `Create a 512x512 game skill icon with a dark background.
Military war theme, detailed weapon/equipment illustration.
Clean centered composition, single object/concept, bold silhouette.
Slight metallic sheen, dramatic lighting, game UI quality.
NO text, NO letters, NO watermark, NO border.`;

// ─── Category color directives ───
const CATEGORY_COLORS = {
  steel:        'Red metallic glow (#EF4444), iron/steel textures, factory sparks.',
  territory:    'Blue energy (#3B82F6), terrain/earth tones, explosive blue effects.',
  alliance:     'Purple glow (#8B5CF6), diplomatic/chain motifs, violet energy.',
  sovereignty:  'Green glow (#22C55E), shield/fortress motifs, emerald energy.',
  intelligence: 'Golden/amber glow (#F59E0B), satellite/tech motifs, gold energy.',
  morale:       'Cyan glow (#06B6D4), human/spirit motifs, teal energy.',
};

// ─── Tier complexity directives ───
const TIER_COMPLEXITY = {
  basic:    'Simple icon, single object, clean silhouette, minimal details.',
  advanced: 'Moderate complexity, some particle effects, medium detail.',
  elite:    'Epic tier, intense glow effects, dramatic composition, legendary feel.',
};

// ─── 57 Skill Definitions ───
const SKILLS = [
  // ── STEEL (10) ──
  { id: 'knife',          category: 'steel', tier: 'basic',    prompt_desc: 'Glowing metal bullets being fired from factory smoke' },
  { id: 'whip',           category: 'steel', tier: 'basic',    prompt_desc: 'Red-hot steel chain whip with flying sparks' },
  { id: 'wand',           category: 'steel', tier: 'advanced', prompt_desc: 'Heat-seeking missile with red trail' },
  { id: 'axe',            category: 'steel', tier: 'advanced', prompt_desc: 'Heavy tank shell exploding on impact' },
  { id: 'bow',            category: 'steel', tier: 'advanced', prompt_desc: 'Sharp tungsten dart piercing through metal plate' },
  { id: 'syntax_error',   category: 'steel', tier: 'advanced', prompt_desc: 'EMP grenade emitting blue electric arcs' },
  { id: 'compiler',       category: 'steel', tier: 'elite',   prompt_desc: 'Red energy beam firing down from orbital satellite' },
  { id: 'debugger_skill', category: 'steel', tier: 'advanced', prompt_desc: 'Red laser sight crosshair marking a weak point' },
  { id: 'refactor',       category: 'steel', tier: 'advanced', prompt_desc: 'Red gears meshing together in a munitions factory' },
  { id: 'hotfix',         category: 'steel', tier: 'basic',    prompt_desc: 'Welding sparks repairing an armored vehicle in the field' },

  // ── TERRITORY (10) ──
  { id: 'bible',          category: 'territory', tier: 'basic',    prompt_desc: 'Blue laser fence glowing along a border perimeter' },
  { id: 'pool',           category: 'territory', tier: 'basic',    prompt_desc: 'Scorched earth with blue smoke rising from burning ground' },
  { id: 'json_bomb',      category: 'territory', tier: 'advanced', prompt_desc: 'Blue warhead splitting into dozens of sub-munitions' },
  { id: 'csv_spray',      category: 'territory', tier: 'basic',    prompt_desc: 'Machine gun nest with sandbags firing blue tracers' },
  { id: 'shard',          category: 'territory', tier: 'advanced', prompt_desc: 'Blue metal shrapnel fragments scattering from explosion' },
  { id: 'airdrop',        category: 'territory', tier: 'elite',   prompt_desc: 'Bomber squadron dropping blue bombs from the sky' },
  { id: 'sql_injection',  category: 'territory', tier: 'advanced', prompt_desc: 'Soldier silhouette infiltrating through underground tunnel' },
  { id: 'regex',          category: 'territory', tier: 'advanced', prompt_desc: 'Flag planted on mountain terrain high ground advantage' },
  { id: 'binary',         category: 'territory', tier: 'elite',   prompt_desc: 'Earth cracking with blue energy shockwave spreading' },
  { id: 'big_data',       category: 'territory', tier: 'elite',   prompt_desc: 'Resources (grain, iron, oil) converging to frontline with blue glow' },

  // ── ALLIANCE (10) ──
  { id: 'bridge',         category: 'alliance', tier: 'advanced', prompt_desc: 'Multiple flags connected by purple light chains targeting one enemy' },
  { id: 'ping',           category: 'alliance', tier: 'basic',    prompt_desc: 'Sealed purple diplomatic letter flying swiftly' },
  { id: 'websocket',      category: 'alliance', tier: 'advanced', prompt_desc: 'Unbreakable purple chain linking two handshaking hands' },
  { id: 'fork',           category: 'alliance', tier: 'advanced', prompt_desc: 'Single purple arrow splitting into three directions' },
  { id: 'tcp_flood',      category: 'alliance', tier: 'advanced', prompt_desc: 'Gold bars with red ban stamp, economic sanctions' },
  { id: 'dns_spoof',      category: 'alliance', tier: 'elite',   prompt_desc: 'Masked diplomat silhouette whispering between two enemies' },
  { id: 'packet_loss',    category: 'alliance', tier: 'advanced', prompt_desc: 'Purple shield deflecting attacks around diplomat silhouette' },
  { id: 'vpn_tunnel',     category: 'alliance', tier: 'elite',   prompt_desc: 'Purple portal wormhole for teleportation' },
  { id: 'ddos',           category: 'alliance', tier: 'elite',   prompt_desc: 'Many flags converging in concentric circles attacking one point' },
  { id: 'p2p',            category: 'alliance', tier: 'advanced', prompt_desc: 'Defector soldier receiving purple flag while crossing battle line' },

  // ── SOVEREIGNTY (9) ──
  { id: 'garlic',           category: 'sovereignty', tier: 'basic',    prompt_desc: 'Border guard sentinel with glowing green shield' },
  { id: 'antivirus',        category: 'sovereignty', tier: 'basic',    prompt_desc: 'Medical kit with glowing green cross, healing aura' },
  { id: 'sandbox',          category: 'sovereignty', tier: 'advanced', prompt_desc: 'Quarantine zone enclosed by green energy barrier' },
  { id: 'encryption',       category: 'sovereignty', tier: 'advanced', prompt_desc: 'Glowing green padlock on classified document with secret stamp' },
  { id: 'firewall_surge',   category: 'sovereignty', tier: 'elite',   prompt_desc: 'Green energy explosion wave repelling invaders outward' },
  { id: 'zero_trust',       category: 'sovereignty', tier: 'advanced', prompt_desc: 'Cracked parchment with green treaty seal' },
  { id: 'honeypot',         category: 'sovereignty', tier: 'elite',   prompt_desc: 'Fake town that looks beautiful from afar but ghostly green up close' },
  { id: 'incident_response',category: 'sovereignty', tier: 'advanced', prompt_desc: 'Green emergency siren flashing for martial law' },
  { id: 'backup',           category: 'sovereignty', tier: 'advanced', prompt_desc: 'Hand planting green flag rising from ruins, government in exile' },

  // ── INTELLIGENCE (9) ──
  { id: 'lightning',        category: 'intelligence', tier: 'advanced', prompt_desc: 'Golden lightning bolt striking down from satellite in space' },
  { id: 'neural_net',       category: 'intelligence', tier: 'elite',   prompt_desc: 'Golden spider web network spread across world map' },
  { id: 'autopilot',        category: 'intelligence', tier: 'advanced', prompt_desc: 'Golden glowing unmanned attack drone in flight' },
  { id: 'beam',             category: 'intelligence', tier: 'elite',   prompt_desc: 'Golden laser beam from satellite penetrating to ground' },
  { id: 'laser',            category: 'intelligence', tier: 'advanced', prompt_desc: 'Golden radar dish rotating with 360-degree scan waves' },
  { id: 'chatgpt',          category: 'intelligence', tier: 'advanced', prompt_desc: 'Propaganda tower with loudspeaker emitting golden sound waves' },
  { id: 'deepfake',         category: 'intelligence', tier: 'elite',   prompt_desc: 'Silhouette splitting into multiple golden doppelganger copies' },
  { id: 'singularity_core', category: 'intelligence', tier: 'elite',   prompt_desc: 'Golden vortex gravity well at a secret black site facility' },
  { id: 'agi',              category: 'intelligence', tier: 'elite',   prompt_desc: 'Golden all-seeing eye, omniscient and watching everything' },

  // ── MORALE (9) ──
  { id: 'punch',            category: 'morale', tier: 'basic',    prompt_desc: 'Cyan glowing fist charging forward with rage energy burst' },
  { id: 'sword',            category: 'morale', tier: 'advanced', prompt_desc: 'Legendary sword with cyan aura glow, heroic blade' },
  { id: 'focus',            category: 'morale', tier: 'advanced', prompt_desc: 'Cyan crosshair scope locked onto target, intense concentration' },
  { id: 'overclock',        category: 'morale', tier: 'advanced', prompt_desc: 'War horn emitting cyan energy wave blast, charge signal' },
  { id: 'ram_upgrade',      category: 'morale', tier: 'advanced', prompt_desc: 'Many cyan citizen silhouettes standing united in support' },
  { id: 'cpu_boost',        category: 'morale', tier: 'elite',   prompt_desc: 'Warrior with cyan glowing eyes from adrenaline war frenzy' },
  { id: 'cache',            category: 'morale', tier: 'basic',    prompt_desc: 'Supply crate descending on cyan glowing parachute' },
  { id: 'multithreading',   category: 'morale', tier: 'elite',   prompt_desc: 'Massive army silhouette formation under cyan banner flag' },
  { id: 'garbage_collection', category: 'morale', tier: 'advanced', prompt_desc: 'Gold coins falling from defeated enemy silhouette, war reparations' },
];

// ─── Build full prompt ───
function buildPrompt(skill) {
  const colorDirective = CATEGORY_COLORS[skill.category];
  const tierDirective = TIER_COMPLEXITY[skill.tier];
  return [
    PROMPT_DNA,
    colorDirective,
    tierDirective,
    `Depict: ${skill.prompt_desc}.`,
  ].join('\n');
}

// ─── Gemini API call ───
async function generateImage(prompt) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY environment variable not set');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const parts = json.candidates?.[0]?.content?.parts;
  if (!parts) throw new Error('No candidates in response');

  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  throw new Error('No image data in response');
}

// ─── Background removal (BFS flood fill) ───
async function removeBackground(buf, tolerance = 50) {
  const img = sharp(buf);
  const meta = await img.metadata();
  const { width, height } = meta;
  const raw = await img.ensureAlpha().raw().toBuffer();
  const ch = 4;

  // Corner sampling for background color estimation
  const getP = (x, y) => {
    const i = (y * width + x) * ch;
    return [raw[i], raw[i + 1], raw[i + 2]];
  };
  const samples = [
    getP(0, 0), getP(width - 1, 0),
    getP(0, height - 1), getP(width - 1, height - 1),
    getP(Math.floor(width / 2), 0), getP(Math.floor(width / 2), height - 1),
  ];
  const bgR = Math.round(samples.reduce((s, p) => s + p[0], 0) / samples.length);
  const bgG = Math.round(samples.reduce((s, p) => s + p[1], 0) / samples.length);
  const bgB = Math.round(samples.reduce((s, p) => s + p[2], 0) / samples.length);

  const result = Buffer.from(raw);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isBg = (idx) => {
    const r = raw[idx * ch], g = raw[idx * ch + 1], b = raw[idx * ch + 2];
    return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2) < tolerance;
  };

  // Seed edge pixels
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const pos = y * width + x;
      if (isBg(pos)) { visited[pos] = 1; queue.push(pos); }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      const pos = y * width + x;
      if (isBg(pos)) { visited[pos] = 1; queue.push(pos); }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    result[pos * ch + 3] = 0; // Set alpha to 0
    const x = pos % width, y = Math.floor(pos / width);
    for (const n of [pos - 1, pos + 1, pos - width, pos + width]) {
      if (n >= 0 && n < width * height && !visited[n]) {
        const nx = n % width;
        if (Math.abs(nx - x) <= 1 && isBg(n)) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  return sharp(result, { raw: { width, height, channels: ch } }).png().toBuffer();
}

// ─── Asset processing pipeline ───
async function processSkill(skill, idx, total, dryRun) {
  const outDir = path.join(BASE, skill.category);
  const outPath = path.join(outDir, `${skill.id}.png`);
  const label = `[${idx + 1}/${total}] ${skill.category}/${skill.id}`;
  const prompt = buildPrompt(skill);

  if (dryRun) {
    console.log(`\n--- ${label} (${skill.tier}) ---`);
    console.log(prompt);
    console.log(`-> ${outPath}`);
    return 'dry';
  }

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const attemptLabel = attempt > 0 ? ` (retry ${attempt})` : '';
      console.log(`  [gen] ${label}${attemptLabel} -- generating...`);

      // 1. Generate via Gemini
      const rawBuf = await generateImage(prompt);
      const rawMeta = await sharp(rawBuf).metadata();
      console.log(`        raw: ${rawMeta.width}x${rawMeta.height}, ${(rawBuf.length / 1024).toFixed(1)}KB`);

      // 2. Remove background
      const noBg = await removeBackground(rawBuf);

      // 3. Resize to 64x64
      const processed = await sharp(noBg)
        .resize(TARGET_SIZE, TARGET_SIZE, {
          fit: 'contain',
          kernel: 'lanczos3',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer();

      // 4. Validate file size
      if (processed.length < MIN_FILE_SIZE && attempt < MAX_RETRIES) {
        console.log(`  [!]  ${label} -- ${processed.length}B < 1KB, retrying...`);
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
        continue;
      }

      // 5. Save
      fs.writeFileSync(outPath, processed);
      const finalSize = (processed.length / 1024).toFixed(1);
      console.log(`  [ok] ${label} -- ${TARGET_SIZE}x${TARGET_SIZE}, ${finalSize}KB`);
      return 'success';

    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.log(`  [!]  ${label} -- ${err.message}, retrying...`);
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
        continue;
      }
      console.error(`  [FAIL] ${label} -- ${err.message}`);
      return 'fail';
    }
  }

  return 'fail';
}

// ─── Main ───
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filterArg = args.find(a => !a.startsWith('--'));

  // Validate API key (unless dry run)
  if (!dryRun && !API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required.');
    console.error('Set it via: export GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }

  // Filter skills by category
  let targets = SKILLS;
  if (filterArg) {
    const validCategories = Object.keys(CATEGORY_COLORS);
    if (!validCategories.includes(filterArg)) {
      console.error(`Error: Unknown category "${filterArg}".`);
      console.error(`Valid categories: ${validCategories.join(', ')}`);
      process.exit(1);
    }
    targets = SKILLS.filter(s => s.category === filterArg);
  }

  const mode = dryRun ? 'DRY RUN' : 'GENERATE';
  console.log(`\n=== v35 Skill Icon Generation (${mode}) ===`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Target: ${TARGET_SIZE}x${TARGET_SIZE}px PNG`);
  console.log(`  Skills: ${targets.length}/${SKILLS.length}`);
  if (filterArg) console.log(`  Filter: ${filterArg}`);
  console.log('');

  let success = 0, fail = 0, dry = 0;

  for (let i = 0; i < targets.length; i++) {
    const result = await processSkill(targets[i], i, targets.length, dryRun);
    if (result === 'success') success++;
    else if (result === 'fail') fail++;
    else if (result === 'dry') dry++;

    // Rate limit between API calls (skip for dry run and last item)
    if (!dryRun && i < targets.length - 1) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  console.log('\n=== Results ===');
  if (dryRun) {
    console.log(`  Dry run: ${dry} prompts printed`);
  } else {
    console.log(`  Success: ${success}`);
    console.log(`  Failed:  ${fail}`);
    console.log(`  Total:   ${targets.length}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
