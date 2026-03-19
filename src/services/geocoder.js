const axios = require('axios');
require('dotenv').config();

const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'NavBackend/1.0';

/**
 * Geocoder Service — converts addresses ↔ coordinates using Nominatim (OSM).
 * Nominatim is free and requires no API key, but enforce a 1 req/sec rate limit.
 */

let lastRequestTime = 0;

async function rateLimitedGet(url, params) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1000) {
    await new Promise((r) => setTimeout(r, 1000 - elapsed));
  }
  lastRequestTime = Date.now();

  const response = await axios.get(url, {
    params: { ...params, format: 'json' },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 8000,
  });
  return response.data;
}

/**
 * Forward geocode: address string → coordinates.
 * @param {string} address
 * @param {object} options - { countrycodes, limit, viewbox }
 * @returns {Promise<Array>} Array of results with lat, lng, display_name
 */
async function geocode(address, options = {}) {
  const params = {
    q: address,
    limit: options.limit || 5,
    addressdetails: 1,
  };

  if (options.countrycodes) params.countrycodes = options.countrycodes;
  if (options.viewbox) params.viewbox = options.viewbox.join(',');

  const results = await rateLimitedGet(`${NOMINATIM_URL}/search`, params);

  return results.map((r) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    display_name: r.display_name,
    type: r.type,
    importance: r.importance,
    address: r.address,
    bbox: r.boundingbox?.map(parseFloat),
  }));
}

/**
 * Reverse geocode: coordinates → address.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object>} Address object
 */
async function reverseGeocode(lat, lng) {
  const result = await rateLimitedGet(`${NOMINATIM_URL}/reverse`, {
    lat,
    lon: lng,
    zoom: 18,
    addressdetails: 1,
  });

  if (!result || result.error) {
    throw new Error(`Reverse geocoding failed for [${lat}, ${lng}]`);
  }

  return {
    display_name: result.display_name,
    address: result.address,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}

/**
 * Autocomplete search for place names (uses Nominatim search with partial query).
 * @param {string} query
 * @param {object} options
 */
async function autocomplete(query, options = {}) {
  if (!query || query.length < 3) return [];
  return geocode(query, { limit: 7, ...options });
}

module.exports = { geocode, reverseGeocode, autocomplete };
