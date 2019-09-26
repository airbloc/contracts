FROM node:10-alpine AS base
RUN apk add --no-cache make gcc g++ python git bash

WORKDIR /contracts

COPY package.json .
COPY yarn.lock .
RUN yarn

FROM base AS builder
COPY . .
RUN [ "chmod", "+x", "./script/run.sh" ]
EXPOSE 8500
ENTRYPOINT [ "./script/run.sh" ]
