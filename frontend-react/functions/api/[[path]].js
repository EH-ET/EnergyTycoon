// This Cloudflare Pages function acts as a proxy to the backend server.
// It intercepts all requests to /api/* and forwards them to the Render.com backend.
// This makes all API requests appear as "same-site" to the browser,
// resolving the third-party cookie blocking issue.

const RENDER_BASE_URL = 'https://energy-tycoon.onrender.com';

export async function onRequest({ request, params }) {
  // Create the full destination URL
  const url = new URL(request.url);
  const path = params.path.join('/'); // `params.path` is an array of path segments
  const destinationUrl = new URL(`${RENDER_BASE_URL}/${path}${url.search}`);
  
  // Create a new request object to forward to the backend.
  // This preserves the method, headers, body, etc., of the original request.
  const newRequest = new Request(destinationUrl, request); 
  
  // Fetch the response from the actual backend
  const response = await fetch(newRequest);

  // Return the backend's response directly to the original client
  return response;
}
