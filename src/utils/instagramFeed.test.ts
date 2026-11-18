import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WILLOW_INSTAGRAM_HANDLE,
  WILLOW_INSTAGRAM_URL,
  formatCaptionExcerpt,
  normalizeInstagramGraphResponse,
} from './instagramFeed.ts';

describe('instagramFeed helpers', () => {
  it('points to the official @willow.mun Instagram profile', () => {
    assert.equal(WILLOW_INSTAGRAM_HANDLE, '@willow.mun');
    assert.equal(WILLOW_INSTAGRAM_URL, 'https://www.instagram.com/willow.mun/');
  });

  it('normalizes valid IMAGE, CAROUSEL_ALBUM, and VIDEO nodes with thumbnails', () => {
    const result = normalizeInstagramGraphResponse([
      {
        id: '101',
        media_type: 'IMAGE',
        media_url: 'https://scontent.cdninstagram.com/v/photo1.jpg',
        permalink: 'https://www.instagram.com/p/C123/',
        caption: 'Committee allocations and inaugural Secretariat announcement.',
        timestamp: '2027-11-10T14:30:00+0000',
      },
      {
        id: '102',
        media_type: 'VIDEO',
        media_url: 'https://scontent.cdninstagram.com/v/reel.mp4',
        thumbnail_url: 'https://scontent.cdninstagram.com/v/reel-thumb.jpg',
        permalink: 'https://www.instagram.com/reel/R456/',
        caption: 'Behind the scenes with Willow MUN Organizing Teams.',
        timestamp: '2027-11-12T10:00:00+0000',
      },
      {
        id: '103',
        media_type: 'CAROUSEL_ALBUM',
        media_url: 'https://scontent.cdninstagram.com/v/carousel.jpg',
        permalink: 'https://www.instagram.com/p/C789/',
        caption: '',
        timestamp: '2027-11-14T08:00:00+0000',
      },
    ]);

    assert.equal(result.length, 3);
    assert.equal(result[0].imageUrl, 'https://scontent.cdninstagram.com/v/photo1.jpg');
    assert.equal(result[1].imageUrl, 'https://scontent.cdninstagram.com/v/reel-thumb.jpg');
    assert.equal(result[1].mediaType, 'VIDEO');
    assert.equal(result[2].mediaType, 'CAROUSEL_ALBUM');
    assert.ok(result[0].formattedDate.includes('2027'));
  });

  it('drops VIDEO nodes missing a thumbnail or entries with unsafe URLs', () => {
    const result = normalizeInstagramGraphResponse([
      {
        id: 'bad-video',
        media_type: 'VIDEO',
        media_url: 'https://scontent.cdninstagram.com/v/reel-no-thumb.mp4',
        permalink: 'https://www.instagram.com/reel/NOPE/',
      },
      {
        id: 'unsafe-url',
        media_type: 'IMAGE',
        media_url: 'javascript:alert(1)',
        permalink: 'https://www.instagram.com/p/BAD/',
      },
      {
        id: 'valid',
        media_type: 'IMAGE',
        media_url: 'https://scontent.cdninstagram.com/v/good.jpg',
        permalink: 'https://www.instagram.com/p/GOOD/',
      },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'valid');
  });

  it('truncates long captions cleanly along word boundaries', () => {
    const longText =
      'Willow Model United Nations brings students together for principled diplomacy, committee rigor, and cross-border negotiation across six chambers.';
    const excerpt = formatCaptionExcerpt(longText, 72);
    assert.ok(excerpt.length <= 72);
    assert.ok(excerpt.endsWith('…'));
  });
});
