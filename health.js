const HEALTH_TIMEOUT_MS = 8000;
const HEALTH_CONCURRENCY = 4;
const HEALTH_URL_FILLER = '0';

/**
 * @param {string} origin
 * @param {number} timeoutMs
 * @returns {Promise<'ok'|'error'|'timeout'>} The response is opaque, so 'ok'
 *          means the host answered, not that it returned 200.
 */
async function probeHost(origin, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        await fetch(origin, {
            mode: 'no-cors',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            signal: controller.signal,
        });
        return 'ok';
    } catch (error) {
        return error.name === 'AbortError' ? 'timeout' : 'error';
    } finally {
        clearTimeout(timer);
    }
}

/**
 * @param {string} id - Key in STREAMING_PROVIDERS.
 * @param {object} [options] - { timeoutMs }
 * @returns {Promise<{id: string, name: string, status: 'up'|'down'|'unknown', detail: string, ms: number}>}
 *          'up' means the host answered, not that its embed still plays.
 */
async function checkProvider(id, options = {}) {
    const timeoutMs = options.timeoutMs || HEALTH_TIMEOUT_MS;
    const provider = STREAMING_PROVIDERS[id];

    if (!provider) {
        return { id, name: id, status: 'unknown', detail: 'Not configured', ms: 0 };
    }

    const url = generateEmbedUrl(id, 'movie', HEALTH_URL_FILLER)
        || generateEmbedUrl(id, 'series', HEALTH_URL_FILLER, 1, 1);

    if (!url) {
        return { id, name: provider.name, status: 'unknown', detail: 'No embed URL', ms: 0 };
    }

    let origin;
    try {
        origin = new URL(url).origin;
    } catch (error) {
        return { id, name: provider.name, status: 'down', detail: 'Invalid URL', ms: 0 };
    }

    const started = performance.now();
    const outcome = await probeHost(origin, timeoutMs);
    const ms = Math.round(performance.now() - started);

    if (outcome === 'ok') {
        return { id, name: provider.name, status: 'up', detail: `Alive · ${ms}ms`, ms };
    }

    if (outcome === 'timeout') {
        return {
            id,
            name: provider.name,
            status: 'unknown',
            detail: `No response · ${Math.round(timeoutMs / 1000)}s timeout`,
            ms,
        };
    }

    return { id, name: provider.name, status: 'down', detail: `Not responding · ${ms}ms`, ms };
}

/**
 * Runs at most HEALTH_CONCURRENCY probes at once.
 * @param {object} [options] - { ids, concurrency, timeoutMs, onResult }
 * @returns {Promise<object[]>}
 */
async function checkAllProviders(options = {}) {
    const queue = (options.ids || Object.keys(STREAMING_PROVIDERS)).slice();
    const concurrency = options.concurrency || HEALTH_CONCURRENCY;
    const results = [];

    const worker = async () => {
        while (queue.length) {
            const result = await checkProvider(queue.shift(), options);
            results.push(result);
            if (options.onResult) options.onResult(result);
        }
    };

    const workerCount = Math.max(1, Math.min(concurrency, queue.length));
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}
