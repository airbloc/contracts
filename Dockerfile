# For testing airbloc contracts.
FROM node:10-alpine AS builder
RUN apk add --no-cache make gcc g++ python git bash

WORKDIR /contracts

COPY package.json .
COPY yarn.lock .
RUN yarn

FROM trufflesuite/ganache-cli:v6.3.0 as runtime
RUN apk add --no-cache bash

WORKDIR /contracts
COPY . .
COPY --from=builder '/contracts/node_modules' ./node_modules

# start temporary ganache and deploy contract
RUN mkdir /contracts/db
RUN nohup bash -c "node /contracts/script/run-ganache.js --seed airbloc_test --db /contracts/db &" && sleep 4 && yarn migrate:local
RUN nohup bash -c "node /contracts/script/run-deployment.js &"

EXPOSE 8545 8500
ENTRYPOINT ["node", "script/run-ganache.js", "--seed", "airbloc_test", "--db", "/contracts/db"]
