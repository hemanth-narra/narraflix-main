/**
 * Main application state and configuration.
 */
const App = {
    imdbId: null,
    tmdbId: null,
    mediaType: 'movie',
    totalSeasons: 0,
    seriesCache: {},
    elements: {},
};

/**
 * Best-effort popup & redirect blocker.
 *
 * What this covers (without a browser extension):
 *   1. window.open() calls on the top frame  → silently suppressed.
 *   2. Script-triggered page navigation away → cancelled via beforeunload.
 *   3. Overlay/ad elements injected into our DOM → auto-removed.
 *
 * What it CANNOT cover:
 *   • Network requests made inside cross-origin iframes (needs an extension).
 *   • Ads rendered entirely within the iframe's own DOM.
 */
function initAdBlocker() {
    // ── 1. Block window.open() on this frame ─────────────────────────────────
    // Ad scripts sometimes escalate via window.top.open() or window.opener.open().
    // Overriding on our window stops attempts routed through the top-level context.
    window.open = () => {
        console.debug('[Narraflix] Blocked popup attempt via window.open');
        return null;
    };

    // ── 2. Prevent unexpected top-frame navigation ────────────────────────────
    // Tracks whether WE caused the navigation (server switch, episode change, etc.)
    // so we don't block our own history.pushState calls.
    let navAllowed = false;
    const allowNav = () => { navAllowed = true; };

    // Patch pushState/replaceState so our own URL updates stay allowed
    const _pushState    = history.pushState.bind(history);
    const _replaceState = history.replaceState.bind(history);
    history.pushState = (...args)    => { allowNav(); _pushState(...args); };
    history.replaceState = (...args) => { allowNav(); _replaceState(...args); };

    window.addEventListener('beforeunload', (e) => {
        if (!navAllowed) {
            // Cancel the navigation — this stops ad scripts redirecting your tab
            e.preventDefault();
            e.returnValue = '';
            console.debug('[Narraflix] Blocked unexpected page navigation');
        }
        navAllowed = false; // reset for next legitimate navigation
    });

    // ── 3. Remove overlay elements injected into our DOM ─────────────────────
    // Some ad scripts break out of the iframe and append fixed-position divs
    // or hidden iframes to the parent document. Remove them immediately.
    const SAFE_IDS = new Set(['disclaimer-modal', 'app-root']);
    const SAFE_CLASSES = new Set(['modal-overlay', 'container']);

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                // Skip known-safe Narraflix elements
                if (SAFE_IDS.has(node.id)) continue;
                if ([...node.classList].some(c => SAFE_CLASSES.has(c))) continue;

                const style = getComputedStyle(node);
                const isOverlay = style.position === 'fixed' || style.position === 'absolute';
                const isHiddenIframe = node.tagName === 'IFRAME' && node !== App.elements.playerSection?.firstChild;

                if (isOverlay || isHiddenIframe) {
                    console.debug('[Narraflix] Removed injected element:', node.tagName, node.id || node.className);
                    node.remove();
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}


/**
 * Ambient floating particle canvas background matching hemanthnarra.in
 */
function initBackgroundEffect() {
    const canvas = document.querySelector('canvas#bg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    function Point() {
        const r = 8;
        this.init = function() {
            this.progress = -4 * Math.random();
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.r = 0;
            this.rng = Math.random();
        };
        this.draw = function() {
            if (this.progress >= 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, Math.abs(Math.sin(Math.PI * this.progress) * r), 0, 2 * Math.PI);
                ctx.fill();
            }
        };
        this.render = function() {
            if (this.progress > 0.5) this.progress += 0.005;
            else this.progress += 0.05;
            this.draw();
            if (this.progress >= 1) this.init();
        };
    }

    const dots = [];
    const n = 22;
    for (let i = 0; i < n; i++) {
        dots[i] = new Point();
        dots[i].init();
    }

    let animationFrameId = null;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    function loop() {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < n; i++) {
            dots[i].render();
        }
        animationFrameId = requestAnimationFrame(loop);
    }

    function startAnimation() {
        if (!animationFrameId && !reducedMotionQuery.matches && !document.hidden) {
            animationFrameId = requestAnimationFrame(loop);
        }
    }

    function stopAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    if (!reducedMotionQuery.matches && !document.hidden) {
        startAnimation();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopAnimation();
        else startAnimation();
    });

    reducedMotionQuery.addEventListener('change', (e) => {
        if (e.matches) stopAnimation();
        else startAnimation();
    });
}

/**
 * Fetches media details from the OMDb API.
 * @returns {Promise<object|null>} The media data object, or null if not found.
 */
async function fetchMediaDetails() {
    try {
        // 1. Try OMDb API if we have an IMDb ID (tt...)
        if (typeof App.imdbId === 'string' && App.imdbId.startsWith('tt')) {
            try {
                const response = await fetch(`https://www.omdbapi.com/?i=${App.imdbId}&apikey=thewdb`);
                const data = await response.json();
                if (data && data.Response === "True") {
                    App.mediaType = data.Type;
                    App.totalSeasons = data.totalSeasons;
                    // Pre-resolve numeric TMDB ID for multi-audio providers like VidBolt
                    resolveTmdbId(App.imdbId).then(id => {
                        App.tmdbId = id;
                    });
                    return data;
                }
            } catch (omdbErr) {
                console.warn("OMDb request failed, trying TMDB fallback:", omdbErr);
            }
        }

        // 2. TMDB fallback (handles numeric TMDB IDs or IMDb IDs that failed on OMDb)
        const tmdbApiKey = (typeof TMDB_KEY !== 'undefined') ? TMDB_KEY : '1cf50e6248dc270629e802686245c2c8';
        let tmdbData = null;
        let type = 'movie';

        if (typeof App.imdbId === 'string' && App.imdbId.startsWith('tt')) {
            const findRes = await fetch(`https://api.themoviedb.org/3/find/${App.imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`).then(r => r.json());
            if (findRes.movie_results && findRes.movie_results.length > 0) {
                tmdbData = findRes.movie_results[0];
                type = 'movie';
            } else if (findRes.tv_results && findRes.tv_results.length > 0) {
                tmdbData = findRes.tv_results[0];
                type = 'series';
            }
        } else {
            // Numeric TMDB ID: try movie then tv
            try {
                const mov = await fetch(`https://api.themoviedb.org/3/movie/${App.imdbId}?api_key=${tmdbApiKey}`).then(r => r.json());
                if (mov && (mov.title || mov.id)) {
                    tmdbData = mov;
                    type = 'movie';
                }
            } catch (e) {}

            if (!tmdbData) {
                try {
                    const tv = await fetch(`https://api.themoviedb.org/3/tv/${App.imdbId}?api_key=${tmdbApiKey}`).then(r => r.json());
                    if (tv && (tv.name || tv.id)) {
                        tmdbData = tv;
                        type = 'series';
                    }
                } catch (e) {}
            }
        }

        if (tmdbData) {
            let imdbId = App.imdbId;
            let fullDetails = null;
            try {
                const endpoint = type === 'series' ? 'tv' : 'movie';
                fullDetails = await fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbData.id}?api_key=${tmdbApiKey}&append_to_response=external_ids`).then(r => r.json());
                if (fullDetails && fullDetails.external_ids && fullDetails.external_ids.imdb_id) {
                    App.imdbId = fullDetails.external_ids.imdb_id;
                    imdbId = fullDetails.external_ids.imdb_id;
                }
            } catch (e) {}

            const details = fullDetails || tmdbData;
            App.tmdbId = String(tmdbData.id);
            App.mediaType = type;
            App.totalSeasons = details.number_of_seasons ? String(details.number_of_seasons) : '1';

            return {
                Title: details.title || details.name || details.original_title || details.original_name,
                Year: (details.release_date || details.first_air_date || '').split('-')[0] || '',
                Rated: details.adult ? 'R' : 'PG-13',
                Runtime: details.runtime ? `${details.runtime} min` : (details.episode_run_time && details.episode_run_time[0] ? `${details.episode_run_time[0]} min` : 'N/A'),
                Genre: details.genres && details.genres.length > 0 ? details.genres.map(g => g.name).join(', ') : 'Drama',
                Director: 'N/A',
                Actors: 'N/A',
                Plot: details.overview || 'No plot synopsis available.',
                Poster: details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : 'N/A',
                Ratings: details.vote_average ? [{ Source: 'TMDB', Value: `${details.vote_average.toFixed(1)}/10` }] : [],
                Type: type,
                totalSeasons: App.totalSeasons,
                imdbID: imdbId
            };
        }

        console.warn("Media not found in OMDb or TMDB.");
        return null;
    } catch (error) {
        console.error("Error fetching media details:", error);
        return null;
    }
}

/**
 * Renders the initial layout with all necessary skeleton placeholders.
 */
function renderInitialLayout() {
    const serverCount = Object.keys(STREAMING_PROVIDERS).length;
    const serverSkeletons = Array(serverCount).fill('<div class="skeleton" style="height: 42px; border-radius: 0.75rem;"></div>').join('');

    App.elements.root.innerHTML = `
        <div class="container">
            <header class="app-header">
                <a href="${window.location.pathname}" class="app-logo">Narraflix</a>
                <a href="${window.location.pathname}" class="search-nav-btn" aria-label="Search title or ID">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                    <span>Search</span>
                </a>
            </header>
            <div class="top-section">
                <div>
                    <div class="stream-player-section skeleton" id="stream-player-section"></div>
                    <div id="series-controls-placeholder"></div>
                </div>
                <aside class="sidebar">
                    <div class="sidebar-header">
                        <h2>Servers</h2>
                        <button type="button" id="health-check-btn" class="health-check-btn" aria-label="Recheck servers" title="Recheck servers">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                        </button>
                    </div>
                    <div class="stream-buttons" id="stream-buttons">${serverSkeletons}</div>
                </aside>
            </div>
            <div class="info-container" id="info-container">
                <div class="info-section" id="info-section">
                    <div class="poster skeleton"></div>
                    <div class="details" style="flex: 1;">
                        <div class="skeleton skeleton-text" style="width: 80%; height: 2.5rem; margin-bottom: 0.5rem;"></div>
                        <div class="skeleton skeleton-text" style="width: 60%; height: 1rem; margin-bottom: 1rem;"></div>
                        <div class="skeleton skeleton-text" style="width: 100%;"></div>
                        <div class="skeleton skeleton-text" style="width: 100%;"></div>
                        <div class="skeleton skeleton-text" style="width: 40%;"></div>
                        <div style="display: flex; gap: 1.5rem; margin: 1.5rem 0;">
                            <div class="skeleton" style="width: 80px; height: 40px; border-radius: 0.5rem;"></div>
                            <div class="skeleton" style="width: 80px; height: 40px; border-radius: 0.5rem;"></div>
                        </div>
                        <div class="skeleton skeleton-text" style="width: 80%;"></div>
                        <div class="skeleton skeleton-text" style="width: 90%;"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Cache all necessary elements right after they are created
    App.elements.playerSection = document.getElementById('stream-player-section');
    App.elements.seriesControlsPlaceholder = document.getElementById('series-controls-placeholder');
    App.elements.serverButtons = document.getElementById('stream-buttons');
    App.elements.healthButton = document.getElementById('health-check-btn');
    App.elements.infoContainer = document.getElementById('info-container');
    App.elements.infoSection = document.getElementById('info-section');
}

/**
 * In-memory cache for resolved TMDB posters to avoid duplicate network calls.
 */
const posterCache = new Map();

/**
 * Creates a stylish typographic placeholder for media missing a poster image.
 * @param {string} title
 * @param {string} [year]
 * @returns {HTMLElement}
 */
function createPosterPlaceholder(title, year) {
    const placeholder = document.createElement('div');
    placeholder.className = 'poster-placeholder';
    placeholder.innerHTML = `
        <div class="poster-placeholder-glow"></div>
        <div class="poster-placeholder-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
            </svg>
        </div>
        <div class="poster-placeholder-title">${title || 'Narraflix'}</div>
        ${year ? `<div class="poster-placeholder-year">${year}</div>` : ''}
    `;
    return placeholder;
}

/**
 * In-memory cache for resolved TMDB IDs.
 */
const tmdbIdCache = new Map();

/**
 * Resolves a numeric TMDB ID from an IMDb ID (tt...)
 * @param {string} imdbId
 * @returns {Promise<string|null>}
 */
async function resolveTmdbId(imdbId) {
    if (!imdbId) return null;
    if (/^\d+$/.test(String(imdbId))) return String(imdbId);
    if (tmdbIdCache.has(imdbId)) return tmdbIdCache.get(imdbId);

    const tmdbApiKey = (typeof TMDB_KEY !== 'undefined') ? TMDB_KEY : '1cf50e6248dc270629e802686245c2c8';
    try {
        const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`).then(r => r.json());
        const match = (findRes.movie_results && findRes.movie_results[0]) ||
                      (findRes.tv_results && findRes.tv_results[0]);
        if (match && match.id) {
            const tmdbId = String(match.id);
            tmdbIdCache.set(imdbId, tmdbId);
            return tmdbId;
        }
    } catch (e) {
        console.warn('Failed to resolve TMDB ID for:', imdbId, e);
    }
    return null;
}

/**
 * Resolves a missing or broken poster URL via TMDB API.
 * @param {string} imdbId
 * @param {string} title
 * @param {string} [year]
 * @returns {Promise<string|null>}
 */
async function resolvePosterUrl(imdbId, title, year) {
    const cacheKey = imdbId || `${title}_${year}`;
    if (posterCache.has(cacheKey)) {
        return posterCache.get(cacheKey);
    }

    const tmdbApiKey = (typeof TMDB_KEY !== 'undefined') ? TMDB_KEY : '1cf50e6248dc270629e802686245c2c8';
    let posterUrl = null;

    // 1. Try TMDB /find by IMDb ID
    if (imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
        try {
            const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?api_key=${tmdbApiKey}&external_source=imdb_id`).then(r => r.json());
            const match = (findRes.movie_results && findRes.movie_results.find(m => m.poster_path)) ||
                          (findRes.tv_results && findRes.tv_results.find(t => t.poster_path));
            if (match) {
                if (match.id) tmdbIdCache.set(imdbId, String(match.id));
                if (match.poster_path) posterUrl = `https://image.tmdb.org/t/p/w500${match.poster_path}`;
            }
        } catch (e) {}
    }

    // 2. Search TMDB multi by title if still no poster
    if (!posterUrl && title) {
        try {
            const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
            const searchRes = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${tmdbApiKey}&query=${encodeURIComponent(cleanTitle)}`).then(r => r.json());
            if (searchRes.results && searchRes.results.length > 0) {
                let match = null;
                if (year) {
                    const y = parseInt(year, 10);
                    match = searchRes.results.find(r => {
                        const releaseYear = parseInt((r.release_date || r.first_air_date || '').split('-')[0], 10);
                        return r.poster_path && Math.abs(releaseYear - y) <= 1;
                    });
                }
                if (!match) {
                    match = searchRes.results.find(r => r.poster_path);
                }
                if (match && match.poster_path) {
                    posterUrl = `https://image.tmdb.org/t/p/w500${match.poster_path}`;
                }
            }
        } catch (e) {}
    }

    posterCache.set(cacheKey, posterUrl);
    return posterUrl;
}

/**
 * Mounts a poster image with automatic TMDB fallback and elegant typographic placeholder.
 */
function attachPoster({ container, posterUrl, title, year, imdbId, imgClass = 'shelf-poster-img' }) {
    const hasInitialPoster = posterUrl && posterUrl !== 'N/A';
    const placeholder = createPosterPlaceholder(title, year);
    container.appendChild(placeholder);

    if (hasInitialPoster) {
        const img = document.createElement('img');
        img.className = imgClass;
        img.src = posterUrl;
        img.alt = `${title} poster`;
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';

        img.onload = () => {
            placeholder.style.display = 'none';
        };

        img.onerror = async () => {
            img.style.display = 'none';
            placeholder.style.display = 'flex';
            const fallbackUrl = await resolvePosterUrl(imdbId, title, year);
            if (fallbackUrl && fallbackUrl !== posterUrl) {
                img.src = fallbackUrl;
                img.style.display = 'block';
            }
        };

        container.appendChild(img);
    } else {
        // No initial poster: resolve via TMDB asynchronously
        resolvePosterUrl(imdbId, title, year).then(tmdbUrl => {
            if (tmdbUrl) {
                const img = document.createElement('img');
                img.className = imgClass;
                img.src = tmdbUrl;
                img.alt = `${title} poster`;
                img.loading = 'lazy';
                img.referrerPolicy = 'no-referrer';
                img.onload = () => {
                    placeholder.style.display = 'none';
                };
                img.onerror = () => {
                    img.style.display = 'none';
                    placeholder.style.display = 'flex';
                };
                container.appendChild(img);
            }
        });
    }
}

/**
 * Populates the info section with media details, replacing its skeleton.
 * @param {object} data - The media data from OMDb API.
 */
function renderMediaDetails(data) {
    document.title = `${data.Title} - Narraflix`;

    // --- Safe helper: sets textContent on a node ---
    const setText = (el, text) => { el.textContent = text; return el; };
    const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

    // Build ratings safely (values come from OMDb and are display-safe, but we use textContent anyway)
    const ratingsDiv = el('div', 'ratings');
    (data.Ratings || []).forEach(rating => {
        const ratingEl = el('div', 'rating');
        ratingEl.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
        const valEl = el('div'); setText(el('div', 'value'), rating.Value).appendTo?.(valEl) || valEl.append(setText(el('div', 'value'), rating.Value), setText(el('div', 'source'), rating.Source));
        ratingEl.append(valEl);
        ratingsDiv.append(ratingEl);
    });

    // Poster — fall back gracefully with TMDB fallback & elegant placeholder
    const posterEl = el('div', 'poster');
    attachPoster({
        container: posterEl,
        posterUrl: data.Poster,
        title: data.Title,
        year: data.Year,
        imdbId: App.imdbId,
        imgClass: 'poster-img'
    });
    posterEl.setAttribute('role', 'img');
    posterEl.setAttribute('aria-label', `${data.Title} poster`);

    // Details block
    const detailsEl = el('div', 'details');

    const titleEl = el('h1'); setText(titleEl, data.Title);

    const metaEl = el('div', 'meta');
    [data.Year, data.Runtime, data.Rated, data.Genre]
        .filter(Boolean)
        .forEach((val, i, arr) => {
            const span = el('span'); setText(span, val); metaEl.append(span);
            if (i < arr.length - 1) metaEl.append(' • ');
        });

    const plotEl = el('p', 'plot'); setText(plotEl, data.Plot);

    const extraEl = el('div', 'extra-details');
    [['Director', data.Director], ['Actors', data.Actors]].forEach(([label, value]) => {
        const row = el('div');
        const strong = el('strong'); setText(strong, `${label}: `);
        const valueNode = document.createTextNode(value || 'N/A');
        row.append(strong, valueNode);
        extraEl.append(row);
    });

    detailsEl.append(titleEl, metaEl, plotEl, ratingsDiv, extraEl);
    App.elements.infoSection.replaceChildren(posterEl, detailsEl);
}

/**
 * Renders the server buttons, replacing their skeleton.
 */
function renderServerButtons() {
    App.elements.serverButtons.innerHTML = '';
    Object.entries(STREAMING_PROVIDERS).forEach(([id, provider]) => {
        const button = document.createElement('button');
        button.className = 'stream-button';
        button.dataset.provider = id;

        const label = document.createElement('span');
        label.textContent = provider.name;

        const status = document.createElement('span');
        status.className = 'server-status';
        status.dataset.provider = id;

        button.append(label, status);
        button.onclick = () => {
            document.querySelectorAll('.stream-button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            showStream(id);
        };
        App.elements.serverButtons.appendChild(button);
    });
}

/**
 * Paints one provider's status dot and tooltip.
 * @param {object} result - A result from checkProvider.
 */
function renderHealthStatus(result) {
    const dot = App.elements.serverButtons.querySelector(`.server-status[data-provider="${result.id}"]`);
    if (!dot) return;
    dot.dataset.status = result.status;
    dot.parentElement.title = result.detail || '';
}

/**
 * Probes every provider, painting each result as it lands.
 */
async function runHealthCheck() {
    const button = App.elements.healthButton;
    if (button.disabled) return;

    button.disabled = true;
    button.classList.add('is-checking');
    App.elements.serverButtons.querySelectorAll('.server-status').forEach(dot => {
        dot.dataset.status = 'checking';
        dot.parentElement.title = 'Checking…';
    });

    try {
        await checkAllProviders({ onResult: renderHealthStatus });
    } finally {
        button.disabled = false;
        button.classList.remove('is-checking');
    }
}

/**
 * Fetches and populates episodes for a given season.
 * @param {string} season - The season number to fetch.
 */
async function fetchEpisodes(season) {
    const { episodeSelect } = App.elements;
    episodeSelect.innerHTML = '';

    if (App.seriesCache[season]) {
        App.seriesCache[season].forEach(episode => {
            const option = document.createElement('option');
            option.value = episode.Episode;
            option.textContent = `Episode ${episode.Episode}: ${episode.Title}`;
            episodeSelect.appendChild(option);
        });
        return;
    }

    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${App.imdbId}&Season=${season}&apikey=thewdb`);
        const data = await response.json();
        if (data.Response === "True" && data.Episodes && data.Episodes.length > 0) {
            App.seriesCache[season] = data.Episodes;
            data.Episodes.forEach(episode => {
                const option = document.createElement('option');
                option.value = episode.Episode;
                option.textContent = `Episode ${episode.Episode}: ${episode.Title}`;
                episodeSelect.appendChild(option);
            });
            return;
        }
    } catch (error) {
        console.error("Error fetching episodes from OMDb:", error);
    }

    // Fallback: generate default episodes so series is always playable
    const fallbackEpisodes = Array.from({ length: 24 }, (_, i) => ({
        Episode: String(i + 1),
        Title: `Episode ${i + 1}`
    }));
    App.seriesCache[season] = fallbackEpisodes;
    fallbackEpisodes.forEach(ep => {
        const option = document.createElement('option');
        option.value = ep.Episode;
        option.textContent = ep.Title;
        episodeSelect.appendChild(option);
    });
}

/**
 * Renders the series navigation controls, replacing the skeleton placeholder.
 */
function setupSeriesControls() {
    const controlsPlaceholder = App.elements.seriesControlsPlaceholder;
    controlsPlaceholder.className = 'series-controls';
    controlsPlaceholder.innerHTML = `
        <div class="series-selector">
            <label for="season-select">Season:</label>
            <select id="season-select"></select>
        </div>
        <div class="series-selector">
            <label for="episode-select">Episode:</label>
            <select id="episode-select"></select>
        </div>
        <div class="episode-nav-container">
            <button id="prev-episode" class="episode-nav-btn">Previous Episode</button>
            <button id="next-episode" class="episode-nav-btn">Next Episode</button>
        </div>
    `;

    App.elements.seasonSelect = document.getElementById('season-select');
    App.elements.episodeSelect = document.getElementById('episode-select');
    App.elements.prevEpisodeBtn = document.getElementById('prev-episode');
    App.elements.nextEpisodeBtn = document.getElementById('next-episode');

    const { seasonSelect, episodeSelect, prevEpisodeBtn, nextEpisodeBtn } = App.elements;

    for (let i = 1; i <= App.totalSeasons; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Season ${i}`;
        seasonSelect.appendChild(option);
    }

    const updateEpisodeNavButtons = () => {
        const currentSeason = parseInt(seasonSelect.value, 10);
        const currentEpisode = parseInt(episodeSelect.value, 10);
        prevEpisodeBtn.disabled = currentSeason === 1 && currentEpisode === 1;
        nextEpisodeBtn.disabled = currentSeason === parseInt(App.totalSeasons, 10) && currentEpisode === episodeSelect.options.length;
    };

    const navigateEpisode = async (direction) => {
        let currentSeason = parseInt(seasonSelect.value);
        let currentEpisode = parseInt(episodeSelect.value);

        if (direction === 'next') {
            if (currentEpisode < episodeSelect.options.length) {
                currentEpisode++;
            } else if (currentSeason < App.totalSeasons) {
                currentSeason++;
                currentEpisode = 1;
                seasonSelect.value = currentSeason;
                await fetchEpisodes(currentSeason);
            }
        } else { // prev
            if (currentEpisode > 1) {
                currentEpisode--;
            } else if (currentSeason > 1) {
                currentSeason--;
                seasonSelect.value = currentSeason;
                await fetchEpisodes(currentSeason);
                currentEpisode = episodeSelect.options.length;
            }
        }
        episodeSelect.value = currentEpisode;
        episodeSelect.dispatchEvent(new Event('change'));
    };

    seasonSelect.addEventListener('change', async () => {
        await fetchEpisodes(seasonSelect.value);
        updateEpisodeNavButtons();
        const activeBtn = document.querySelector('.stream-button.active');
        if (activeBtn) showStream(activeBtn.dataset.provider);
    });

    episodeSelect.addEventListener('change', () => {
        updateEpisodeNavButtons();
        const activeBtn = document.querySelector('.stream-button.active');
        if (activeBtn) showStream(activeBtn.dataset.provider);
    });

    prevEpisodeBtn.addEventListener('click', () => navigateEpisode('prev'));
    nextEpisodeBtn.addEventListener('click', () => navigateEpisode('next'));
    
    updateEpisodeNavButtons();
}

/**
 * Displays the selected stream in the player and updates the URL.
 * @param {string} streamId - The ID of the streaming provider.
 */
async function showStream(streamId) {
    const provider = STREAMING_PROVIDERS[streamId];
    if (!provider) return;

    // Ensure TMDB ID is resolved (required for VidBolt and other TMDB providers)
    if (!App.tmdbId && App.imdbId) {
        if (/^\d+$/.test(String(App.imdbId))) {
            App.tmdbId = String(App.imdbId);
        } else {
            App.tmdbId = await resolveTmdbId(App.imdbId);
        }
    }

    const params = new URLSearchParams(window.location.search);
    let url;

    let season = null;
    let episode = null;

    if (App.mediaType === 'series') {
        season = App.elements.seasonSelect.value;
        episode = App.elements.episodeSelect.value;
        url = generateEmbedUrl(streamId, 'series', App.imdbId, season, episode, App.tmdbId);
        params.set('season', season);
        params.set('episode', episode);
    } else {
        url = generateEmbedUrl(streamId, 'movie', App.imdbId, null, null, App.tmdbId);
    }
    params.set('server', streamId);
    history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    App.elements.playerSection.classList.remove('skeleton');
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.title = 'Narraflix Player';
    iframe.allowFullscreen = true;
    // Permissions Policy: grant only what video players genuinely need.
    // No sandbox (providers reject it), but we restrict sensitive APIs.
    iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; web-share');
    iframe.setAttribute('referrerpolicy', provider.referrerPolicy || 'no-referrer');
    App.elements.playerSection.replaceChildren(iframe);

    // Save to Continue Watching history
    if (App.currentMedia) {
        saveToWatchHistory({
            id: App.imdbId,
            title: App.currentMedia.Title,
            year: App.currentMedia.Year,
            poster: App.currentMedia.Poster,
            type: App.mediaType,
            season: season,
            episode: episode,
            server: streamId,
            timestamp: Date.now()
        });
    }
}

/**
 * Displays an error message safely without innerHTML injection.
 * @param {string} message - The error message to display.
 */
function renderError(message) {
    const div = document.createElement('div');
    div.className = 'error-message';
    div.textContent = message;
    App.elements.root.replaceChildren(div);
}

const WATCH_HISTORY_KEY = 'narraflix_watch_history';

/**
 * Retrieves the watch history from localStorage.
 * @returns {Array<object>}
 */
function getWatchHistory() {
    try {
        const stored = localStorage.getItem(WATCH_HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Saves or updates a media item in the watch history.
 * @param {object} item
 */
function saveToWatchHistory(item) {
    try {
        let history = getWatchHistory();
        history = history.filter(h => h.id !== item.id);
        history.unshift(item);
        if (history.length > 15) history.length = 15;
        localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('Failed to save watch history:', e);
    }
}

/**
 * Removes an item from watch history.
 * @param {string} id
 */
function removeFromWatchHistory(id) {
    try {
        const history = getWatchHistory().filter(h => h.id !== id);
        localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {}
}

/**
 * Returns true if the string looks like a valid IMDb ID (tt + 7 or 8 digits).
 * @param {string} id
 * @returns {boolean}
 */
function isValidImdbId(id) {
    return /^tt\d{7,8}$/.test(id);
}

/**
 * Creates a shelf element (Continue Watching, Top 10 Movies, or Top 10 Series).
 * @param {object} config - { title, icon, items, isHistory, isRanked }
 * @returns {HTMLElement}
 */
function createShelfElement({ title, icon, items, isHistory = false, isRanked = false }) {
    const section = document.createElement('section');
    section.className = 'shelf-section';

    const header = document.createElement('div');
    header.className = 'shelf-header';
    header.innerHTML = `
        <h2 class="shelf-title">
            <span class="shelf-icon">${icon}</span>
            <span>${title}</span>
        </h2>
    `;
    section.appendChild(header);

    const shelfWrapper = document.createElement('div');
    shelfWrapper.className = 'shelf-wrapper';

    // Desktop Carousel Scroll Arrows (< and >)
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'shelf-arrow shelf-arrow-left';
    prevBtn.setAttribute('aria-label', `Scroll ${title} left`);
    prevBtn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'shelf-arrow shelf-arrow-right';
    nextBtn.setAttribute('aria-label', `Scroll ${title} right`);
    nextBtn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'shelf-scroll';

    const updateArrowState = () => {
        const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        if (maxScroll <= 5) {
            prevBtn.classList.remove('is-visible');
            nextBtn.classList.remove('is-visible');
            return;
        }
        if (scrollContainer.scrollLeft > 15) {
            prevBtn.classList.add('is-visible');
        } else {
            prevBtn.classList.remove('is-visible');
        }

        if (scrollContainer.scrollLeft < maxScroll - 15) {
            nextBtn.classList.add('is-visible');
        } else {
            nextBtn.classList.remove('is-visible');
        }
    };

    const getScrollStep = () => Math.max(340, Math.floor(scrollContainer.clientWidth * 0.75));

    prevBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
        scrollContainer.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
    });

    scrollContainer.addEventListener('scroll', updateArrowState, { passive: true });
    window.addEventListener('resize', updateArrowState, { passive: true });

    // Initialize arrow state once mounted
    requestAnimationFrame(() => {
        setTimeout(updateArrowState, 150);
    });

    items.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'shelf-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Play ${item.title}`);

        const posterDiv = document.createElement('div');
        posterDiv.className = 'shelf-poster';
        attachPoster({
            container: posterDiv,
            posterUrl: item.poster,
            title: item.title,
            year: item.year,
            imdbId: item.id,
            imgClass: 'shelf-poster-img'
        });

        // Badges: Rank Badge (#1 - #10) or Resume Badge (S1 : E2)
        if (isRanked) {
            const rankBadge = document.createElement('span');
            rankBadge.className = 'shelf-rank-badge';
            rankBadge.textContent = `#${item.rank || index + 1}`;
            posterDiv.appendChild(rankBadge);
        } else if (isHistory) {
            const resumeBadge = document.createElement('span');
            resumeBadge.className = 'shelf-resume-badge';
            if (item.type === 'series' && item.season && item.episode) {
                resumeBadge.textContent = `S${item.season} : E${item.episode}`;
            } else {
                resumeBadge.textContent = 'Movie';
            }
            posterDiv.appendChild(resumeBadge);

            // Remove button for history item
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'shelf-remove-btn';
            removeBtn.title = 'Remove from Continue Watching';
            removeBtn.setAttribute('aria-label', `Remove ${item.title} from history`);
            removeBtn.innerHTML = `&times;`;
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeFromWatchHistory(item.id);
                const shelvesContainer = document.getElementById('home-shelves');
                if (shelvesContainer) renderHomeShelves(shelvesContainer);
            };
            posterDiv.appendChild(removeBtn);
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'shelf-card-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'shelf-card-title';
        titleEl.textContent = item.title;

        const yearEl = document.createElement('div');
        yearEl.className = 'shelf-card-year';
        yearEl.textContent = item.year || '';

        infoDiv.append(titleEl, yearEl);
        card.append(posterDiv, infoDiv);

        const openMedia = () => {
            const params = new URLSearchParams();
            params.set('id', item.id);
            if (item.season) params.set('season', item.season);
            if (item.episode) params.set('episode', item.episode);
            if (item.server) params.set('server', item.server);
            window.location.search = `?${params.toString()}`;
        };

        card.addEventListener('click', openMedia);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openMedia();
            }
        });

        scrollContainer.appendChild(card);
    });

    shelfWrapper.append(prevBtn, scrollContainer, nextBtn);
    section.appendChild(shelfWrapper);
    return section;
}

/**
 * Renders all home page shelves: Continue Watching, Top 10 Movies, Top 10 Webseries.
 * @param {HTMLElement} container
 */
function renderHomeShelves(container) {
    container.innerHTML = '';

    const history = getWatchHistory();

    // ── 1. Continue Watching Shelf ──────────────────────────────────────────
    if (history.length > 0) {
        const historyShelf = createShelfElement({
            title: 'Continue Watching',
            icon: '🕒',
            items: history,
            isHistory: true
        });
        container.appendChild(historyShelf);
    }

    // ── 2. Top 10 Movies Shelf ──────────────────────────────────────────────
    if (typeof FEATURED_MOVIES !== 'undefined' && FEATURED_MOVIES.length > 0) {
        const moviesShelf = createShelfElement({
            title: 'Top 10 Movies',
            icon: '🎬',
            items: FEATURED_MOVIES,
            isRanked: true
        });
        container.appendChild(moviesShelf);
    }

    // ── 3. Top 10 Webseries Shelf ───────────────────────────────────────────
    if (typeof FEATURED_SERIES !== 'undefined' && FEATURED_SERIES.length > 0) {
        const seriesShelf = createShelfElement({
            title: 'Top 10 Webseries',
            icon: '📺',
            items: FEATURED_SERIES,
            isRanked: true
        });
        container.appendChild(seriesShelf);
    }
}

/**
 * Renders the search screen (supports searching by title or entering IMDb ID).
 */
function renderSearchScreen() {
    App.elements.root.innerHTML = `
        <div class="container">
            <div class="search-screen-container">
                <h1>Narraflix</h1>
                <p>Search any movie or series, or enter an IMDb ID to start streaming.</p>
                <form id="search-form">
                    <input type="text" id="search-input" placeholder="e.g. Inception, Breaking Bad, or tt1375666" required autofocus autocomplete="off">
                    <button type="submit" id="search-btn">Stream</button>
                </form>
                <p id="search-error" class="error-message" style="display: none;"></p>
                <div id="search-results" class="search-results-grid" style="display: none;"></div>
                <div id="home-shelves" class="home-shelves-container"></div>
            </div>
        </div>
    `;

    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const submitBtn = document.getElementById('search-btn');
    const errorMessage = document.getElementById('search-error');
    const resultsContainer = document.getElementById('search-results');
    const shelvesContainer = document.getElementById('home-shelves');

    // Populate shelves initially (instant display from cache / fallbacks)
    renderHomeShelves(shelvesContainer);

    // Fetch daily dynamic trending from TMDB
    if (typeof loadDailyTrending === 'function') {
        loadDailyTrending(() => {
            if (shelvesContainer && shelvesContainer.style.display !== 'none') {
                renderHomeShelves(shelvesContainer);
            }
        });
    }

    const showError = (msg) => {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
    };

    const clearError = () => {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    };

    const handleSearch = async (query) => {
        query = query.trim();
        if (!query) {
            clearError();
            resultsContainer.style.display = 'none';
            shelvesContainer.style.display = 'block';
            return;
        }

        clearError();
        resultsContainer.innerHTML = '';
        shelvesContainer.style.display = 'none';
        resultsContainer.style.display = 'grid';

        // If user entered a direct IMDb ID format (tt1234567)
        if (isValidImdbId(query)) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Validating...';
            try {
                const response = await fetch(`https://www.omdbapi.com/?i=${query}&apikey=thewdb`);
                const data = await response.json();
                if (data.Response === "True") {
                    window.location.search = `?id=${query}`;
                    return;
                } else {
                    showError(`No title found for IMDb ID ${query}.`);
                }
            } catch (err) {
                showError('Error validating IMDb ID. Please try again.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Stream';
            }
            return;
        }

        // Searching by Title
        submitBtn.disabled = true;
        submitBtn.textContent = 'Searching...';

        try {
            const response = await fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=thewdb`);
            const data = await response.json();

            if (data.Response === "True" && Array.isArray(data.Search) && data.Search.length > 0) {
                renderSearchResults(data.Search, resultsContainer);
            } else {
                showError(data.Error ? `${data.Error} Please check the spelling.` : `No results found for "${query}".`);
            }
        } catch (err) {
            console.error("Search error:", err);
            showError('Unable to fetch search results. Please check your connection.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Stream';
        }
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSearch(input.value);
    });

    // When the user clears the input box, restore the shelves!
    input.addEventListener('input', () => {
        if (!input.value.trim()) {
            clearError();
            resultsContainer.style.display = 'none';
            shelvesContainer.style.display = 'block';
        }
    });

    // Check if ?s= is present in URL to auto-search on load
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('s');
    if (searchParam) {
        input.value = searchParam;
        handleSearch(searchParam);
    }
}

/**
 * Safely renders search result cards to the container.
 * @param {Array} items
 * @param {HTMLElement} container
 */
function renderSearchResults(items, container) {
    container.innerHTML = '';

    const seen = new Set();
    const uniqueItems = items.filter(item => {
        if (!item.imdbID || seen.has(item.imdbID)) return false;
        seen.add(item.imdbID);
        return true;
    });

    uniqueItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'search-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `Play ${item.Title} (${item.Year})`);

        const posterDiv = document.createElement('div');
        posterDiv.className = 'search-poster';
        attachPoster({
            container: posterDiv,
            posterUrl: item.Poster,
            title: item.Title,
            year: item.Year,
            imdbId: item.imdbID,
            imgClass: 'search-poster-img'
        });

        const typeBadge = document.createElement('span');
        typeBadge.className = 'type-badge';
        typeBadge.textContent = item.Type || 'movie';
        posterDiv.appendChild(typeBadge);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'search-card-info';

        const titleEl = document.createElement('div');
        titleEl.className = 'search-card-title';
        titleEl.textContent = item.Title;

        const yearEl = document.createElement('div');
        yearEl.className = 'search-card-year';
        yearEl.textContent = item.Year;

        infoDiv.append(titleEl, yearEl);
        card.append(posterDiv, infoDiv);

        const selectMedia = () => {
            window.location.search = `?id=${item.imdbID}`;
        };

        card.addEventListener('click', selectMedia);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectMedia();
            }
        });

        container.appendChild(card);
    });
}


/**
 * Handles the disclaimer modal.
 */
function handleDisclaimer() {
    const modal = document.getElementById('disclaimer-modal');
    const acceptButton = document.getElementById('accept-disclaimer');
    const neverShowAgain = document.getElementById('never-show-again');

    // If the user has chosen to hide the disclaimer permanently, do nothing.
    if (localStorage.getItem('hideDisclaimerPermanently') === 'true') {
        return;
    }

    // If the disclaimer has been hidden for the current session, do nothing.
    if (sessionStorage.getItem('disclaimerHiddenForSession') === 'true') {
        return;
    }

    // If neither of the above are true, show the modal.
    modal.style.display = 'flex';

    acceptButton.addEventListener('click', () => {
        modal.style.display = 'none';
        if (neverShowAgain.checked) {
            // If the user ticks the box, set the permanent flag.
            localStorage.setItem('hideDisclaimerPermanently', 'true');
        } else {
            // Otherwise, just hide it for the current session.
            sessionStorage.setItem('disclaimerHiddenForSession', 'true');
        }
    });
}

/**
 * Initializes the application.
 */
async function init() {
    initAdBlocker();        // runs first — protects the page before anything loads
    initBackgroundEffect();
    handleDisclaimer();
    App.elements.root = document.getElementById('app-root');
    const params = new URLSearchParams(window.location.search);
    App.imdbId = params.get('id');

    if (!App.imdbId) {
        renderSearchScreen();
        return;
    }

    renderInitialLayout();
    
    const data = await fetchMediaDetails();

    if (data) {
        App.currentMedia = data;
        renderMediaDetails(data);
        renderServerButtons();
        App.elements.healthButton.addEventListener('click', runHealthCheck);

        if (App.mediaType === 'series') {
            setupSeriesControls();
            const season = params.get('season') || '1';
            const episode = params.get('episode');
            
            App.elements.seasonSelect.value = season;
            await fetchEpisodes(season);
            
            if (episode) {
                App.elements.episodeSelect.value = episode;
            }
            App.elements.episodeSelect.dispatchEvent(new Event('change'));
        }
    } else {
        renderError('Media not found.');
        return;
    }

    let serverId = params.get('server');
    if (serverId) {
        document.querySelector(`.stream-button[data-provider="${serverId}"]`)?.classList.add('active');
        await showStream(serverId);
        runHealthCheck();
    } else {
        // Automatically ping all servers concurrently and select the fastest healthy one!
        if (typeof findFastestProvider === 'function') {
            serverId = await findFastestProvider({ onResult: renderHealthStatus, timeoutMs: 2500 });
        } else {
            serverId = Object.keys(STREAMING_PROVIDERS)[0];
        }
        document.querySelectorAll('.stream-button').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.stream-button[data-provider="${serverId}"]`)?.classList.add('active');
        await showStream(serverId);
        runHealthCheck();
    }
}

// Start the application
init();
