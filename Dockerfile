FROM node:20-alpine AS development-dependencies-env
COPY . /app
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
COPY . /app/
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
# Business runs in India; keep the runtime timezone IST so admin-entered notice
# times and delivery dates are interpreted/rendered in the local timezone rather
# than the server's UTC (Vercel: set the TZ env var to Asia/Kolkata as well).
ENV TZ=Asia/Kolkata
COPY ./package.json package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]