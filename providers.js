const STREAMING_PROVIDERS = {
    vidbolt: {
        name: 'VidBolt (Multi-Audio)',
        movie: (id, tmdbId) => `https://vidbolt.xyz/movie/${tmdbId || id}`,
        series: (id, season, episode, tmdbId) => `https://vidbolt.xyz/tv/${tmdbId || id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
    },
    bingeapi: {
        name: 'BingeAPI',
        movie: (id, tmdbId) => `https://bingeapi.st/embed/movie/${tmdbId || id}?theme=dark`,
        series: (id, season, episode, tmdbId) => `https://bingeapi.st/embed/tv/${tmdbId || id}/${season}/${episode}?theme=dark`,
        referrerPolicy: 'no-referrer'
    },
    vidnest: {
        name: 'VidNest',
        movie: (id, tmdbId) => `https://vidnest.fun/movie/${tmdbId || id}`,
        series: (id, season, episode, tmdbId) => `https://vidnest.fun/tv/${tmdbId || id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
    },
    vidlink: {
        name: 'Vidlink',
        movie: (id) => `https://vidlink.pro/movie/${id}`,
        series: (id, season, episode) => `https://vidlink.pro/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
    },
    embedmaster: {
        name: 'EmbedMaster',
        movie: (id) => `https://embedmaster.link/movie/${id}`,
        series: (id, season, episode) => `https://embedmaster.link/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
    },
    vidfast: {
        name: 'Vidfast',
        movie: (id) => `https://vidfast.vc/movie/${id}`,
        series: (id, season, episode) => `https://vidfast.pro/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
        // Domains: https://vidsrc.domains/
    },
    movietv: {
        name: 'MovieTV',
        movie: (id) => `https://movietvapi.stream/embed/${id}`,
        series: (id, season, episode) => `https://movietvapi.stream/embed/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
    },
    multiembed: {
        name: 'Multiembed',
        movie: (id) => `https://multiembed.mov/?video_id=${id}`,
        series: (id, season, episode) => `https://multiembed.mov/?video_id=${id}&s=${season}&e=${episode}`,
        referrerPolicy: 'no-referrer'
    },
    embed2: {
        name: '2Embed',
        movie: (id) => `https://www.2embed.cc/embed/${id}`,
        series: (id, season, episode) => `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`,
        referrerPolicy: null
    },
    vidsrc: {
        name: 'Vidsrc',
        movie: (id) => `https://vidsrcme.ru/embed/movie/${id}`,
        series: (id, season, episode) => `https://vidsrcme.ru/embed/tv/${id}/${season}/${episode}`,
        referrerPolicy: 'no-referrer'
        // Domains: https://vidsrc.domains/
    },
};

/**
 * Generates the embed URL for a given provider, type, and ID.
 * @param {string} provider - Key from STREAMING_PROVIDERS
 * @param {'movie'|'series'} type
 * @param {string|number} id - TMDB or IMDB id
 * @param {number} [season]
 * @param {number} [episode]
 * @param {string|number} [tmdbId] - Numeric TMDB ID for providers requiring TMDB format
 * @returns {string|null}
 */
function generateEmbedUrl(provider, type, id, season, episode, tmdbId) {
    if (STREAMING_PROVIDERS[provider] && STREAMING_PROVIDERS[provider][type]) {
        if (type === 'movie') {
            return STREAMING_PROVIDERS[provider].movie(id, tmdbId);
        }
        return STREAMING_PROVIDERS[provider].series(id, season, episode, tmdbId);
    }
    return null;
}
