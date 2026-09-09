FROM node:24-alpine AS build
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci
COPY api/ ./
RUN npx prisma generate && npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
