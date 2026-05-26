import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { createPost } from '../core/post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  try {
    const post = await createPost();
    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});

menu.post('/open-dashboard', async (c) => {
  try {
    const { subredditName } = context;
    const postId = await redis.get('moodmap:dashboard:postId');

    if (postId) {
      return c.json<UiResponse>(
        {
          navigateTo: `https://www.reddit.com/r/${subredditName}/comments/${postId}/?playtest=moodmap-app`,
        },
        200
      );
    } else {
      const post = await createPost();
      await redis.set('moodmap:dashboard:postId', post.id);
      return c.json<UiResponse>(
        {
          navigateTo: `https://www.reddit.com/r/${subredditName}/comments/${post.id}/?playtest=moodmap-app`,
        },
        200
      );
    }
  } catch (error) {
    return c.json<UiResponse>(
      { showToast: '❌ Could not open MoodMap dashboard' },
      400
    );
  }
});