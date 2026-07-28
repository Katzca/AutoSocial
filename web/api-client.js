(function exposeApiClient(root, factory) {
  const createApiClient = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = { createApiClient };
  } else {
    root.createApiClient = createApiClient;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function apiClientFactory() {
  return function createApiClient(fetchImpl = globalThis.fetch) {
    async function parse(response) {
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `API Error: ${response.status}`);
      }
      return data;
    }

    return {
      async get(endpoint) {
        return parse(await fetchImpl(endpoint));
      },
      async post(endpoint, body) {
        const options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        };
        if (body !== undefined) {
          options.body = JSON.stringify(body);
        }
        return parse(await fetchImpl(endpoint, options));
      },
    };
  };
});
