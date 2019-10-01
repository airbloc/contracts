FROM node:10-alpine AS base
RUN apk add --no-cache make gcc g++ python git bash

WORKDIR /contracts

COPY package.json .
COPY yarn.lock .
RUN yarn

FROM base AS builder
COPY . .
# make run.sh
RUN printf "#!/bin/bash\nyarn migrate:klaytn:baobab && node script/run-deployment.js test" > ./script/run.sh
RUN chmod +x ./script/run.sh
EXPOSE 8500
ENTRYPOINT [ "./script/run.sh" ]
