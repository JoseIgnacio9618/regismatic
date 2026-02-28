FROM node:20-alpine AS build
ARG VITE_API_BASE_URL=http://localhost:4000/api
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN sed -i "s|API_BASE_URL_PLACEHOLDER|${VITE_API_BASE_URL}|g" src/environments/environment.prod.ts \
  && npm run build -- --configuration production

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/www /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
