import { Hono } from 'hono';
import { context, redis } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  return c.json<TriggerResponse>({
    status: 'success',
    message: `MoodMap installed on r/${context.subredditName}!`,
  }, 200);
});

triggers.post('/on-comment-submit', async (c) => {
  try {
    const body = await c.req.json();
    const commentText: string = body?.comment?.body ?? '';
    const commentId: string  = body?.comment?.id   ?? '';
    const author: string     = body?.comment?.author ?? 'unknown';
    const postId: string     = body?.comment?.postId ?? body?.post?.id ?? '';
    const subreddit: string  = context.subredditName ?? '';

    if (!commentText || commentText.length < 3) {
      return c.json<TriggerResponse>({ status: 'success', message: 'Too short' }, 200);
    }

    const now    = Date.now();
    const rawKey = `moodmap:raw:${new Date().toISOString().slice(0, 13)}`;

    await redis.hSet(rawKey, {
      [commentId]: JSON.stringify({
        text: commentText,
        author,
        timestamp: now,
        postId,
        subreddit,
      })
    });

    await redis.expire(rawKey, 60 * 60 * 24 * 7);

    console.log(`MoodMap stored comment by ${author} on post ${postId}`);
    return c.json<TriggerResponse>({ status: 'success', message: 'Stored' }, 200);
  } catch (err) {
    console.error('MoodMap trigger error:', err);
    return c.json<TriggerResponse>({ status: 'error', message: String(err) }, 500);
  }
});