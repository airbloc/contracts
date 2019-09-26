#!/bin/bash
yarn migrate:klaytn:baobab && node script/run-deployment.js test
