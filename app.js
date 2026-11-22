/**
 * Main application state and configuration.
 */
const App = {
    imdbId: null,
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
        const response = await fetch(`https://www.omdbapi.com/?i=${App.imdbId}&apikey=thewdb`);
        const data = await response.json();
        if (data.Response !== "True") {
            console.warn("Media not found in OMDb API.");
            return null;
        }
        App.mediaType = data.Type;
        App.totalSeasons = data.totalSeasons;
        return data;
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

    // Poster — fall back gracefully if poster is missing
    const posterEl = el('div', 'poster');
    const posterUrl = data.Poster && data.Poster !== 'N/A' ? data.Poster : '';
    if (posterUrl) posterEl.style.backgroundImage = `url(${posterUrl})`;
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
        if (data.Response === "True" && data.Episodes) {
            App.seriesCache[season] = data.Episodes;
            data.Episodes.forEach(episode => {
                const option = document.createElement('option');
                option.value = episode.Episode;
                option.textContent = `Episode ${episode.Episode}: ${episode.Title}`;
                episodeSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching episodes:", error);
    }
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
function showStream(streamId) {
    const provider = STREAMING_PROVIDERS[streamId];
    if (!provider) return;

    const params = new URLSearchParams(window.location.search);
    let url;

    if (App.mediaType === 'series') {
        const season = App.elements.seasonSelect.value;
        const episode = App.elements.episodeSelect.value;
        url = generateEmbedUrl(streamId, 'series', App.imdbId, season, episode);
        params.set('season', season);
        params.set('episode', episode);
    } else {
        url = generateEmbedUrl(streamId, 'movie', App.imdbId);
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

/**
 * Returns true if the string looks like a valid IMDb ID (tt + 7 or 8 digits).
 * @param {string} id
 * @returns {boolean}
 */
function isValidImdbId(id) {
    return /^tt\d{7,8}$/.test(id);
}

/**
 * Renders the input form for IMDb/TMDb ID.
 */
function renderIdInput() {
    App.elements.root.innerHTML = `
        <div class="container">
            <div class="id-input-container">
                <h1>Narraflix</h1>
                <p>Enter an IMDb ID to get started.</p>
                <form id="id-form">
                    <input type="text" id="id-input" placeholder="e.g., tt1727587" required>
                    <button type="submit">Stream</button>
                </form>
                <p id="error-message" class="error-message" style="display: none;"></p>
            </div>
        </div>
    `;

    const form = document.getElementById('id-form');
    const input = document.getElementById('id-input');
    const errorMessage = document.getElementById('error-message');
    const submitButton = form.querySelector('button');

    const showInputError = (msg) => {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = input.value.trim();
        if (!id) return;

        // Fast client-side format check before hitting the API
        if (!isValidImdbId(id)) {
            showInputError('Invalid format. IMDb IDs look like tt1234567.');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Validating...';
        errorMessage.style.display = 'none';

        try {
            const response = await fetch(`https://www.omdbapi.com/?i=${id}&apikey=thewdb`);
            const data = await response.json();
            if (data.Response === "True") {
                window.location.search = `?id=${id}`;
            } else {
                showInputError('No title found for that IMDb ID. Please try again.');
            }
        } catch (error) {
            showInputError('An error occurred while validating the ID.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Stream';
        }
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
        renderIdInput();
        return;
    }

    renderInitialLayout();
    
    const data = await fetchMediaDetails();

    if (data) {
        renderMediaDetails(data);
        renderServerButtons();
        App.elements.healthButton.addEventListener('click', runHealthCheck);
        runHealthCheck();   // not awaited; probes must not delay the player

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

    const serverId = params.get('server') || Object.keys(STREAMING_PROVIDERS)[0];
    
    document.querySelector(`.stream-button[data-provider="${serverId}"]`).classList.add('active');
    showStream(serverId);
}

// Start the application
init();
