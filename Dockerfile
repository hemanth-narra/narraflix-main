# ── Narraflix – static site served by nginx ──────────────────────────────────
# Single-stage: no build step needed (pure HTML/CSS/JS).
FROM nginx:alpine

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy every static asset into the web root
COPY index.html   /usr/share/nginx/html/
COPY style.css    /usr/share/nginx/html/
COPY app.js       /usr/share/nginx/html/
COPY providers.js /usr/share/nginx/html/
COPY featured.js  /usr/share/nginx/html/
COPY health.js    /usr/share/nginx/html/

# Use a custom nginx config that sets sensible headers and handles SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
