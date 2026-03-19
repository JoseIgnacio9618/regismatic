FROM node:20-alpine AS build
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY --from=build /usr/src/app/node_modules/.prisma /usr/src/app/node_modules/.prisma
COPY --from=build /usr/src/app/dist ./dist
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /usr/src/app/uploads/profile-photos
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 4000
CMD ["./docker-entrypoint.sh"]
