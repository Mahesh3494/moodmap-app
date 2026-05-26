import { Hono } from 'hono';
import { context, redis } from '@devvit/web/server';
import type { InitResponse, DashboardResponse } from '../../shared/api';

type ErrorResponse = { status: 'error'; message: string };

export const api = new Hono();

// ── Keyword Scorer ────────────────────────────────────────────────
function scoreComment(text: string): number {
  const t = text.toLowerCase();

  const severe = [
    'kys', 'kill yourself', 'go die', 'i hope you die', 'end yourself',
    'you should die', 'hang yourself', 'shoot yourself',
    'nobody wants you', 'the world is better without you',
    'failed abortion', 'hope you die',
  ];
  const high = [
    'hate you', 'hate this', 'hate everyone', 'worst community',
    'worst person', 'absolute trash', 'complete idiot', 'you people are',
    'you are all', 'this place sucks', 'everyone here is', 'full of idiots',
    'bunch of idiots', 'pathetic losers', 'get out of here',
    'you don\'t belong', 'hope you get banned', 'son of a bitch',
    'thundercunt', 'cock-juggling', 'gobshite', 'fuckwit', 'fucktard',
    'dickhead', 'asshole', 'dumbass', 'fuckface', 'shithouse',
    'bastard', 'wanker', 'twat', 'bellend', 'cockwomble',
    'knobhead', 'tosspot', 'fuckhead', 'shitbag', 'dickweed',
    'fuckstain', 'cumwipe', 'scumbag', 'cocksucker', 'motherfucker',
  ];
  const medium = [
    'idiot', 'stupid', 'dumb', 'moron', 'loser', 'pathetic',
    'worthless', 'useless', 'awful', 'terrible', 'horrible', 'disgusting',
    'hate', 'shut up', 'go away', 'nobody cares', 'trash', 'garbage', 'worst',
    'cringe', 'toxic', 'cancer', 'braindead', 'brainless', 'clown',
    'cope', 'ratio', 'skill issue', 'get rekt', 'owned', 'destroyed',
    'embarrassing', 'shameful', 'disgrace', 'delusional', 'bot', 'troll',
    'bitch', 'crap', 'damn', 'hell', 'piss off', 'bollocks', 'bugger',
    'dickweasel', 'pisswizard', 'wazzock', 'numpty', 'muppet',
    'nonce', 'creep', 'freak', 'weirdo', 'crackhead', 'backstabber',
    'coward', 'fraud', 'liar', 'faker', 'freeloader', 'crybaby',
    'dweeb', 'dunce', 'dunderhead', 'imbecile', 'halfwit',
    'fuckboy', 'asshat', 'asswipe', 'dumbfuck', 'shithead',
    'dipshit', 'nitwit', 'meathead', 'knucklehead', 'lamebrain',
    'screw you', 'get lost', 'drop dead', 'you suck', 'you stink',
  ];
  const mild = [
    'wrong', 'bad take', 'disagree', 'misinformation', 'lying',
    'false', 'fake', 'spam', 'reported', 'downvoted', 'rubbish',
    'nonsense', 'ridiculous', 'pathetic', 'joke', 'clown',
  ];

  // Spam/self-promo signals
  const spam = [
    'follow me', 'check out my', 'dm me', 'buy now', 'click here',
    'free money', 'make money', 'work from home', 'subscribe to',
    'only fans', 'onlyfans', 'link in bio', 'use my code',
  ];


  let score = 0;
  for (const w of severe) if (t.includes(w)) score += 0.6;
  for (const w of high)   if (t.includes(w)) score += 0.35;
  for (const w of medium) if (t.includes(w)) score += 0.18;
  for (const w of mild)   if (t.includes(w)) score += 0.08;
  for (const w of spam)   if (t.includes(w)) score += 0.12;

  // ALL CAPS bonus (shouting)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / Math.max(text.length, 1);
  if (capsRatio > 0.6 && text.length > 10) score += 0.15;

  // Excessive punctuation (!!!!! or ?????)
  if (/[!?]{3,}/.test(text)) score += 0.08;

  return Math.min(score, 1.0);
}

// ── Process raw comments for an hour ─────────────────────────────
async function processHour(hourStr: string): Promise<void> {
  const rawKey    = `moodmap:raw:${hourStr}`;
  const scoredKey = `moodmap:hour:${hourStr}`;

  const raw = await redis.hGetAll(rawKey);
  if (!raw) return;

  for (const [commentId, val] of Object.entries(raw)) {
    const existing = await redis.hGet(scoredKey, commentId);
    if (existing) continue;

    try {
      const parsed = JSON.parse(val as string);
      const score  = scoreComment(parsed.text);

      await redis.hSet(scoredKey, {
        [commentId]: JSON.stringify({
          score,
          author:    parsed.author,
          excerpt:   parsed.text.slice(0, 120),
          timestamp: parsed.timestamp,
          commentId,
          postId:    parsed.postId ?? '',
          subreddit: parsed.subreddit ?? '',
        }),
      });

      await redis.expire(scoredKey, 60 * 60 * 24 * 7);

      // Store alert if toxic
      if (score >= 0.25) {
        const alertMember: { score: number; member: string } = {
          score: parsed.timestamp,
          member: JSON.stringify({
            commentId,
            author:        parsed.author,
            toxicityScore: score,
            excerpt:       parsed.text.slice(0, 120),
            timestamp:     parsed.timestamp,
            postId:        parsed.postId   ?? '',
            subreddit:     parsed.subreddit ?? '',
          }),
        };
        await redis.zAdd('moodmap:alerts', alertMember);

        // Per-user toxicity tracking (bonus feature)
        const userKey = `moodmap:user:${parsed.author}`;
        const userRaw = await redis.get(userKey);
        const userData = userRaw ? JSON.parse(userRaw) : { totalScore: 0, count: 0 };
        userData.totalScore += score;
        userData.count      += 1;
        await redis.set(userKey, JSON.stringify(userData));
        await redis.expire(userKey, 60 * 60 * 24 * 30);

        const count = await redis.zCard('moodmap:alerts');
        if (count > 50) {
          await redis.zRemRangeByRank('moodmap:alerts', 0, count - 51);
        }
      }
    } catch (e) {
      console.error('Error scoring comment:', e);
    }
  }
}

// ── Health score ──────────────────────────────────────────────────
async function getHealthScore(): Promise<number> {
  try {
    let total = 0, count = 0;
    for (let i = 0; i < 24; i++) {
      const d       = new Date(Date.now() - i * 60 * 60 * 1000);
      const key     = `moodmap:hour:${d.toISOString().slice(0, 13)}`;
      const entries = await redis.hGetAll(key);
      if (!entries) continue;
      for (const val of Object.values(entries)) {
        try { const p = JSON.parse(val as string); total += p.score ?? 0; count++; }
        catch {}
      }
    }
    if (count === 0) return 100;
    return Math.round((1 - total / count) * 100);
  } catch { return 100; }
}

// ── Trend ─────────────────────────────────────────────────────────
async function getTrend() {
  const trend = [];
  for (let i = 23; i >= 0; i--) {
    const d       = new Date(Date.now() - i * 60 * 60 * 1000);
    const key     = `moodmap:hour:${d.toISOString().slice(0, 13)}`;
    const entries = await redis.hGetAll(key);
    let total = 0, count = 0;
    if (entries) {
      for (const val of Object.values(entries)) {
        try { const p = JSON.parse(val as string); total += p.score ?? 0; count++; }
        catch {}
      }
    }
    trend.push({
      hour:         d.toISOString().slice(11, 13) + ':00',
      avgToxicity:  count > 0 ? total / count : 0,
      avgSeverity:  0,
      commentCount: count,
    });
  }
  return trend;
}

// ── Alerts ────────────────────────────────────────────────────────
async function getAlerts() {
  try {
    const raw = await redis.zRange('moodmap:alerts', 0, 9);
    return raw.map((r: any) =>
      typeof r === 'string' ? JSON.parse(r) : JSON.parse(r.member)
    ).reverse();
  } catch { return []; }
}

// ── Process all 24h ──────────────────────────────────────────────
async function processAllHours(): Promise<void> {
  for (let i = 0; i < 24; i++) {
    const d       = new Date(Date.now() - i * 60 * 60 * 1000);
    const hourStr = d.toISOString().slice(0, 13);
    const rawKey  = `moodmap:raw:${hourStr}`;
    const raw     = await redis.hGetAll(rawKey);
    if (raw) await processHour(hourStr);
  }
}

// ── Routes ────────────────────────────────────────────────────────
api.get('/init', async (c) => {
  try {
    const { postId }  = context;
    const username    = context.userId      ?? 'mod';
    const subreddit   = context.subredditName ?? '';
    await processAllHours();
    const [health, trend, alerts] = await Promise.all([
      getHealthScore(), getTrend(), getAlerts(),
    ]);
    return c.json<InitResponse>({
      type: 'init', postId: postId ?? '', username, subreddit,
      currentHealth: health, trend, recentAlerts: alerts,
    });
  } catch (error) {
    return c.json<ErrorResponse>({ status: 'error', message: String(error) }, 400);
  }
});

api.get('/dashboard', async (c) => {
  try {
    await processAllHours();
    const [health, trend, alerts] = await Promise.all([
      getHealthScore(), getTrend(), getAlerts(),
    ]);
    return c.json<DashboardResponse>({
      type: 'dashboard', currentHealth: health, trend, recentAlerts: alerts,
    });
  } catch (error) {
    return c.json<ErrorResponse>({ status: 'error', message: String(error) }, 400);
  }
});