FROM node:20-alpine as build

WORKDIR /app
COPY package.json package-lock.json ./
ENV NODE_ENV=production
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
