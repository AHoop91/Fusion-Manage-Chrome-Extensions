const AUTH_FAILURE_MESSAGE = 'Request could not be completed.';

function isAuthFailureStatus(status) {
    return status === 401 || status === 403;
}

function parseErrorMessage(data, fallback) {
    if (typeof data === 'string' && data.trim()) return data.trim();
    if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim();

    try {
        const serialized = JSON.stringify(data);
        return serialized && serialized !== '{}' ? serialized : fallback;
    } catch {
        return fallback;
    }
}

function buildHttpError(status, data, fallback) {
    const message =
        isAuthFailureStatus(status)
            ? AUTH_FAILURE_MESSAGE
            : parseErrorMessage(data, fallback || `HTTP ${status}`);

    const error = new Error(message || fallback || `HTTP ${status}`);
    error.status = isAuthFailureStatus(status) ? undefined : status;
    error.data = isAuthFailureStatus(status) ? null : data;
    return error;
}

/**
 * Perform a session-authenticated JSON HTTP request.
 *
 * This is the primary transport primitive for all standard API calls made
 * by the extension (e.g. Autodesk FM REST endpoints).
 */
export async function httpRequest({ method, url, body, headers = {} }) {
    const hasBody = typeof body !== 'undefined';
    const hasContentTypeHeader =
        Object.keys(headers).some((name) => name.toLowerCase() === 'content-type');

    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            ...(hasBody && !hasContentTypeHeader
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...headers
        },
        body: hasBody ? JSON.stringify(body) : undefined
    });

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await res.json() : await res.text();

    if (!res.ok) throw buildHttpError(res.status, data, `HTTP ${res.status}`);

    return data;
}

/**
 * Perform a session-authenticated JSON HTTP request and return response metadata.
 */
export async function httpRequestWithMeta({ method, url, body, headers = {} }) {
    const hasBody = typeof body !== 'undefined';
    const hasContentTypeHeader =
        Object.keys(headers).some((name) => name.toLowerCase() === 'content-type');

    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            ...(hasBody && !hasContentTypeHeader
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...headers
        },
        body: hasBody ? JSON.stringify(body) : undefined
    });

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await res.json() : await res.text();
    const responseHeaders = {};
    res.headers.forEach((value, key) => {
        responseHeaders[String(key || '').toLowerCase()] = String(value || '');
    });

    if (!res.ok) throw buildHttpError(res.status, data, `HTTP ${res.status}`);

    return {
        data,
        headers: responseHeaders,
        status: res.status
    };
}

/**
 * Perform a session-authenticated multipart/form-data request.
 */
export async function httpMultipartRequest({
    method,
    url,
    formData,
    headers = {}
}) {
    if (!(formData instanceof FormData)) {
        throw new Error('formData must be a FormData instance');
    }

    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
            ...headers
        },
        body: formData
    });

    if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw buildHttpError(res.status, text, `HTTP ${res.status}`);
    }

    return true;
}

/**
 * Perform a session-authenticated binary HTTP request.
 */
export async function httpBinaryRequest({
    method = 'GET',
    url,
    headers = {},
    responseType = 'arraybuffer'
}) {
    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
            ...headers
        }
    });

    if (!res.ok) throw buildHttpError(res.status, null, `HTTP ${res.status}`);

    const buffer = await res.arrayBuffer();

    if (responseType === 'base64') {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(
                ...bytes.subarray(i, i + chunkSize)
            );
        }

        return btoa(binary);
    }

    return buffer;
}

/**
 * Perform a session-authenticated binary HTTP request and expose response metadata.
 */
export async function httpBinaryRequestWithMeta({
    method = 'GET',
    url,
    headers = {},
    responseType = 'arraybuffer'
}) {
    const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
            ...headers
        }
    });

    if (!res.ok) throw buildHttpError(res.status, null, `HTTP ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    const buffer = await res.arrayBuffer();

    if (responseType === 'base64') {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(
                ...bytes.subarray(i, i + chunkSize)
            );
        }

        return {
            data: btoa(binary),
            contentType
        };
    }

    return {
        data: buffer,
        contentType
    };
}
