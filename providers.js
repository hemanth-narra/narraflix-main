const STREAMING_PROVIDERS = {
    vidfast: {
        name: 'Vidfast',
        movie: (id) => `https://vidfast.vc/movie/${id}`,
        series: (id, season, episode) => `https://vidfast.pro/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
        // Domains: https://vidsrc.domains/
    },
    vidlink: {
        name: 'Vidlink',
        movie: (id) => `https://vidlink.pro/movie/${id}`,
        series: (id, season, episode) => `https://vidlink.pro/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
    },
    embed2: {
        name: '2Embed',
        movie: (id) => `https://www.2embed.cc/embed/${id}`,
        series: (id, season, episode) => `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`,
        referrerPolicy: null
    },
    videasy: {
        name: 'Videasy',
        movie: (id) => `https://player.videasy.net/movie/${id}`,
        series: (id, season, episode) => `https://player.videasy.net/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
    },
    vidsrc: {
        name: 'Vidsrc',
        movie: (id) => `https://vidsrcme.ru/embed/movie/${id}`,
        series: (id, season, episode) => `https://vidsrcme.ru/embed/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
        // Domains: https://vidsrc.domains/
    },
    multiembed: {
        name: 'Multiembed',
        movie: (id) => `https://multiembed.mov/?video_id=${id}`,
        series: (id, season, episode) => `https://multiembed.mov/?video_id=${id}&s=${season}&e=${episode}`,
        referrerPolicy: 'no-referrer'
    },
};

/**
 * Generates the embed URL for a given provider, type, and ID.
 * @param {string} provider - Key from STREAMING_PROVIDERS
 * @param {'movie'|'series'} type
 * @param {string|number} id - TMDB or IMDB id
 * @param {number} [season]
 * @param {number} [episode]
 * @returns {string|null}
 */
function generateEmbedUrl(provider, type, id, season, episode) {
    if (STREAMING_PROVIDERS[provider] && STREAMING_PROVIDERS[provider][type]) {
        return STREAMING_PROVIDERS[provider][type](id, season, episode);
    }
    return null;
}
