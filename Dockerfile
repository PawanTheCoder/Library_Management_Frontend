# Build static frontend and serve with nginx
# Stage 1: build with node
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY public ./public
COPY src ./src
RUN npm ci --silent
RUN npm run build

# Stage 2: nginx to serve the static files
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: copy a custom nginx.conf if needed (SPA fallback)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
