exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url || !url.includes('posterdrops.com/art/')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    const html = await res.text();

    const titleMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
    const fullTitle = titleMatch ? titleMatch[1] : '';

    const imageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const image = imageMatch ? imageMatch[1].replace('/original/', '/').replace(/\.jpg$/, '.webp') : '';

    const name = fullTitle.replace(/ \| PosterDrops\.com$/, '').replace(/\s*\([^)]+\)\s*$/, '').trim();

    const yearMatch = name.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;

    const titleLower = fullTitle.toLowerCase();
    let edition = 'Regular';
    if (titleLower.includes('foil')) edition = 'Foil';
    else if (titleLower.includes('variant') || titleLower.includes('artist edition') || titleLower.includes('artist proof') || titleLower.includes('uncut')) edition = 'Artist Proof';

    const artistMatch = name.match(/Metallica\s+\S+\s+\d+\s+(.+?)(?:\s*[-|]|$)/);
    const artist = artistMatch ? artistMatch[1].trim() : '';

    const sizeMatch = html.match(/(\d+)"\s*x\s*(\d+)"/i);
    const size = sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : '18x24';

    const venueMatch = html.match(/Venue[^:]*:\s*([^\n<]+)/i);
    const cityMatch  = html.match(/City[^:]*:\s*([^\n<]+)/i);
    const tourMatch  = html.match(/Tour[^:]*:\s*([^\n<]+)/i);
    const notes = [tourMatch?.[1], venueMatch?.[1], cityMatch?.[1]]
      .filter(Boolean).map(s => s.trim()).join(' — ').slice(0, 200);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ name, year, edition, artist, size, image, notes })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
