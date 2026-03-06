import axios from 'axios'

const LOCAL_API_ORIGIN = 'http://localhost:3000'

function toUrl(rawUrl) {
  try {
    return new URL(rawUrl, window.location.origin)
  } catch {
    return null
  }
}

function isLocalBackendUrl(rawUrl) {
  const url = toUrl(rawUrl)
  if (!url) return false

  return url.origin === LOCAL_API_ORIGIN
}

function extractQuery(url) {
  const query = {}
  for (const [key, value] of url.searchParams.entries()) {
    if (Object.prototype.hasOwnProperty.call(query, key)) {
      const current = query[key]
      query[key] = Array.isArray(current) ? [...current, value] : [current, value]
    } else {
      query[key] = value
    }
  }

  return query
}

function normalizeBody(data) {
  if (data === undefined || data === null || data === '') return {}
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return { value: data }
    }
  }

  return data
}

function bodyToResponse(data) {
  if (data === undefined) return 'null'

  return JSON.stringify(data)
}

function shouldSkipDiagnostic(rawUrl, status) {
  if (Number(status) !== 404) return false
  const url = toUrl(rawUrl)
  if (!url) return false

  return (
    /^\/songs\/fade-profile\/\d+$/.test(url.pathname) ||
    /^\/songs\/touch-speed-version\/\d+$/.test(url.pathname)
  )
}

async function callBackend({ method, rawUrl, body, query }) {
  const url = toUrl(rawUrl)
  if (!url) {
    throw new Error(`Invalid URL: ${rawUrl}`)
  }

  const result = await window.electron2.backendRequest({
    method: String(method || 'GET').toUpperCase(),
    path: url.pathname,
    query: query || extractQuery(url),
    body: normalizeBody(body)
  })

  return {
    status: Number(result?.status || 500),
    data: result?.data
  }
}

export function installIpcHttpBridge() {
  const nativeFetch = window.fetch.bind(window)

  window.fetch = async(input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input?.url
    if (!isLocalBackendUrl(rawUrl)) {
      return nativeFetch(input, init)
    }

    const method = init?.method || (typeof input !== 'string' ? input?.method : 'GET') || 'GET'
    const body = init?.body
    const result = await callBackend({ method, rawUrl, body })
    if (result.status >= 400 && !shouldSkipDiagnostic(rawUrl, result.status)) {
      // Temporary diagnostic to surface backend failures in renderer console.
      console.error('[vmusic][ipc-http][fetch-error]', { method, rawUrl, status: result.status, data: result.data })
    }

    return new Response(bodyToResponse(result.data), {
      status: result.status,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }

  const baseAdapter = axios.getAdapter(axios.defaults.adapter)
  const defaultValidateStatus = (status) => status >= 200 && status < 300

  axios.defaults.adapter = async(config) => {
    const requestUrl = config?.url || ''
    if (!isLocalBackendUrl(requestUrl)) {
      return baseAdapter(config)
    }

    const result = await callBackend({
      method: config?.method || 'GET',
      rawUrl: requestUrl,
      body: config?.data,
      query: config?.params
    })
    if (result.status >= 400 && !shouldSkipDiagnostic(requestUrl, result.status)) {
      // Temporary diagnostic to surface backend failures in renderer console.
      console.error('[vmusic][ipc-http][axios-error]', { method: config?.method || 'GET', requestUrl, status: result.status, data: result.data })
    }

    const response = {
      data: result.data,
      status: result.status,
      statusText: String(result.status),
      headers: {},
      config,
      request: {}
    }

    const validateStatus = config?.validateStatus || defaultValidateStatus
    if (!validateStatus(response.status)) {
      const errorCode = response.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST'
      const error = new axios.AxiosError(`Request failed with status code ${response.status}`,
        errorCode,
        config,
        response.request,
        response)

      return Promise.reject(error)
    }

    return response
  }
}
