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

    const artId = url.match(/\/art\/(\d+)/)?.[1];

    // Try PosterDrops API endpoint directly
    const apiRes = await fetch(`https://www.posterdrops.com/api/arts/${artId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.posterdrops.com/',
        'Origin': 'https://www.posterdrops.com'
      }
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      const art = data.art || data;

      const titleLower = (art.title || art.name || '').toLowerCase();
      let edition = 'Regular';
      if (titleLower.includes('foil')) edition = 'Foil';
      else if (titleLower.includes('variant') || titleLower.includes('artist proof') || titleLower.includes('artist edition')) edition = 'Artist Proof';

      const yearMatch = (art.title || art.name || '').match(/\b(19|20)\d{2}\b/);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          name:    art.title || art.name || '',
          year:    yearMatch ? parseInt(yearMatch[0]) : (art.year || null),
          edition,
          artist:  art.designer?.name || art.artist || '',
          run:     art.print_run || art.printRun || null,
          size:    art.size || '18x24',
          image:   art.image_url || art.imageUrl || art.image || '',
          notes:   [art.tour, art.venue, art.city].filter(Boolean).join(' — ')
        })
      };
    }

    // Fallback — scrape the HTML page
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });

    const html = await pageRes.text();

    // Try to find JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const ld = JSON.parse(jsonLdMatch[1]);
        const titleLower = (ld.name || '').toLowerCase();
        let edition = 'Regular';
        if (titleLower.includes('foil')) edition = 'Foil';
        else if (titleLower.includes('variant') || titleLower.includes('artist proof')) edition = 'Artist Proof';
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            name: ld.name || '',
            year: null,
            edition,
            artist: ld.brand?.name || ld.author?.name || '',
            run: null,
            size: '18x24',
            image: ld.image || '',
            notes: ld.description || ''
          })
        };
      } catch(e) {}
    }

    // Try og:tags
    const og = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`, 'i'));
      return m ? m[1] : '';
    };

    const title = og('og:title').replace(/ \| PosterDrops\.com$/, '').trim();
    const image = og('og:image');
    const titleLower = title.toLowerCase();
    let edition = 'Regular';
    if (titleLower.includes('foil')) edition = 'Foil';
    else if (titleLower.includes('variant') || titleLower.includes('artist proof')) edition = 'Artist Proof';
    const yearMatch2 = title.match(/\b(19|20)\d{2}\b/);

    // Try to find __NEXT_DATA__ or window.__data__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const art = nextData?.props?.pageProps?.art || nextData?.props?.pageProps?.data;
        if (art) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              name:    art.title || art.name || title,
              year:    art.year || (yearMatch2 ? parseInt(yearMatch2[0]) : null),
              edition: art.edition || edition,
              artist:  art.designer?.name || art.artist || '',
              run:     art.print_run || null,
              size:    art.size || '18x24',
              image:   art.image_url || art.image || image,
              notes:   [art.tour, art.venue, art.city].filter(Boolean).join(' — ')
            })
          };
        }
      } catch(e) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        name: title,
        year: yearMatch2 ? parseInt(yearMatch2[0]) : null,
        edition,
        artist: '',
        run: null,
        size: '18x24',
        image,
        notes: ''
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
