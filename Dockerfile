FROM node:14.17.5-alpine

WORKDIR /app

RUN apk update && apk add --no-cache \
    git \
    tzdata

COPY package.json package-lock.json ./

RUN npm i --production

COPY config/ config/
COPY index.js index.js
COPY app.js app.js
COPY lib lib

CMD [ "npm", "start" ]
