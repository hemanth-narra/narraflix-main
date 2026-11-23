/**
 * Narraflix - Dynamic Daily Trending & Curated Fallbacks
 * Uses TMDB's daily trending API with automatic IMDb ID resolution and caching.
 */

const TMDB_KEY = '1cf50e6248dc270629e802686245c2c8';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TRENDING_CACHE_KEY = 'narraflix_daily_trending_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Fallback data with 100% verified, permanent TMDB CDN posters ─────────────
const FALLBACK_MOVIES = [
    {
        rank: 1,
        id: 'tt15398776',
        title: 'Oppenheimer',
        year: '2023',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg'
    },
    {
        rank: 2,
        id: 'tt0816692',
        title: 'Interstellar',
        year: '2014',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
    },
    {
        rank: 3,
        id: 'tt0468569',
        title: 'The Dark Knight',
        year: '2008',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg'
    },
    {
        rank: 4,
        id: 'tt1375666',
        title: 'Inception',
        year: '2010',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg'
    },
    {
        rank: 5,
        id: 'tt15239678',
        title: 'Dune: Part Two',
        year: '2024',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg'
    },
    {
        rank: 6,
        id: 'tt0137523',
        title: 'Fight Club',
        year: '1999',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg'
    },
    {
        rank: 7,
        id: 'tt9362722',
        title: 'Spider-Man: Across the Spider-Verse',
        year: '2023',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg'
    },
    {
        rank: 8,
        id: 'tt0110912',
        title: 'Pulp Fiction',
        year: '1994',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg'
    },
    {
        rank: 9,
        id: 'tt0133093',
        title: 'The Matrix',
        year: '1999',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg'
    },
    {
        rank: 10,
        id: 'tt0172495',
        title: 'Gladiator',
        year: '2000',
        type: 'movie',
        poster: 'https://image.tmdb.org/t/p/w500/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg'
    }
];

const FALLBACK_SERIES = [
    {
        rank: 1,
        id: 'tt0903747',
        title: 'Breaking Bad',
        year: '2008–2013',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg'
    },
    {
        rank: 2,
        id: 'tt0944947',
        title: 'Game of Thrones',
        year: '2011–2019',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg'
    },
    {
        rank: 3,
        id: 'tt4574334',
        title: 'Stranger Things',
        year: '2016–',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg'
    },
    {
        rank: 4,
        id: 'tt8602636',
        title: 'Chernobyl',
        year: '2019',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg'
    },
    {
        rank: 5,
        id: 'tt3581920',
        title: 'The Last of Us',
        year: '2023–',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/dmo6TYuuJgaYinXBPjrgG9mB5od.jpg'
    },
    {
        rank: 6,
        id: 'tt7660850',
        title: 'Succession',
        year: '2018–2023',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg'
    },
    {
        rank: 7,
        id: 'tt3032476',
        title: 'Better Call Saul',
        year: '2015–2022',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg'
    },
    {
        rank: 8,
        id: 'tt1190634',
        title: 'The Boys',
        year: '2019–',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/in1R2dDc421JxsoRWaIIAqVI2KE.jpg'
    },
    {
        rank: 9,
        id: 'tt11126994',
        title: 'Arcane',
        year: '2021–',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg'
    },
    {
        rank: 10,
        id: 'tt11198330',
        title: 'House of the Dragon',
        year: '2022–',
        type: 'series',
        poster: 'https://image.tmdb.org/t/p/w500/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg'
    }
];

// Global references initialized to fallback
var FEATURED_MOVIES = FALLBACK_MOVIES;
var FEATURED_SERIES = FALLBACK_SERIES;

if (typeof window !== 'undefined') {
    window.FEATURED_MOVIES = FEATURED_MOVIES;
    window.FEATURED_SERIES = FEATURED_SERIES;
}

/**
 * Loads trending data from cache or fresh TMDB API.
 * Calls onUpdate({ movies, series }) whenever fresh data is ready.
 */
async function loadDailyTrending(onUpdate) {
    // 1. Check local cache first
    try {
        const cached = localStorage.getItem(TRENDING_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            const isFresh = (Date.now() - parsed.timestamp) < CACHE_TTL_MS;
            if (parsed.movies && parsed.series) {
                FEATURED_MOVIES = parsed.movies;
                FEATURED_SERIES = parsed.series;
                if (typeof window !== 'undefined') {
                    window.FEATURED_MOVIES = FEATURED_MOVIES;
                    window.FEATURED_SERIES = FEATURED_SERIES;
                }
                if (typeof onUpdate === 'function') {
                    onUpdate({ movies: parsed.movies, series: parsed.series });
                }
                if (isFresh) {
                    return; // Cache is fresh, no background refresh needed
                }
            }
        }
    } catch (e) {
        console.warn('Error reading trending cache:', e);
    }

    // 2. Fetch fresh real daily trending from TMDB
    try {
        const [movieRes, tvRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_KEY}`).then(r => r.json()),
            fetch(`https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_KEY}`).then(r => r.json())
        ]);

        const rawMovies = (movieRes.results || []).slice(0, 10);
        const rawSeries = (tvRes.results || []).slice(0, 10);

        // Resolve IMDb IDs in parallel
        const [movies, series] = await Promise.all([
            Promise.all(rawMovies.map(async (m, i) => {
                let imdbId = null;
                try {
                    const ext = await fetch(`https://api.themoviedb.org/3/movie/${m.id}/external_ids?api_key=${TMDB_KEY}`).then(r => r.json());
                    imdbId = ext.imdb_id;
                } catch (e) {}
                return {
                    rank: i + 1,
                    id: imdbId || String(m.id),
                    title: m.title || m.original_title,
                    year: (m.release_date || '').split('-')[0] || '',
                    type: 'movie',
                    poster: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : 'N/A'
                };
            })),
            Promise.all(rawSeries.map(async (s, i) => {
                let imdbId = null;
                try {
                    const ext = await fetch(`https://api.themoviedb.org/3/tv/${s.id}/external_ids?api_key=${TMDB_KEY}`).then(r => r.json());
                    imdbId = ext.imdb_id;
                } catch (e) {}
                return {
                    rank: i + 1,
                    id: imdbId || String(s.id),
                    title: s.name || s.original_name,
                    year: (s.first_air_date || '').split('-')[0] || '',
                    type: 'series',
                    poster: s.poster_path ? `${TMDB_IMAGE_BASE}${s.poster_path}` : 'N/A'
                };
            }))
        ]);

        if (movies.length > 0 && series.length > 0) {
            FEATURED_MOVIES = movies;
            FEATURED_SERIES = series;
            if (typeof window !== 'undefined') {
                window.FEATURED_MOVIES = FEATURED_MOVIES;
                window.FEATURED_SERIES = FEATURED_SERIES;
            }

            // Save to localStorage for 24h
            try {
                localStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    movies,
                    series
                }));
            } catch (e) {}

            if (typeof onUpdate === 'function') {
                onUpdate({ movies, series });
            }
        }
    } catch (err) {
        console.warn('Could not fetch daily trending, using curated favorites:', err);
    }
}

if (typeof window !== 'undefined') {
    window.loadDailyTrending = loadDailyTrending;
}
